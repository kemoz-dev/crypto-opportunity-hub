import { and, desc, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { z } from "zod";
import { alertExecutions, alerts } from "../../drizzle/schema";
import type { DataStatus, ScannerResponse, ScoringConfig, Timeframe } from "../../shared/crypto";
import { getNotificationAdapter } from "../adapters/notifications";
import { getSchedulerAdapter } from "../adapters/scheduler";
import { getDb } from "../db";
import { buildLiveScanner } from "./marketService";
import { getUserScoringConfig } from "./settings";

export const alertConditionsSchema = z.object({
  minimumOpportunity: z.number().min(0).max(100),
  minimumConfidence: z.number().min(0).max(100),
  minimumTechnical: z.number().min(0).max(40),
  assetIds: z.array(z.string()).max(50).default([]),
  cooldownMinutes: z.number().int().min(5).max(10_080),
  requireNotRiskOff: z.boolean().default(false),
  requiredTimeframe: z.enum(["15m", "1h", "4h", "1d"]).optional(),
  requireBullishSetup: z.boolean().default(false),
  notificationEnabled: z.boolean().default(false),
});

export const alertInputSchema = z.object({
  name: z.string().trim().min(2).max(128),
  conditions: alertConditionsSchema,
  cron: z.string().trim().regex(/^\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+\S+$/, "Use a six-field UTC cron expression, for example: 0 */15 * * * *"),
});

type AlertConditions = z.infer<typeof alertConditionsSchema>;
type AlertScore = { score: number; confidence: number; technicalScore: number; direction: "bullish" | "neutral" | "bearish"; technicalByTimeframe: Array<{ timeframe: Timeframe; bias: "bullish" | "neutral" | "bearish" }> };
type OutcomeStatus = "SUCCESS" | "NO_MATCH" | "FAILED" | "SKIPPED";
type NotificationStatus = "not_requested" | "not_sent" | "sent" | "failed";

const unavailable = (reason: string) => ({ availability: "unavailable" as const, reason });
const immutableCopy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const compact = (value: number | null | undefined, decimals = 6) => value === null || value === undefined ? null : Number(value.toFixed(decimals));

export function createConfigurationIdentity(configuration: ScoringConfig) {
  const fingerprint = createHash("sha256").update(JSON.stringify(configuration)).digest("hex");
  return { version: `score-config-v1-${fingerprint.slice(0, 12)}`, fingerprint };
}

function dataProvenance(statuses: DataStatus[]) {
  return immutableCopy(statuses.map(status => ({ source: status.source, status: status.status, fetchedAt: new Date(status.fetchedAt).toISOString(), message: status.message ?? null })));
}

function marketRegimeSnapshot(scan: ScannerResponse) {
  const btc = scan.rows.find(row => row.asset.symbol === "BTC")?.asset;
  const reasons = scan.marketRegime?.reasons ?? [];
  const reason = (key: string) => reasons.find(item => item.key === key) ?? unavailable(`The ${key} regime input was unavailable at evaluation time.`);
  return immutableCopy({
    snapshotType: "POINT_IN_TIME_MARKET_REGIME",
    timestamp: new Date(scan.generatedAt).toISOString(),
    dataSources: dataProvenance(scan.dataStatus),
    inputs: {
      btcTrend24h: btc?.change24h ?? unavailable("BTC 24h trend was unavailable at evaluation time."),
      btcMomentum: btc ? { change1h: btc.change1h, change24h: btc.change24h, change7d: btc.change7d } : unavailable("BTC momentum inputs were unavailable at evaluation time."),
      btcDominance: scan.marketRegime?.btcDominance ?? unavailable("BTC dominance was unavailable at evaluation time."),
      totalMarketTrend: reason("total-market"),
      altcoinBreadth: scan.marketRegime?.breadth ?? unavailable("Breadth was unavailable at evaluation time."),
      marketVolume: unavailable("The current normalization layer does not model a market-wide volume regime."),
      volatilityRegime: unavailable("The current normalization layer does not model a market-wide volatility regime."),
    },
    final: scan.marketRegime ? { score: scan.marketRegime.score, classification: scan.marketRegime.classification, reasons: scan.marketRegime.reasons } : unavailable("Market regime was unavailable at evaluation time."),
  });
}

function sectorSnapshots(scan: ScannerResponse) {
  const btcChange = scan.rows.find(row => row.asset.symbol === "BTC")?.asset.change24h ?? null;
  const valuesBySector = new Map<string, number[]>();
  for (const row of scan.rows) {
    if (row.asset.change24h !== null) valuesBySector.set(row.asset.sector, [...(valuesBySector.get(row.asset.sector) ?? []), row.asset.change24h]);
  }
  const sectorAverages = Array.from(valuesBySector.entries()).map(([sector, values]) => ({ sector, momentum: values.reduce((sum, value) => sum + value, 0) / values.length }));
  const ranked = [...sectorAverages].sort((left, right) => right.momentum - left.momentum);
  return immutableCopy(scan.rows.map(row => {
    const sectorMomentum = sectorAverages.find(entry => entry.sector === row.asset.sector)?.momentum ?? null;
    const freshness = row.asset.lastUpdatedAt ? new Date(row.asset.lastUpdatedAt).toISOString() : unavailable("Asset update timestamp was unavailable at evaluation time.");
    return {
      assetId: row.asset.id,
      assetSymbol: row.asset.symbol,
      sector: row.asset.sector,
      sectorMomentum: compact(sectorMomentum),
      sectorRank: sectorMomentum === null ? unavailable("Sector momentum could not be ranked with the available data.") : ranked.findIndex(entry => entry.sector === row.asset.sector) + 1,
      assetRelativeStrengthVsSector: row.asset.change24h === null || sectorMomentum === null ? unavailable("Asset or sector 24h change was unavailable at evaluation time.") : compact(row.asset.change24h - sectorMomentum),
      assetRelativeStrengthVsBTC: row.asset.change24h === null || btcChange === null ? unavailable("Asset or BTC 24h change was unavailable at evaluation time.") : compact(row.asset.change24h - btcChange),
      sectorScore: row.score?.sectorScore ?? unavailable("Sector score was unavailable at evaluation time."),
      timestamp: new Date(scan.generatedAt).toISOString(),
      source: "CoinGecko markets",
      freshness,
      dataStatus: dataProvenance(row.dataStatus),
    };
  }));
}

function signalSnapshot(scan: ScannerResponse, row: ScannerResponse["rows"][number], configuration: ScoringConfig, configurationIdentity: ReturnType<typeof createConfigurationIdentity>, sectors: ReturnType<typeof sectorSnapshots>) {
  const score = row.score;
  if (!score) return null;
  const sector = sectors.find(item => item.assetId === row.asset.id) ?? unavailable("Sector state was unavailable at evaluation time.");
  return immutableCopy({
    snapshotType: "POINT_IN_TIME_SIGNAL",
    asset: { id: row.asset.id, symbol: row.asset.symbol, name: row.asset.name, sector: row.asset.sector, price: row.asset.price, marketCap: row.asset.marketCap, volume24h: row.asset.volume24h, change1h: row.asset.change1h, change24h: row.asset.change24h, change7d: row.asset.change7d, source: row.asset.provider, freshness: row.asset.lastUpdatedAt ? new Date(row.asset.lastUpdatedAt).toISOString() : unavailable("Price freshness was unavailable at evaluation time.") },
    timestamp: new Date(scan.generatedAt).toISOString(),
    scores: { opportunity: score.score, confidence: score.confidence, technical: score.technicalScore, market: score.momentumScore, sector: score.sectorScore, risk: score.riskScore },
    setup: { type: score.setupType, direction: score.direction, riskLevel: score.riskLevel, reasons: score.reasons, missingConditions: score.missingConditions },
    technicalState: score.technicalByTimeframe.map(analysis => ({ timeframe: analysis.timeframe, bias: analysis.bias, score: analysis.score, rsi: analysis.rsi, macdHistogram: analysis.macdHistogram, ema20: analysis.ema20, ema50: analysis.ema50, ema200: analysis.ema200, bollinger: analysis.bollinger, atrPercent: analysis.atrPercent, volumeExpansion: analysis.volumeExpansion, priceStructure: analysis.priceStructure, reasons: analysis.reasons })),
    multiTimeframe: { score: score.multiTimeframeScore, analyses: score.technicalByTimeframe.map(analysis => ({ timeframe: analysis.timeframe, bias: analysis.bias, score: analysis.score })) },
    marketRegime: marketRegimeSnapshot(scan),
    sectorState: sector,
    derivatives: { fundingRate: row.fundingRate, openInterest: row.openInterest },
    dataProvenance: { global: dataProvenance(scan.dataStatus), asset: dataProvenance(row.dataStatus) },
    scoringConfiguration: configuration,
    scoringConfigurationVersion: configurationIdentity,
  });
}

export function buildPointInTimeExecutionSnapshot(scan: ScannerResponse, configuration: ScoringConfig, conditions: AlertConditions, matchingRows: ScannerResponse["rows"]) {
  const configurationIdentity = createConfigurationIdentity(configuration);
  const sectors = sectorSnapshots(scan);
  const signals = matchingRows.map(row => signalSnapshot(scan, row, configuration, configurationIdentity, sectors)).filter((item): item is NonNullable<typeof item> => item !== null);
  return immutableCopy({
    snapshotType: "POINT_IN_TIME_ALERT_EXECUTION_V2",
    generatedAt: new Date(scan.generatedAt).toISOString(),
    conditions,
    assetsScanned: scan.rows.length,
    qualifyingOpportunities: signals.length,
    scoringConfiguration: configuration,
    scoringConfigurationVersion: configurationIdentity,
    marketRegime: marketRegimeSnapshot(scan),
    sectorSnapshots: sectors,
    signalSnapshots: signals,
    dataProvenance: { global: dataProvenance(scan.dataStatus), assetSources: scan.rows.map(row => ({ assetId: row.asset.id, statuses: dataProvenance(row.dataStatus) })) },
  });
}

export function qualifiesForAlert(score: AlertScore, assetId: string, conditions: AlertConditions, regime: string | null) {
  const correctTimeframe = !conditions.requiredTimeframe || score.technicalByTimeframe.some(analysis => analysis.timeframe === conditions.requiredTimeframe && analysis.bias === "bullish");
  return score.score >= conditions.minimumOpportunity && score.confidence >= conditions.minimumConfidence && score.technicalScore >= conditions.minimumTechnical && (conditions.assetIds.length === 0 || conditions.assetIds.includes(assetId)) && (!conditions.requireNotRiskOff || regime !== "RISK OFF") && (!conditions.requireBullishSetup || score.direction === "bullish") && correctTimeframe;
}

async function getAlert(alertId: number, userId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; alert status cannot be loaded.");
  const predicate = userId === undefined ? eq(alerts.id, alertId) : and(eq(alerts.id, alertId), eq(alerts.userId, userId));
  const row = (await db.select().from(alerts).where(predicate).limit(1))[0];
  if (!row) throw new Error("Alert was not found.");
  return row;
}

function parseConditions(value: unknown): AlertConditions {
  const parsed = alertConditionsSchema.safeParse(value);
  if (!parsed.success) throw new Error("Stored alert conditions are invalid.");
  return parsed.data;
}

async function recordAlertExecution(input: { alertId: number; outcomeStatus: OutcomeStatus; executionKind: "scheduled" | "manual"; triggered: boolean; startedAt: Date; executionSnapshot: unknown; assetsScanned?: number; qualifyingOpportunities?: number; configurationVersion?: string; configurationFingerprint?: string; marketRegimeSnapshot?: unknown; sectorSnapshots?: unknown; signalSnapshots?: unknown; dataProvenance?: unknown; notificationStatus: NotificationStatus; httpStatus: number; errorMessage?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; alert execution cannot be recorded.");
  const completedAt = new Date();
  const durationMs = completedAt.getTime() - input.startedAt.getTime();
  await db.insert(alertExecutions).values({ alertId: input.alertId, status: input.outcomeStatus === "FAILED" ? "failed" : "completed", outcomeStatus: input.outcomeStatus, executionKind: input.executionKind, triggered: input.triggered, httpStatus: input.httpStatus, durationMs, assetsScanned: input.assetsScanned ?? null, qualifyingOpportunities: input.qualifyingOpportunities ?? null, configurationVersion: input.configurationVersion ?? null, configurationFingerprint: input.configurationFingerprint ?? null, notificationStatus: input.notificationStatus, startedAt: input.startedAt, completedAt, marketRegimeSnapshot: input.marketRegimeSnapshot ?? null, sectorSnapshots: input.sectorSnapshots ?? null, signalSnapshots: input.signalSnapshots ?? null, dataProvenance: input.dataProvenance ?? null, executionSnapshot: immutableCopy(input.executionSnapshot), errorMessage: input.errorMessage ?? null });
  return { completedAt, durationMs };
}

export async function createAlert(userId: number, input: z.infer<typeof alertInputSchema>, userSession: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; alert cannot be created.");
  await db.insert(alerts).values({ userId, name: input.name, isEnabled: false, conditions: input.conditions });
  const alert = (await db.select().from(alerts).where(and(eq(alerts.userId, userId), eq(alerts.name, input.name))).orderBy(desc(alerts.id)).limit(1))[0];
  if (!alert) throw new Error("Alert creation failed.");
  const canSchedule = process.env.NODE_ENV === "production";
  if (!canSchedule) return { alert, scheduleState: "publish-required" as const };
  const job = await getSchedulerAdapter().create({ name: `crypto-alert-${userId}-${alert.id}`, cron: input.cron, path: "/api/scheduled/evaluate-alert", payload: {}, description: `Evaluate Crypto Opportunity Hub alert ${alert.name}` }, userSession);
  await db.update(alerts).set({ isEnabled: true, scheduleCronTaskUid: job.taskUid }).where(eq(alerts.id, alert.id));
  return { alert: await getAlert(alert.id, userId), scheduleState: "scheduled" as const, nextExecutionAt: job.nextExecutionAt ?? null };
}

export async function setAlertEnabled(userId: number, alertId: number, enabled: boolean, userSession: string) {
  const alert = await getAlert(alertId, userId);
  if (!alert.scheduleCronTaskUid) {
    if (process.env.NODE_ENV !== "production") throw new Error("This project must be published before alert schedules can be activated.");
    throw new Error("This alert has no schedule identifier; recreate it after publishing.");
  }
  await getSchedulerAdapter().update(alert.scheduleCronTaskUid, { enable: enabled }, userSession);
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; alert cannot be updated.");
  await db.update(alerts).set({ isEnabled: enabled }).where(eq(alerts.id, alert.id));
  return { success: true, enabled };
}

export async function listAlerts(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(alerts).where(eq(alerts.userId, userId));
}

export async function listAlertExecutions(userId: number, alertId: number) {
  const alert = await getAlert(alertId, userId);
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(alertExecutions).where(eq(alertExecutions.alertId, alertId)).orderBy(desc(alertExecutions.createdAt)).limit(50);
  return rows.map(row => ({ ...row, alertName: alert.name }));
}

export async function getAlertExecution(userId: number, alertId: number, executionId: number) {
  const alert = await getAlert(alertId, userId);
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; execution cannot be loaded.");
  const row = (await db.select().from(alertExecutions).where(and(eq(alertExecutions.id, executionId), eq(alertExecutions.alertId, alert.id))).limit(1))[0];
  if (!row) throw new Error("Alert execution was not found.");
  return { ...row, alertName: alert.name };
}

export async function evaluateAlert(alertId: number, expectedTaskUid?: string) {
  const startedAt = new Date();
  const executionKind = expectedTaskUid ? "scheduled" as const : "manual" as const;
  let alert: Awaited<ReturnType<typeof getAlert>> | undefined;
  try {
    alert = await getAlert(alertId);
    if (!alert.isEnabled && expectedTaskUid) {
      const result = { snapshotType: "POINT_IN_TIME_ALERT_EXECUTION_V2", triggered: false, skipped: "disabled" as const, generatedAt: startedAt.toISOString() };
      await recordAlertExecution({ alertId: alert.id, outcomeStatus: "SKIPPED", executionKind, triggered: false, startedAt, executionSnapshot: result, notificationStatus: "not_requested", httpStatus: 200 });
      return result;
    }
    if (expectedTaskUid && alert.scheduleCronTaskUid !== expectedTaskUid) throw new Error("Alert task identifier does not match this scheduled callback.");
    const conditions = parseConditions(alert.conditions);
    if (alert.lastTriggeredAt && Date.now() - alert.lastTriggeredAt.getTime() < conditions.cooldownMinutes * 60_000) {
      const result = { snapshotType: "POINT_IN_TIME_ALERT_EXECUTION_V2", triggered: false, skipped: "cooldown" as const, generatedAt: startedAt.toISOString(), conditions, lastTriggeredAt: alert.lastTriggeredAt };
      await recordAlertExecution({ alertId: alert.id, outcomeStatus: "SKIPPED", executionKind, triggered: false, startedAt, executionSnapshot: result, notificationStatus: "not_requested", httpStatus: 200 });
      return result;
    }
    const configuration = await getUserScoringConfig(alert.userId);
    const scan = await buildLiveScanner(true, configuration);
    const matches = scan.rows.filter(row => row.score && qualifiesForAlert(row.score as AlertScore, row.asset.id, conditions, scan.marketRegime?.classification ?? null));
    const snapshot = buildPointInTimeExecutionSnapshot(scan, configuration, conditions, matches);
    const configurationIdentity = createConfigurationIdentity(configuration);
    if (!matches.length) {
      const result = { ...snapshot, triggered: false, skipped: "threshold-not-met" as const, notificationStatus: conditions.notificationEnabled ? "not_sent" as const : "not_requested" as const };
      await recordAlertExecution({ alertId: alert.id, outcomeStatus: "NO_MATCH", executionKind, triggered: false, startedAt, executionSnapshot: result, assetsScanned: snapshot.assetsScanned, qualifyingOpportunities: 0, configurationVersion: configurationIdentity.version, configurationFingerprint: configurationIdentity.fingerprint, marketRegimeSnapshot: snapshot.marketRegime, sectorSnapshots: snapshot.sectorSnapshots, signalSnapshots: [], dataProvenance: snapshot.dataProvenance, notificationStatus: result.notificationStatus, httpStatus: 200 });
      return result;
    }
    let notificationStatus: NotificationStatus = "not_requested";
    if (conditions.notificationEnabled) {
      try {
        notificationStatus = (await getNotificationAdapter().notifyOwner({ title: `Crypto alert: ${alert.name}`, content: `${matches.length} configured opportunity match(es) at ${new Date(scan.generatedAt).toISOString()}. No paper or real trade was created.` })).accepted ? "sent" : "failed";
      } catch {
        notificationStatus = "failed";
      }
    }
    const result = { ...snapshot, triggered: true, notificationStatus };
    const db = await getDb();
    if (!db) throw new Error("Database is unavailable; alert result cannot be stored.");
    await db.update(alerts).set({ lastTriggeredAt: new Date(scan.generatedAt), lastSignalSnapshot: immutableCopy(result) }).where(eq(alerts.id, alert.id));
    await recordAlertExecution({ alertId: alert.id, outcomeStatus: "SUCCESS", executionKind, triggered: true, startedAt, executionSnapshot: result, assetsScanned: snapshot.assetsScanned, qualifyingOpportunities: snapshot.qualifyingOpportunities, configurationVersion: configurationIdentity.version, configurationFingerprint: configurationIdentity.fingerprint, marketRegimeSnapshot: snapshot.marketRegime, sectorSnapshots: snapshot.sectorSnapshots, signalSnapshots: snapshot.signalSnapshots, dataProvenance: snapshot.dataProvenance, notificationStatus, httpStatus: 200 });
    return result;
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message : "Alert evaluation failed.";
    if (alert) {
      const result = { snapshotType: "POINT_IN_TIME_ALERT_EXECUTION_V2", triggered: false, error: "ALERT_EVALUATION_FAILED", generatedAt: startedAt.toISOString(), marketRegime: unavailable("Evaluation failed before a point-in-time market-regime snapshot could be completed."), sectorSnapshots: [], signalSnapshots: [], dataProvenance: [] };
      await recordAlertExecution({ alertId: alert.id, outcomeStatus: "FAILED", executionKind, triggered: false, startedAt, executionSnapshot: result, marketRegimeSnapshot: result.marketRegime, sectorSnapshots: result.sectorSnapshots, signalSnapshots: result.signalSnapshots, dataProvenance: result.dataProvenance, notificationStatus: "not_requested", httpStatus: 500, errorMessage: safeMessage });
    }
    throw error;
  }
}

export async function evaluateAlertByTaskUid(taskUid: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; scheduled alert cannot be evaluated.");
  const alert = (await db.select().from(alerts).where(eq(alerts.scheduleCronTaskUid, taskUid)).limit(1))[0];
  if (!alert) return { triggered: false, skipped: "orphan" as const };
  return evaluateAlert(alert.id, taskUid);
}
