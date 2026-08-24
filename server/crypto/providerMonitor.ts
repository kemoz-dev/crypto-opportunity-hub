import { and, desc, eq } from "drizzle-orm";
import { providerMonitorChecks, providerMonitorExecutions, providerMonitors } from "../../drizzle/schema";
import { DEFAULT_ASSET_UNIVERSE, type Timeframe } from "../../shared/crypto";
import { getDb } from "../db";
import { fetchValidatedLiveOhlcv, getApprovedKrakenMappings, type LiveOhlcvMonitorOptions } from "./providers";

export const PROVIDER_MONITOR_NAME = "production-live-ohlcv-provider-health";
export const PROVIDER_MONITOR_CRON = "0 38 */4 * * *";
const MONITOR_INTERVAL_MS = 4 * 60 * 60_000;
const REPRESENTATIVE_SYMBOL = "BTC";
const REQUIRED_TIMEFRAMES: Timeframe[] = ["15m", "1h", "4h", "1d"];
const MINIMUM_CANDLES = 202;

type MonitorCheck = {
  provider: string;
  capability: "OHLCV";
  status: "live" | "stale" | "unavailable";
  httpStatus: number | null;
  classification: string | null;
  latencyMs: number;
  timeframe: Timeframe;
  symbolsTested: string[];
  fallbackUsed: boolean;
  dataQuality: "VALID" | "UNAVAILABLE";
  details: Record<string, unknown>;
  expectedUnavailable?: boolean;
};

export const providerMonitorConfiguration = () => ({
  version: "provider-monitor-v1",
  representativeSymbol: REPRESENTATIVE_SYMBOL,
  requiredTimeframes: REQUIRED_TIMEFRAMES,
  minimumCandles: MINIMUM_CANDLES,
  testedMappings: DEFAULT_ASSET_UNIVERSE.map(asset => asset.symbol),
  controlledCases: ["BINANCE_PRIMARY", "FORCED_BINANCE_451_KRAKEN_VALID", "FORCED_BINANCE_451_KRAKEN_UNAVAILABLE"],
  kraken: getApprovedKrakenMappings(),
});

function parseHttpStatus(message: string | undefined) {
  const value = message?.match(/HTTP\s+(\d{3})/)?.[1];
  return value ? Number(value) : null;
}

function timeframeMs(timeframe: Timeframe) {
  return { "15m": 15 * 60_000, "1h": 60 * 60_000, "4h": 4 * 60 * 60_000, "1d": 24 * 60 * 60_000 }[timeframe];
}

export async function executeProviderMonitorCheck(timeframe: Timeframe, monitorOptions: LiveOhlcvMonitorOptions = {}, controlCase = "BINANCE_PRIMARY"): Promise<MonitorCheck> {
  const startedAt = Date.now();
  const result = await fetchValidatedLiveOhlcv(REPRESENTATIVE_SYMBOL, timeframe, MINIMUM_CANDLES, 240, monitorOptions);
  const elapsed = Math.max(0, Date.now() - startedAt);
  const primary = result.statuses.find(status => status.provider === "Binance Futures");
  const fallback = result.statuses.find(status => status.provider === "Kraken Spot");
  const selected = result.series ? result.statuses.find(status => status.provider === result.series?.provider && status.status === "live") : fallback ?? primary;
  const freshnessMs = result.series ? Math.max(0, Date.now() - result.series.candles.at(-1)!.closeTime) : null;
  const fresh = freshnessMs === null ? false : freshnessMs <= timeframeMs(timeframe) * 3;
  const fallbackUsed = result.series?.provider === "Kraken Spot";
  const expectedUnavailable = Boolean(monitorOptions.forceKrakenUnavailable);
  const status: MonitorCheck["status"] = result.series ? fresh ? "live" : "stale" : "unavailable";
  return {
    provider: result.series?.provider ?? selected?.provider ?? "Kraken Spot",
    capability: "OHLCV",
    status,
    httpStatus: parseHttpStatus(selected?.message) ?? parseHttpStatus(primary?.message),
    classification: selected?.errorClass ?? primary?.errorClass ?? null,
    latencyMs: elapsed,
    timeframe,
    symbolsTested: [REPRESENTATIVE_SYMBOL, ...DEFAULT_ASSET_UNIVERSE.map(asset => asset.symbol).filter(symbol => symbol !== REPRESENTATIVE_SYMBOL)],
    fallbackUsed,
    dataQuality: result.series ? "VALID" : "UNAVAILABLE",
    expectedUnavailable,
    details: {
      controlCase,
      primaryStatus: primary ?? null,
      fallbackStatus: fallback ?? null,
      selectedProvider: result.series?.provider ?? null,
      fallbackAttempted: Boolean(fallback),
      freshnessMs,
      fresh,
      candleCount: result.series?.candles.length ?? 0,
      normalizationVersion: result.series?.normalizationVersion ?? null,
      mappingValidated: Object.prototype.hasOwnProperty.call(getApprovedKrakenMappings().mappings, REPRESENTATIVE_SYMBOL),
    },
  };
}

