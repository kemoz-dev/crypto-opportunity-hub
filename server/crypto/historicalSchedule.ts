import { and, eq } from "drizzle-orm";
import { historicalIngestionSchedules } from "../../drizzle/schema";
import type { Timeframe } from "../../shared/crypto";
import { getDb } from "../db";
import { runHistoricalIncremental } from "./historicalIngestion";
import { inheritHistoricalDatasetContext } from "./historicalContext";
import { recomputeHistoricalQuality } from "./historicalData";
import { refreshMarketUniverseCoverage, snapshotMarketUniverse } from "./marketUniverse";
import { createHistoricalScheduleExecution, finishHistoricalScheduleExecution } from "./ingestionObservability";

export const HISTORICAL_INGESTION_SCHEDULE_NAME = "daily-public-historical-btc-15m";
export const HISTORICAL_INGESTION_CRON = "0 12 2 * * *";
const COOLDOWN_MS = 45 * 60_000;
export type HistoricalScheduleConfiguration = { assetIds: string[]; timeframes: Timeframe[]; instrumentType: "spot" | "perpetual"; maximumMonths: number; lookbackDays: number; notes: string };
export type HistoricalScheduleDefinition = { name: string; cronExpression: string; configuration: HistoricalScheduleConfiguration };
export const DEFAULT_HISTORICAL_SCHEDULE_CONFIGURATION: HistoricalScheduleConfiguration = { assetIds: ["bitcoin"], timeframes: ["15m"], instrumentType: "perpetual", maximumMonths: 2, lookbackDays: 4, notes: "Daily bounded completed-archive incremental ingestion for BTC 15M. Other historical scopes remain explicitly coverage-labeled and can be backfilled separately." };
export const EXPANDED_HISTORICAL_SCHEDULES: HistoricalScheduleDefinition[] = [
  { name: "daily-public-historical-btc-15m", cronExpression: "0 12 2 * * *", configuration: DEFAULT_HISTORICAL_SCHEDULE_CONFIGURATION },
  { name: "daily-public-historical-eth-sol-15m", cronExpression: "0 32 2 * * *", configuration: { assetIds: ["ethereum", "solana"], timeframes: ["15m"], instrumentType: "perpetual", maximumMonths: 2, lookbackDays: 4, notes: "Daily bounded Tier 1 15M completed-archive incremental ingestion for ETH and SOL." } },
  { name: "daily-public-historical-liquid-1h", cronExpression: "0 52 2 * * *", configuration: { assetIds: ["ethereum", "binancecoin", "solana", "ripple", "cardano", "avalanche-2", "chainlink", "polkadot"], timeframes: ["1h"], instrumentType: "perpetual", maximumMonths: 2, lookbackDays: 4, notes: "Daily bounded Tier 1–2 1H completed-archive incremental ingestion. Per-asset failures are retained as partial results." } },
  { name: "daily-public-historical-sector-1h", cronExpression: "0 12 3 * * *", configuration: { assetIds: ["arbitrum", "optimism", "aave", "uniswap", "render-token", "ondo-finance", "the-graph", "axie-infinity", "filecoin", "dogecoin", "pepe"], timeframes: ["1h"], instrumentType: "perpetual", maximumMonths: 2, lookbackDays: 4, notes: "Daily bounded Tier 3–4 representative-sector 1H completed-archive incremental ingestion. Per-asset source availability is explicit." } },
];

export async function upsertHistoricalIngestionScheduleRecord(definition: HistoricalScheduleDefinition, taskUid: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  await db.insert(historicalIngestionSchedules).values({ name: definition.name, scheduleCronTaskUid: taskUid, cronExpression: definition.cronExpression, isEnabled: true, configuration: definition.configuration, lastStatus: null }).onDuplicateKeyUpdate({ set: { scheduleCronTaskUid: taskUid, cronExpression: definition.cronExpression, isEnabled: true, configuration: definition.configuration, updatedAt: new Date() } });
}

export async function createHistoricalIngestionScheduleRecord(taskUid: string) {
  const definition = EXPANDED_HISTORICAL_SCHEDULES.find(item => item.name === HISTORICAL_INGESTION_SCHEDULE_NAME);
  if (!definition) throw new Error("Default historical ingestion schedule definition is unavailable.");
  return upsertHistoricalIngestionScheduleRecord(definition, taskUid);
}

