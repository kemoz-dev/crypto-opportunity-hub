import { and, desc, eq } from "drizzle-orm";
import { historicalDataQuality, historicalDatasets } from "../../drizzle/schema";
import { type Timeframe } from "../../shared/crypto";
import { getDb } from "../db";
import { createHistoricalDataset, ingestHistoricalCandleBatch, sealHistoricalDataset, timeframeMs, type InstrumentType } from "./historicalData";
import { fetchBinanceHistoricalArchiveRange } from "./providers";
import { resolveEnabledUniverseAssets } from "./marketUniverse";
import { appendHistoricalIssueEvent, findOpenScopeIssues, recordHistoricalIngestionIssue } from "./ingestionObservability";

export type HistoricalBackfillInput = {
  notes: string;
  assetIds?: string[];
  timeframes: Timeframe[];
  instrumentType: InstrumentType;
  startAt: number;
  endAt: number;
  maximumMonths?: number;
  lookbackDays?: number;
  basedOnDatasetId?: number;
  scheduleExecutionId?: number;
  retryAttempt?: number;
};

export type HistoricalBackfillOutcome = {
  datasetId: number;
  datasetVersion: string;
  completedScopes: Array<{ assetId: string; timeframe: Timeframe; insertedCount: number; duplicateCount: number; malformedCount: number; missingIntervals: number; unavailableMonths: string[]; dailyFallbackDays: string[]; unavailableDays: string[]; quality: string; retryAttempt: number }>;
  failedScopes: Array<{ assetId: string; timeframe: Timeframe; error: string; retryAttempt: number }>;
  sealed: boolean;
};

const sanitizeProviderError = (error: unknown) => error instanceof Error ? error.message.replace(/https?:\/\/\S+/g, "provider endpoint") : "Historical source request failed.";

