import { and, desc, eq } from "drizzle-orm";
import { historicalDataQuality, historicalDatasets } from "../../drizzle/schema";
import { DEFAULT_ASSET_UNIVERSE, type Timeframe } from "../../shared/crypto";
import { getDb } from "../db";
import { createHistoricalDataset, ingestHistoricalCandleBatch, sealHistoricalDataset, timeframeMs, type InstrumentType } from "./historicalData";
import { fetchBinanceHistoricalArchiveRange } from "./providers";

export type HistoricalBackfillInput = {
  notes: string;
  assetIds?: string[];
  timeframes: Timeframe[];
  instrumentType: InstrumentType;
  startAt: number;
  endAt: number;
  maximumMonths?: number;
  basedOnDatasetId?: number;
};

export type HistoricalBackfillOutcome = {
  datasetId: number;
  datasetVersion: string;
  completedScopes: Array<{ assetId: string; timeframe: Timeframe; insertedCount: number; duplicateCount: number; malformedCount: number; missingIntervals: number; unavailableMonths: string[]; quality: string }>;
  failedScopes: Array<{ assetId: string; timeframe: Timeframe; error: string }>;
  sealed: boolean;
};

const sanitizeProviderError = (error: unknown) => error instanceof Error ? error.message.replace(/https?:\/\/\S+/g, "provider endpoint") : "Historical source request failed.";

export async function runHistoricalBackfill(input: HistoricalBackfillInput): Promise<HistoricalBackfillOutcome> {
  if (input.startAt >= input.endAt) throw new Error("Historical backfill start must precede its end.");
  if (!input.timeframes.length) throw new Error("Select at least one supported timeframe.");
  const assets = (input.assetIds?.length ? input.assetIds : DEFAULT_ASSET_UNIVERSE.map(asset => asset.id)).map(id => DEFAULT_ASSET_UNIVERSE.find(asset => asset.id === id)).filter((asset): asset is typeof DEFAULT_ASSET_UNIVERSE[number] => Boolean(asset));
  if (!assets.length) throw new Error("Select at least one supported historical asset.");
  const dataset = await createHistoricalDataset(input.notes, input.basedOnDatasetId);
  const completedScopes: HistoricalBackfillOutcome["completedScopes"] = [];
  const failedScopes: HistoricalBackfillOutcome["failedScopes"] = [];
  for (const asset of assets) {
    for (const timeframe of input.timeframes) {
      try {
        const fetched = await fetchBinanceHistoricalArchiveRange(asset.binanceSymbol, timeframe, input.instrumentType, input.startAt, input.endAt, input.maximumMonths ?? 48);
        const ingestion = await ingestHistoricalCandleBatch({ datasetId: dataset.id, assetId: asset.id, exchange: "Binance", provider: fetched.source, instrumentType: input.instrumentType, timeframe }, "backfill", fetched.candles, input.startAt, input.endAt);
        completedScopes.push({ assetId: asset.id, timeframe, insertedCount: ingestion.insertedCount, duplicateCount: ingestion.duplicateCount, malformedCount: ingestion.malformedCount, missingIntervals: ingestion.gaps.reduce((sum, gap) => sum + gap.expectedMissingCount, 0), unavailableMonths: fetched.unavailableMonths, quality: ingestion.quality });
      } catch (error) {
        failedScopes.push({ assetId: asset.id, timeframe, error: sanitizeProviderError(error) });
      }
    }
  }
  const sealed = await sealHistoricalDataset(dataset.id);
  return { datasetId: dataset.id, datasetVersion: dataset.version, completedScopes, failedScopes, sealed: Boolean(sealed.contentFingerprint) };
}

export async function runHistoricalIncremental(input: Omit<HistoricalBackfillInput, "startAt" | "basedOnDatasetId" | "maximumMonths"> & { maximumMonths?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const previous = (await db.select().from(historicalDatasets).where(eq(historicalDatasets.status, "sealed")).orderBy(desc(historicalDatasets.sealedAt)).limit(1))[0];
  if (!previous) throw new Error("Create an initial historical dataset before running an incremental collection.");
  const assets = (input.assetIds?.length ? input.assetIds : DEFAULT_ASSET_UNIVERSE.map(asset => asset.id)).map(id => DEFAULT_ASSET_UNIVERSE.find(asset => asset.id === id)).filter((asset): asset is typeof DEFAULT_ASSET_UNIVERSE[number] => Boolean(asset));
  if (!assets.length || !input.timeframes.length) throw new Error("Select at least one supported asset and timeframe.");
  const dataset = await createHistoricalDataset(input.notes, previous.id);
  const completedScopes: HistoricalBackfillOutcome["completedScopes"] = [];
  const failedScopes: HistoricalBackfillOutcome["failedScopes"] = [];
  for (const asset of assets) {
    for (const timeframe of input.timeframes) {
      try {
        const priorQuality = (await db.select().from(historicalDataQuality).where(and(eq(historicalDataQuality.datasetId, previous.id), eq(historicalDataQuality.assetId, asset.id), eq(historicalDataQuality.instrumentType, input.instrumentType), eq(historicalDataQuality.timeframe, timeframe))).limit(1))[0];
        const resumeAt = Math.max(input.endAt - 32 * 24 * 60 * 60_000, (priorQuality?.latestCandleAt?.getTime() ?? input.endAt - 32 * 24 * 60 * 60_000) - timeframeMs[timeframe]);
        const fetched = await fetchBinanceHistoricalArchiveRange(asset.binanceSymbol, timeframe, input.instrumentType, resumeAt, input.endAt, input.maximumMonths ?? 2);
        const ingestion = await ingestHistoricalCandleBatch({ datasetId: dataset.id, assetId: asset.id, exchange: "Binance", provider: fetched.source, instrumentType: input.instrumentType, timeframe }, "incremental", fetched.candles, resumeAt, input.endAt);
        completedScopes.push({ assetId: asset.id, timeframe, insertedCount: ingestion.insertedCount, duplicateCount: ingestion.duplicateCount, malformedCount: ingestion.malformedCount, missingIntervals: ingestion.gaps.reduce((sum, gap) => sum + gap.expectedMissingCount, 0), unavailableMonths: fetched.unavailableMonths, quality: ingestion.quality });
      } catch (error) {
        failedScopes.push({ assetId: asset.id, timeframe, error: sanitizeProviderError(error) });
      }
    }
  }
  const sealed = await sealHistoricalDataset(dataset.id);
  return { datasetId: dataset.id, datasetVersion: dataset.version, completedScopes, failedScopes, sealed: Boolean(sealed.contentFingerprint), basedOnDatasetId: previous.id };
}
