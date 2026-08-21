import { and, asc, desc, eq, lte, sql } from "drizzle-orm";
import { historicalAssetAvailability, historicalCandles, historicalDatasets, historicalIngestionRuns, historicalMarketCaps, historicalRegimeSnapshots, historicalSectorSnapshots } from "../../drizzle/schema";
import { DEFAULT_ASSET_UNIVERSE, type Timeframe } from "../../shared/crypto";
import { getDb } from "../db";
import { timeframeMs } from "./historicalData";
import { fetchCoinGeckoHistoricalMarketChart } from "./providers";

export const HISTORICAL_REGIME_DEFINITION_VERSION = "BTC_OHLCV_CLOSED_CANDLE_V1";
export const HISTORICAL_SECTOR_DEFINITION_VERSION = "UNAVAILABLE_WITHOUT_POINT_IN_TIME_SOURCE_V1";

type RegimeClassification = "RISK ON" | "SELECTIVE" | "RISK OFF" | "UNAVAILABLE";

export function classifyHistoricalRegime(closeNow: number | undefined, close24hAgo: number | undefined): { classification: RegimeClassification; score: number | null; input: Record<string, unknown> } {
  if (!closeNow || !close24hAgo) return { classification: "UNAVAILABLE", score: null, input: { btcTrend24hPercent: null, reason: "Insufficient completed BTC candles." } };
  const returnPercent = (closeNow - close24hAgo) / close24hAgo * 100;
  if (returnPercent >= 1) return { classification: "RISK ON", score: 1, input: { btcTrend24hPercent: returnPercent } };
  if (returnPercent <= -1) return { classification: "RISK OFF", score: -1, input: { btcTrend24hPercent: returnPercent } };
  return { classification: "SELECTIVE", score: 0, input: { btcTrend24hPercent: returnPercent } };
}

async function datasetIngestionCutoff(datasetId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const dataset = (await db.select().from(historicalDatasets).where(eq(historicalDatasets.id, datasetId)).limit(1))[0];
  if (!dataset || dataset.status !== "sealed" || !dataset.sealedAt) throw new Error("A sealed historical dataset is required for reconstruction.");
  return dataset.sealedAt;
}

async function getLineageCandles(datasetId: number, assetId: string, timeframe: Timeframe) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const cutoff = await datasetIngestionCutoff(datasetId);
  const rows = await db.select({ openTime: historicalCandles.sourceOpenTimeMs, closeTime: historicalCandles.sourceCloseTimeMs, close: historicalCandles.close, volume: historicalCandles.volume, runId: historicalIngestionRuns.id }).from(historicalCandles).innerJoin(historicalIngestionRuns, eq(historicalCandles.ingestionRunId, historicalIngestionRuns.id)).where(and(eq(historicalCandles.assetId, assetId), eq(historicalCandles.instrumentType, "perpetual"), eq(historicalCandles.timeframe, timeframe), lte(historicalCandles.ingestedAt, cutoff))).orderBy(desc(historicalCandles.ingestedAt), desc(historicalIngestionRuns.id), asc(historicalCandles.sourceOpenTimeMs));
  const latestRevisionByOpen = new Map<number, typeof rows[number]>();
  for (const row of rows) if (!latestRevisionByOpen.has(row.openTime)) latestRevisionByOpen.set(row.openTime, row);
  return Array.from(latestRevisionByOpen.values()).sort((left, right) => left.openTime - right.openTime);
}

export async function persistHistoricalRegimeSnapshots(datasetId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const totals: Record<string, number> = {};
  for (const timeframe of ["15m", "1h", "4h", "1d"] as Timeframe[]) {
    const candles = await getLineageCandles(datasetId, "bitcoin", timeframe);
    const lookback = Math.ceil(24 * 60 * 60_000 / timeframeMs[timeframe]);
    const rows = candles.map((candle, index) => {
      const regime = classifyHistoricalRegime(candle.close, candles[index - lookback]?.close);
      return { datasetId, timeframe, observedAt: new Date(candle.closeTime), classification: regime.classification, regimeScore: regime.score, inputs: { ...regime.input, btcMomentum: null, btcDominance: null, totalMarketTrend: null, altcoinBreadth: null, marketVolume: candle.volume, volatilityRegime: null, sourceCandleCloseAt: new Date(candle.closeTime).toISOString() }, definitionVersion: HISTORICAL_REGIME_DEFINITION_VERSION, availability: regime.classification === "UNAVAILABLE" ? "UNAVAILABLE" as const : "AVAILABLE" as const, source: "Binance public completed OHLCV archive", freshnessAt: new Date(candle.closeTime) };
    });
    for (let offset = 0; offset < rows.length; offset += 500) await db.insert(historicalRegimeSnapshots).values(rows.slice(offset, offset + 500)).onDuplicateKeyUpdate({ set: { classification: sql`VALUES(classification)`, regimeScore: sql`VALUES(regimeScore)`, inputs: sql`VALUES(inputs)`, availability: sql`VALUES(availability)`, freshnessAt: sql`VALUES(freshnessAt)` } });
    totals[timeframe] = rows.length;
  }
  return totals;
}

