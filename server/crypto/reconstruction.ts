import { and, asc, desc, eq, lte } from "drizzle-orm";
import { createHash } from "node:crypto";
import { historicalCandles, historicalDatasets, historicalMarketCaps, historicalRegimeSnapshots, historicalSectorSnapshots } from "../../drizzle/schema";
import { DEFAULT_ASSET_UNIVERSE, type Candle, type MarketAsset, type ScoringConfig, type Timeframe } from "../../shared/crypto";
import { getDb } from "../db";
import { assetFromProfile, buildOpportunityScore } from "./scoring";
import { timeframeMs } from "./historicalData";
import { analyzeTimeframe } from "./technical";

const stable = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
  return JSON.stringify(value);
};
const fingerprint = (value: unknown) => createHash("sha256").update(stable(value)).digest("hex");
const higherTimeframe: Partial<Record<Timeframe, Timeframe>> = { "15m": "1h", "1h": "4h", "4h": "1d" };

export type ResearchCostModel = { version: "RESEARCH_COST_MODEL_V1"; instrumentType: "spot" | "perpetual"; feePercent: number; slippagePercent: number; funding: { mode: "ACTUAL" | "ASSUMED" | "EXCLUDED" | "UNAVAILABLE"; percent?: number | null; source?: string | null } };
export type ResearchCostResult = { grossReturnPercent: number; totalFeePercent: number; totalSlippagePercent: number; fundingPercent: number | null; totalCostPercent: number | null; netReturnPercent: number | null; fundingStatus: ResearchCostModel["funding"]["mode"] };

export function calculateResearchCosts(grossReturnPercent: number, cost: ResearchCostModel): ResearchCostResult {
  const fee = Math.max(0, cost.feePercent) * 2;
  const slippage = Math.max(0, cost.slippagePercent) * 2;
  const fundingApplicable = cost.instrumentType === "perpetual" && cost.funding.mode !== "EXCLUDED";
  if (fundingApplicable && (cost.funding.mode === "UNAVAILABLE" || !Number.isFinite(cost.funding.percent))) return { grossReturnPercent, totalFeePercent: fee, totalSlippagePercent: slippage, fundingPercent: null, totalCostPercent: null, netReturnPercent: null, fundingStatus: cost.funding.mode };
  const funding = fundingApplicable ? Number(cost.funding.percent ?? 0) : 0;
  const total = Number((fee + slippage + funding).toFixed(8));
  return { grossReturnPercent, totalFeePercent: fee, totalSlippagePercent: slippage, fundingPercent: fundingApplicable ? funding : 0, totalCostPercent: total, netReturnPercent: Number((grossReturnPercent - total).toFixed(8)), fundingStatus: cost.instrumentType === "spot" ? "EXCLUDED" : cost.funding.mode };
}

async function datasetCutoff(datasetId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const dataset = (await db.select().from(historicalDatasets).where(eq(historicalDatasets.id, datasetId)).limit(1))[0];
  if (!dataset || dataset.status !== "sealed" || !dataset.sealedAt) throw new Error("Select a sealed historical dataset.");
  return dataset;
}

async function closedCandles(datasetId: number, assetId: string, instrumentType: "spot" | "perpetual", timeframe: Timeframe, at: number, required = 260) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const dataset = await datasetCutoff(datasetId);
  const rows = await db.select().from(historicalCandles).where(and(eq(historicalCandles.assetId, assetId), eq(historicalCandles.instrumentType, instrumentType), eq(historicalCandles.timeframe, timeframe), lte(historicalCandles.sourceCloseTimeMs, at), lte(historicalCandles.ingestedAt, dataset.sealedAt!))).orderBy(desc(historicalCandles.ingestedAt), desc(historicalCandles.id));
  const newestByOpen = new Map<number, typeof rows[number]>();
  for (const row of rows) if (!newestByOpen.has(row.sourceOpenTimeMs)) newestByOpen.set(row.sourceOpenTimeMs, row);
  return Array.from(newestByOpen.values()).sort((left, right) => left.sourceOpenTimeMs - right.sourceOpenTimeMs).slice(-required).map(row => ({ openTime: row.sourceOpenTimeMs, closeTime: row.sourceCloseTimeMs, open: row.open, high: row.high, low: row.low, close: row.close, volume: row.volume } satisfies Candle));
}

function percentageChange(candles: Candle[], closeAt: number, lookbackMs: number) {
  const current = candles.at(-1)?.close;
  const reference = [...candles].reverse().find(candle => candle.closeTime <= closeAt - lookbackMs)?.close;
  return current && reference ? (current - reference) / reference * 100 : null;
}