function monitorRunStatus(checks: MonitorCheck[]) {
  const unexpected = checks.filter(check => check.status !== "live" && !check.expectedUnavailable);
  return unexpected.length === 0 ? "SUCCESS" as const : checks.some(check => check.status === "live") ? "PARTIAL" as const : "FAILED" as const;
}

export function providerMonitorCheckRows(executionId: number, checks: MonitorCheck[]) {
  return checks.map(check => ({ executionId, provider: check.provider, capability: check.capability, status: check.status, httpStatus: check.httpStatus, classification: check.classification, latencyMs: check.latencyMs, timeframe: check.timeframe, symbolsTested: check.symbolsTested, fallbackUsed: check.fallbackUsed, dataQuality: check.dataQuality, details: { ...check.details, expectedUnavailable: check.expectedUnavailable ?? false } }));
}

export async function upsertProviderMonitorDefinition(taskUid: string, nextExecutionAt: string | null = null) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const nextRunAt = nextExecutionAt ? new Date(nextExecutionAt) : null;
  await db.insert(providerMonitors).values({ name: PROVIDER_MONITOR_NAME, scheduleCronTaskUid: taskUid, cronExpression: PROVIDER_MONITOR_CRON, isEnabled: true, configuration: providerMonitorConfiguration(), nextRunAt }).onDuplicateKeyUpdate({ set: { scheduleCronTaskUid: taskUid, cronExpression: PROVIDER_MONITOR_CRON, isEnabled: true, configuration: providerMonitorConfiguration(), nextRunAt, updatedAt: new Date() } });
  return (await db.select().from(providerMonitors).where(eq(providerMonitors.name, PROVIDER_MONITOR_NAME)).limit(1))[0];
}