export async function persistHistoricalMarketCaps(datasetId: number, days = 365) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const outcomes: Array<{ assetId: string; availability: "AVAILABLE" | "UNAVAILABLE"; observations: number }> = [];
  for (const asset of DEFAULT_ASSET_UNIVERSE) {
    try {
      const chart = await fetchCoinGeckoHistoricalMarketChart(asset.id, days);
      const rows = chart.marketCaps.map(([observedAt, marketCap]) => ({ datasetId, assetId: asset.id, provider: chart.source, sourceObservedAt: new Date(observedAt), marketCap, circulatingSupply: null, availability: "AVAILABLE" as const, sourcePayload: { timestampMs: observedAt } }));
      for (let offset = 0; offset < rows.length; offset += 500) await db.insert(historicalMarketCaps).values(rows.slice(offset, offset + 500)).onDuplicateKeyUpdate({ set: { marketCap: sql`VALUES(marketCap)`, retrievalAt: new Date(), sourcePayload: sql`VALUES(sourcePayload)` } });
      outcomes.push({ assetId: asset.id, availability: rows.length ? "AVAILABLE" : "UNAVAILABLE", observations: rows.length });
      if (!rows.length) await db.insert(historicalMarketCaps).values({ datasetId, assetId: asset.id, provider: chart.source, sourceObservedAt: new Date(), marketCap: null, circulatingSupply: null, availability: "UNAVAILABLE", sourcePayload: { reason: "Provider returned no historical market-cap observations." } }).onDuplicateKeyUpdate({ set: { retrievalAt: new Date() } });
    } catch (error) {
      const reason = error instanceof Error ? error.message.replace(/https?:\/\/\S+/g, "provider endpoint") : "Historical market-cap source failed.";
      await db.insert(historicalMarketCaps).values({ datasetId, assetId: asset.id, provider: "CoinGecko market chart", sourceObservedAt: new Date(), marketCap: null, circulatingSupply: null, availability: "UNAVAILABLE", sourcePayload: { reason } }).onDuplicateKeyUpdate({ set: { retrievalAt: new Date(), sourcePayload: { reason } } });
      outcomes.push({ assetId: asset.id, availability: "UNAVAILABLE", observations: 0 });
    }
  }
  return outcomes;
}

export async function persistUnavailableHistoricalSectorAndAvailability(datasetId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const dataset = (await db.select().from(historicalDatasets).where(eq(historicalDatasets.id, datasetId)).limit(1))[0];
  if (!dataset) throw new Error("Historical dataset not found.");
  const observedAt = dataset.sealedAt ?? new Date();
  for (const asset of DEFAULT_ASSET_UNIVERSE) {
    await db.insert(historicalSectorSnapshots).values({ datasetId, assetId: asset.id, observedAt, sector: null, sectorMomentum: null, sectorRank: null, relativeStrengthVsSector: null, relativeStrengthVsBtc: null, definitionVersion: HISTORICAL_SECTOR_DEFINITION_VERSION, availability: "UNAVAILABLE", source: "No reliable point-in-time sector provider configured", freshnessAt: null }).onDuplicateKeyUpdate({ set: { availability: "UNAVAILABLE", source: "No reliable point-in-time sector provider configured" } });
    await db.insert(historicalAssetAvailability).values({ datasetId, assetId: asset.id, listingAt: null, delistingAt: null, availability: "UNAVAILABLE", source: "Binance archive coverage only", notes: "Listing and delisting metadata unavailable. Dataset retains a survivorship-bias limitation." }).onDuplicateKeyUpdate({ set: { availability: "UNAVAILABLE", notes: "Listing and delisting metadata unavailable. Dataset retains a survivorship-bias limitation." } });
  }
}

export async function persistHistoricalDatasetContext(datasetId: number) {
  const [regime, marketCaps] = await Promise.all([persistHistoricalRegimeSnapshots(datasetId), persistHistoricalMarketCaps(datasetId)]);
  await persistUnavailableHistoricalSectorAndAvailability(datasetId);
  return { regime, marketCaps };
}