export async function reconstructState(assetId: string, timeframe: Timeframe, timestamp: number, datasetId: number, instrumentType: "spot" | "perpetual", scoringConfiguration: ScoringConfig) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const asset = DEFAULT_ASSET_UNIVERSE.find(item => item.id === assetId);
  if (!asset) throw new Error("Unsupported historical asset.");
  const dataset = await datasetCutoff(datasetId);
  const primary = await closedCandles(datasetId, assetId, instrumentType, timeframe, timestamp);
  if (!primary.length) throw new Error("No completed historical candles are available for this dataset, asset, timeframe, and timestamp.");
  const decisionAt = primary.at(-1)!.closeTime;
  const candidateTimeframes = Array.from(new Set([timeframe, higherTimeframe[timeframe], "1d"])).filter((value): value is Timeframe => Boolean(value));
  const analyses = (await Promise.all(candidateTimeframes.map(async candidate => {
    const candles = candidate === timeframe ? primary : await closedCandles(datasetId, assetId, instrumentType, candidate, decisionAt);
    return analyzeTimeframe(candles, candidate, scoringConfiguration);
  }))).filter((analysis): analysis is NonNullable<typeof analysis> => Boolean(analysis));
  const cap = (await db.select().from(historicalMarketCaps).where(and(eq(historicalMarketCaps.datasetId, datasetId), eq(historicalMarketCaps.assetId, assetId), eq(historicalMarketCaps.availability, "AVAILABLE"), lte(historicalMarketCaps.sourceObservedAt, new Date(decisionAt)))).orderBy(desc(historicalMarketCaps.sourceObservedAt)).limit(1))[0];
  const regime = (await db.select().from(historicalRegimeSnapshots).where(and(eq(historicalRegimeSnapshots.datasetId, datasetId), eq(historicalRegimeSnapshots.timeframe, timeframe), lte(historicalRegimeSnapshots.observedAt, new Date(decisionAt)))).orderBy(desc(historicalRegimeSnapshots.observedAt)).limit(1))[0];
  const sector = (await db.select().from(historicalSectorSnapshots).where(and(eq(historicalSectorSnapshots.datasetId, datasetId), eq(historicalSectorSnapshots.assetId, assetId), lte(historicalSectorSnapshots.observedAt, new Date(decisionAt)))).orderBy(desc(historicalSectorSnapshots.observedAt)).limit(1))[0];
  const current = primary.at(-1)!;
  const historicalAsset: MarketAsset = { ...assetFromProfile(asset), price: current.close, marketCap: cap?.marketCap ?? null, volume24h: null, change1h: percentageChange(primary, decisionAt, 60 * 60_000), change24h: percentageChange(primary, decisionAt, 24 * 60 * 60_000), change7d: percentageChange(primary, decisionAt, 7 * 24 * 60 * 60_000), lastUpdatedAt: decisionAt, provider: "Historical dataset" };
  const score = buildOpportunityScore({ asset: historicalAsset, analyses, universe: [historicalAsset], btc: assetId === "bitcoin" ? historicalAsset : undefined, marketRegime: null, config: scoringConfiguration });
  const enabled = Object.entries(scoringConfiguration.timeframes).filter(([, value]) => value.enabled).map(([key]) => key);
  const unavailable = [
    ...(analyses.length < enabled.length ? ["One or more enabled timeframes lack sufficient completed stored candles."] : []),
    ...(!cap ? ["Historical market capitalization is unavailable at the decision timestamp."] : []),
    ...(regime?.availability !== "AVAILABLE" ? ["The stored historical regime is unavailable at the decision timestamp."] : []),
    ...(sector?.availability !== "AVAILABLE" ? ["Historical point-in-time sector evidence is unavailable; the current taxonomy is not substituted."] : []),
    "Historical 24-hour volume-to-market-cap liquidity is unavailable; the production risk component uses its documented missing-data treatment.",
  ];
  return {
    kind: "POINT_IN_TIME_RECONSTRUCTION" as const,
    completeness: unavailable.length ? "PARTIAL" as const : "FULL" as const,
    dataset: { id: dataset.id, version: dataset.version, fingerprint: dataset.contentFingerprint, sealedAt: dataset.sealedAt, ingestionCutoffAt: dataset.ingestionCutoffAt },
    decisionAt: new Date(decisionAt).toISOString(),
    closedCandleRule: { applied: true, requestedTimestamp: new Date(timestamp).toISOString(), latestPrimaryCandleClose: new Date(decisionAt).toISOString(), detail: "Only candles whose source close timestamp is at or before the requested decision timestamp are included." },
    ohlcv: { timeframe, candles: primary, latest: current },
    indicatorAnalyses: analyses,
    marketCap: cap ? { availability: cap.availability, value: cap.marketCap, circulatingSupply: cap.circulatingSupply, sourceObservedAt: cap.sourceObservedAt, source: cap.provider } : { availability: "UNAVAILABLE", value: null },
    regime: regime ? { classification: regime.classification, score: regime.regimeScore, inputs: regime.inputs, definitionVersion: regime.definitionVersion, availability: regime.availability } : { classification: "UNAVAILABLE", availability: "UNAVAILABLE" },
    sector: sector ? { availability: sector.availability, sector: sector.sector, momentum: sector.sectorMomentum, rank: sector.sectorRank, relativeStrengthVsSector: sector.relativeStrengthVsSector, relativeStrengthVsBtc: sector.relativeStrengthVsBtc, definitionVersion: sector.definitionVersion } : { availability: "UNAVAILABLE" },
    score: { ...score, status: unavailable.length ? "PARTIAL_RECONSTRUCTION" : "FULL_RECONSTRUCTION", scoringConfigurationFingerprint: fingerprint(scoringConfiguration) },
    unavailable,
  };
}