export async function runProviderMonitorByTaskUid(taskUid: string, now = Date.now()) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const monitor = (await db.select().from(providerMonitors).where(eq(providerMonitors.scheduleCronTaskUid, taskUid)).limit(1))[0];
  if (!monitor) return { status: "SKIPPED" as const, reason: "orphan" };
  if (!monitor.isEnabled) return { status: "SKIPPED" as const, reason: "disabled" };
  const idempotencyKey = `${taskUid}:${Math.floor(now / MONITOR_INTERVAL_MS)}`;
  const existing = (await db.select().from(providerMonitorExecutions).where(and(eq(providerMonitorExecutions.monitorId, monitor.id), eq(providerMonitorExecutions.idempotencyKey, idempotencyKey))).limit(1))[0];
  if (existing) return { status: "SKIPPED" as const, reason: "duplicate", executionId: existing.id };
  const startedAt = new Date(now);
  await db.insert(providerMonitorExecutions).values({ monitorId: monitor.id, taskUid, idempotencyKey, executionKind: "SCHEDULED", status: "SKIPPED", startedAt, summary: { state: "running", configuration: monitor.configuration } });
  const execution = (await db.select().from(providerMonitorExecutions).where(and(eq(providerMonitorExecutions.monitorId, monitor.id), eq(providerMonitorExecutions.idempotencyKey, idempotencyKey))).limit(1))[0];
  try {
    const normal = await Promise.all(REQUIRED_TIMEFRAMES.map(timeframe => executeProviderMonitorCheck(timeframe)));
    const fallbackSuccess = await executeProviderMonitorCheck("15m", { forceBinance451: true }, "FORCED_BINANCE_451_KRAKEN_VALID");
    const fallbackUnavailable = await executeProviderMonitorCheck("15m", { forceBinance451: true, forceKrakenUnavailable: true }, "FORCED_BINANCE_451_KRAKEN_UNAVAILABLE");
    const checks = [...normal, fallbackSuccess, fallbackUnavailable];
    const status = monitorRunStatus(checks);
    await db.insert(providerMonitorChecks).values(providerMonitorCheckRows(execution.id, checks));
    const completedAt = new Date();
    const summary = { configuration: monitor.configuration, status, checks, fallbackVerified: fallbackSuccess.status === "live" && fallbackSuccess.fallbackUsed, unavailableVerified: fallbackUnavailable.status === "unavailable", normalPrimaryProviders: normal.map(check => check.provider) };
    await db.update(providerMonitorExecutions).set({ status, completedAt, durationMs: completedAt.getTime() - startedAt.getTime(), summary }).where(eq(providerMonitorExecutions.id, execution.id));
    await db.update(providerMonitors).set({ lastRunAt: completedAt, lastStatus: status, lastError: status === "SUCCESS" ? null : "One or more unexpected provider health checks were unavailable or stale.", updatedAt: completedAt }).where(eq(providerMonitors.id, monitor.id));
    return { status, executionId: execution.id, checks, fallbackVerified: summary.fallbackVerified, unavailableVerified: summary.unavailableVerified };
  } catch (error) {
    const completedAt = new Date();
    const message = error instanceof Error ? error.message : "Provider monitor failed.";
    await db.update(providerMonitorExecutions).set({ status: "FAILED", completedAt, durationMs: completedAt.getTime() - startedAt.getTime(), summary: { configuration: monitor.configuration, error: message } }).where(eq(providerMonitorExecutions.id, execution.id));
    await db.update(providerMonitors).set({ lastRunAt: completedAt, lastStatus: "FAILED", lastError: message, updatedAt: completedAt }).where(eq(providerMonitors.id, monitor.id));
    throw error;
  }
}

export async function getProviderMonitorSummary() {
  const db = await getDb();
  if (!db) return null;
  const monitor = (await db.select().from(providerMonitors).where(eq(providerMonitors.name, PROVIDER_MONITOR_NAME)).limit(1))[0];
  if (!monitor) return null;
  const execution = (await db.select().from(providerMonitorExecutions).where(eq(providerMonitorExecutions.monitorId, monitor.id)).orderBy(desc(providerMonitorExecutions.createdAt)).limit(1))[0] ?? null;
  const checks = execution ? await db.select().from(providerMonitorChecks).where(eq(providerMonitorChecks.executionId, execution.id)).orderBy(desc(providerMonitorChecks.createdAt)) : [];
  return { monitor, execution, checks };
}

export async function listProviderMonitorHistory(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  const monitor = (await db.select().from(providerMonitors).where(eq(providerMonitors.name, PROVIDER_MONITOR_NAME)).limit(1))[0];
  if (!monitor) return [];
  return db.select().from(providerMonitorExecutions).where(eq(providerMonitorExecutions.monitorId, monitor.id)).orderBy(desc(providerMonitorExecutions.createdAt)).limit(Math.min(Math.max(limit, 1), 100));
}
