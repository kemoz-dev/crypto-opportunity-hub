import { and, eq } from "drizzle-orm";
import { historicalIngestionSchedules } from "../../drizzle/schema";
import type { Timeframe } from "../../shared/crypto";
import { getDb } from "../db";
import { runHistoricalIncremental } from "./historicalIngestion";

export const HISTORICAL_INGESTION_SCHEDULE_NAME = "daily-public-historical-btc-15m";
export const HISTORICAL_INGESTION_CRON = "0 12 2 * * *";
const COOLDOWN_MS = 45 * 60_000;
export type HistoricalScheduleConfiguration = { assetIds: string[]; timeframes: Timeframe[]; instrumentType: "spot" | "perpetual"; maximumMonths: number; notes: string };
export const DEFAULT_HISTORICAL_SCHEDULE_CONFIGURATION: HistoricalScheduleConfiguration = { assetIds: ["bitcoin"], timeframes: ["15m"], instrumentType: "perpetual", maximumMonths: 2, notes: "Daily bounded completed-archive incremental ingestion for BTC 15M. Other historical scopes remain explicitly coverage-labeled and can be backfilled separately." };

export async function createHistoricalIngestionScheduleRecord(taskUid: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  await db.insert(historicalIngestionSchedules).values({ name: HISTORICAL_INGESTION_SCHEDULE_NAME, scheduleCronTaskUid: taskUid, cronExpression: HISTORICAL_INGESTION_CRON, isEnabled: true, configuration: DEFAULT_HISTORICAL_SCHEDULE_CONFIGURATION, lastStatus: null }).onDuplicateKeyUpdate({ set: { scheduleCronTaskUid: taskUid, cronExpression: HISTORICAL_INGESTION_CRON, isEnabled: true, configuration: DEFAULT_HISTORICAL_SCHEDULE_CONFIGURATION, updatedAt: new Date() } });
}

export async function evaluateHistoricalIngestionByTaskUid(taskUid: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const schedule = (await db.select().from(historicalIngestionSchedules).where(eq(historicalIngestionSchedules.scheduleCronTaskUid, taskUid)).limit(1))[0];
  if (!schedule) return { status: "SKIPPED" as const, reason: "orphan" };
  if (!schedule.isEnabled) return { status: "SKIPPED" as const, reason: "disabled", scheduleId: schedule.id };
  const now = Date.now();
  if (schedule.lastRunAt && now - schedule.lastRunAt.getTime() < COOLDOWN_MS) return { status: "SKIPPED" as const, reason: "cooldown", scheduleId: schedule.id };
  const configuration = schedule.configuration as HistoricalScheduleConfiguration;
  await db.update(historicalIngestionSchedules).set({ lastRunAt: new Date(now), lastStatus: "SKIPPED", lastError: null }).where(and(eq(historicalIngestionSchedules.id, schedule.id), eq(historicalIngestionSchedules.scheduleCronTaskUid, taskUid)));
  try {
    const result = await runHistoricalIncremental({ notes: `${configuration.notes} Scheduler task ${taskUid}.`, assetIds: configuration.assetIds, timeframes: configuration.timeframes, instrumentType: configuration.instrumentType, endAt: now, maximumMonths: configuration.maximumMonths });
    const status = result.failedScopes.length ? "PARTIAL" as const : "SUCCESS" as const;
    await db.update(historicalIngestionSchedules).set({ lastDatasetId: result.datasetId, lastRunAt: new Date(), lastStatus: status, lastError: result.failedScopes.length ? result.failedScopes.map(scope => `${scope.assetId}/${scope.timeframe}: ${scope.error}`).join("; ") : null }).where(eq(historicalIngestionSchedules.id, schedule.id));
    return { status, scheduleId: schedule.id, datasetId: result.datasetId, failedScopes: result.failedScopes.length, completedScopes: result.completedScopes.length };
  } catch (error) {
    const message = error instanceof Error ? error.message.replace(/https?:\/\/\S+/g, "provider endpoint") : "Historical ingestion failed.";
    await db.update(historicalIngestionSchedules).set({ lastStatus: "FAILED", lastError: message }).where(eq(historicalIngestionSchedules.id, schedule.id));
    throw error;
  }
}