export async function evaluateHistoricalIngestionByTaskUid(taskUid: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const schedule = (await db.select().from(historicalIngestionSchedules).where(eq(historicalIngestionSchedules.scheduleCronTaskUid, taskUid)).limit(1))[0];
  if (!schedule) return { status: "SKIPPED" as const, reason: "orphan" };
  const startedAt = new Date();
  const execution = await createHistoricalScheduleExecution(schedule.id, taskUid, startedAt);
  if (!schedule.isEnabled) {
    await finishHistoricalScheduleExecution(execution.id, { status: "SKIPPED", skipReason: "disabled", assetsAttempted: 0, assetsSucceeded: 0, assetsFailed: 0, candlesInserted: 0, candlesSkipped: 0, duplicatesDetected: 0, gapsDetected: 0, providerErrors: [], retryCount: 0, startedAt });
    return { status: "SKIPPED" as const, reason: "disabled", scheduleId: schedule.id, executionId: execution.id };
  }
  const now = Date.now();
  if (schedule.lastRunAt && now - schedule.lastRunAt.getTime() < COOLDOWN_MS) {
    await finishHistoricalScheduleExecution(execution.id, { status: "SKIPPED", skipReason: "cooldown", assetsAttempted: 0, assetsSucceeded: 0, assetsFailed: 0, candlesInserted: 0, candlesSkipped: 0, duplicatesDetected: 0, gapsDetected: 0, providerErrors: [], retryCount: 0, startedAt });
    return { status: "SKIPPED" as const, reason: "cooldown", scheduleId: schedule.id, executionId: execution.id };
  }
  const configuration = schedule.configuration as HistoricalScheduleConfiguration;
  await db.update(historicalIngestionSchedules).set({ lastRunAt: new Date(now), lastStatus: "SKIPPED", lastError: null }).where(and(eq(historicalIngestionSchedules.id, schedule.id), eq(historicalIngestionSchedules.scheduleCronTaskUid, taskUid)));
  try {
    const result = await runHistoricalIncremental({ notes: `${configuration.notes} Scheduler task ${taskUid}; execution ${execution.id}.`, assetIds: configuration.assetIds, timeframes: configuration.timeframes, instrumentType: configuration.instrumentType, endAt: now, maximumMonths: configuration.maximumMonths, lookbackDays: configuration.lookbackDays, scheduleExecutionId: execution.id });
    const context = await inheritHistoricalDatasetContext(result.basedOnDatasetId, result.datasetId);
    const quality = await recomputeHistoricalQuality(result.datasetId);
    const coverage = await refreshMarketUniverseCoverage(result.datasetId);
    const universeSnapshot = await snapshotMarketUniverse(result.datasetId);
    const status = result.failedScopes.length ? "PARTIAL" as const : "SUCCESS" as const;
    await db.update(historicalIngestionSchedules).set({ lastDatasetId: result.datasetId, lastRunAt: new Date(), lastStatus: status, lastError: result.failedScopes.length ? result.failedScopes.map(scope => `${scope.assetId}/${scope.timeframe}: ${scope.error}`).join("; ") : null }).where(eq(historicalIngestionSchedules.id, schedule.id));
    const failedAssetIds = new Set(result.failedScopes.map(scope => scope.assetId));
    const completedAssetIds = new Set(result.completedScopes.map(scope => scope.assetId));
    const retryCount = [...result.completedScopes, ...result.failedScopes].filter(scope => scope.retryAttempt > 0).length;
    await finishHistoricalScheduleExecution(execution.id, { status, datasetId: result.datasetId, assetsAttempted: new Set(configuration.assetIds).size, assetsSucceeded: Array.from(completedAssetIds).filter(assetId => !failedAssetIds.has(assetId)).length, assetsFailed: failedAssetIds.size, candlesInserted: result.completedScopes.reduce((sum, scope) => sum + scope.insertedCount, 0), candlesSkipped: result.completedScopes.reduce((sum, scope) => sum + scope.duplicateCount, 0), duplicatesDetected: result.completedScopes.reduce((sum, scope) => sum + scope.duplicateCount, 0), gapsDetected: result.completedScopes.reduce((sum, scope) => sum + scope.missingIntervals, 0), providerErrors: result.failedScopes, retryCount, startedAt });
    return { status, scheduleId: schedule.id, executionId: execution.id, datasetId: result.datasetId, failedScopes: result.failedScopes.length, completedScopes: result.completedScopes.length, context, quality, coverage, universeSnapshotId: universeSnapshot.id };
  } catch (error) {
    const message = error instanceof Error ? error.message.replace(/https?:\/\/\S+/g, "provider endpoint") : "Historical ingestion failed.";
    await db.update(historicalIngestionSchedules).set({ lastStatus: "FAILED", lastError: message }).where(eq(historicalIngestionSchedules.id, schedule.id));
    await finishHistoricalScheduleExecution(execution.id, { status: "FAILED", assetsAttempted: 0, assetsSucceeded: 0, assetsFailed: 0, candlesInserted: 0, candlesSkipped: 0, duplicatesDetected: 0, gapsDetected: 0, providerErrors: [{ error: message }], retryCount: 0, startedAt });
    throw error;
  }
}