export async function runHistoricalBackfill(input: HistoricalBackfillInput): Promise<HistoricalBackfillOutcome> {
  if (input.startAt >= input.endAt) throw new Error("Historical backfill start must precede its end.");
  if (!input.timeframes.length) throw new Error("Select at least one supported timeframe.");
  const assets = await resolveEnabledUniverseAssets(input.assetIds);
  if (!assets.length) throw new Error("Select at least one supported historical asset.");
  const dataset = await createHistoricalDataset(input.notes, input.basedOnDatasetId);
  const completedScopes: HistoricalBackfillOutcome["completedScopes"] = [];
  const failedScopes: HistoricalBackfillOutcome["failedScopes"] = [];
  for (const asset of assets) {
    for (const timeframe of input.timeframes) {
      try {
        const fetched = await fetchBinanceHistoricalArchiveRange(asset.binanceSymbol, timeframe, input.instrumentType, input.startAt, input.endAt, input.maximumMonths ?? 48);
        const sourceDetails = { requestedMonths: fetched.requestedMonths, unavailableMonths: fetched.unavailableMonths, dailyFallbackDays: fetched.dailyFallbackDays, unavailableDays: fetched.unavailableDays };
        const ingestion = await ingestHistoricalCandleBatch({ datasetId: dataset.id, assetId: asset.id, exchange: "Binance", provider: fetched.source, instrumentType: input.instrumentType, timeframe, scheduleExecutionId: input.scheduleExecutionId, retryAttempt: input.retryAttempt }, "backfill", fetched.candles, input.startAt, input.endAt, sourceDetails);
        completedScopes.push({ assetId: asset.id, timeframe, insertedCount: ingestion.insertedCount, duplicateCount: ingestion.duplicateCount, malformedCount: ingestion.malformedCount, missingIntervals: ingestion.gaps.reduce((sum, gap) => sum + gap.expectedMissingCount, 0), unavailableMonths: fetched.unavailableMonths, dailyFallbackDays: fetched.dailyFallbackDays, unavailableDays: fetched.unavailableDays, quality: ingestion.quality, retryAttempt: input.retryAttempt ?? 0 });
      } catch (error) {
        failedScopes.push({ assetId: asset.id, timeframe, error: sanitizeProviderError(error), retryAttempt: input.retryAttempt ?? 0 });
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
  const assets = await resolveEnabledUniverseAssets(input.assetIds);
  if (!assets.length || !input.timeframes.length) throw new Error("Select at least one supported asset and timeframe.");
  const dataset = await createHistoricalDataset(input.notes, previous.id);
  const completedScopes: HistoricalBackfillOutcome["completedScopes"] = [];
  const failedScopes: HistoricalBackfillOutcome["failedScopes"] = [];
  const lookbackDays = Math.max(1, Math.min(input.lookbackDays ?? 4, 62));
  for (const asset of assets) {
    for (const timeframe of input.timeframes) {
      let resumeAt = input.endAt - lookbackDays * 24 * 60 * 60_000;
      const openIssues = await findOpenScopeIssues({ assetId: asset.id, instrumentType: input.instrumentType, timeframe });
      const retryAttempt = Math.max(input.retryAttempt ?? 0, ...openIssues.map(issue => issue.nextRetryAttempt));
      try {
        const priorQuality = (await db.select().from(historicalDataQuality).where(and(eq(historicalDataQuality.datasetId, previous.id), eq(historicalDataQuality.assetId, asset.id), eq(historicalDataQuality.instrumentType, input.instrumentType), eq(historicalDataQuality.timeframe, timeframe))).limit(1))[0];
        resumeAt = Math.max(input.endAt - lookbackDays * 24 * 60 * 60_000, (priorQuality?.latestCandleAt?.getTime() ?? input.endAt - lookbackDays * 24 * 60 * 60_000) - timeframeMs[timeframe]);
        const fetched = await fetchBinanceHistoricalArchiveRange(asset.binanceSymbol, timeframe, input.instrumentType, resumeAt, input.endAt, input.maximumMonths ?? 2);
        const sourceDetails = { requestedMonths: fetched.requestedMonths, unavailableMonths: fetched.unavailableMonths, dailyFallbackDays: fetched.dailyFallbackDays, unavailableDays: fetched.unavailableDays };
        const ingestion = await ingestHistoricalCandleBatch({ datasetId: dataset.id, assetId: asset.id, exchange: "Binance", provider: fetched.source, instrumentType: input.instrumentType, timeframe, scheduleExecutionId: input.scheduleExecutionId, retryAttempt }, "incremental", fetched.candles, resumeAt, input.endAt, sourceDetails);
        completedScopes.push({ assetId: asset.id, timeframe, insertedCount: ingestion.insertedCount, duplicateCount: ingestion.duplicateCount, malformedCount: ingestion.malformedCount, missingIntervals: ingestion.gaps.reduce((sum, gap) => sum + gap.expectedMissingCount, 0), unavailableMonths: fetched.unavailableMonths, dailyFallbackDays: fetched.dailyFallbackDays, unavailableDays: fetched.unavailableDays, quality: ingestion.quality, retryAttempt });
      } catch (error) {
        const message = sanitizeProviderError(error);
        await appendHistoricalIssueEvent(openIssues.map(issue => issue.id), { scheduleExecutionId: input.scheduleExecutionId, eventType: "RETRY_FAILED", retryAttempt, details: { error: message, expectedStartAt: resumeAt, expectedEndAt: input.endAt } });
        await recordHistoricalIngestionIssue({ datasetId: dataset.id, scheduleExecutionId: input.scheduleExecutionId, assetId: asset.id, exchange: "Binance", provider: "Binance public archive", instrumentType: input.instrumentType, timeframe, expectedStartAt: resumeAt, expectedEndAt: input.endAt }, "PROVIDER_FAILURE", message, 0, { failureStage: "incremental_fetch_or_persist", lookbackDays, retryAttempt });
        failedScopes.push({ assetId: asset.id, timeframe, error: message, retryAttempt });
      }
    }
  }
  const sealed = await sealHistoricalDataset(dataset.id);
  return { datasetId: dataset.id, datasetVersion: dataset.version, completedScopes, failedScopes, sealed: Boolean(sealed.contentFingerprint), basedOnDatasetId: previous.id };
}
