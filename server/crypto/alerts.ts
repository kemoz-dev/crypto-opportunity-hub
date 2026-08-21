import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { alerts } from "../../drizzle/schema";
import { createHeartbeatJob, updateHeartbeatJob } from "../_core/heartbeat";
import { getDb } from "../db";
import { buildLiveScanner } from "./marketService";
import { getUserScoringConfig } from "./settings";

export const alertConditionsSchema = z.object({
  minimumOpportunity: z.number().min(0).max(100),
  minimumConfidence: z.number().min(0).max(100),
  minimumTechnical: z.number().min(0).max(40),
  assetIds: z.array(z.string()).max(50).default([]),
  cooldownMinutes: z.number().int().min(5).max(10_080),
});

export const alertInputSchema = z.object({
  name: z.string().trim().min(2).max(128),
  conditions: alertConditionsSchema,
  cron: z.string().trim().regex(/^\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+\S+$/, "Use a six-field UTC cron expression, for example: 0 */15 * * * *"),
});

type AlertConditions = z.infer<typeof alertConditionsSchema>;

export function qualifiesForAlert(score: { score: number; confidence: number; technicalScore: number }, assetId: string, conditions: AlertConditions) {
  return score.score >= conditions.minimumOpportunity && score.confidence >= conditions.minimumConfidence && score.technicalScore >= conditions.minimumTechnical && (conditions.assetIds.length === 0 || conditions.assetIds.includes(assetId));
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

export async function createAlert(userId: number, input: z.infer<typeof alertInputSchema>, userSession: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; alert cannot be created.");
  await db.insert(alerts).values({ userId, name: input.name, isEnabled: false, conditions: input.conditions });
  const alert = (await db.select().from(alerts).where(and(eq(alerts.userId, userId), eq(alerts.name, input.name))).limit(1))[0];
  if (!alert) throw new Error("Alert creation failed.");
  const canSchedule = process.env.NODE_ENV === "production";
  if (!canSchedule) return { alert, scheduleState: "publish-required" as const };
  const job = await createHeartbeatJob({ name: `crypto-alert-${userId}-${alert.id}`, cron: input.cron, path: "/api/scheduled/evaluate-alert", payload: {}, description: `Evaluate Crypto Opportunity Hub alert ${alert.name}` }, userSession);
  await db.update(alerts).set({ isEnabled: true, scheduleCronTaskUid: job.taskUid }).where(eq(alerts.id, alert.id));
  return { alert: await getAlert(alert.id, userId), scheduleState: "scheduled" as const, nextExecutionAt: job.nextExecutionAt ?? null };
}

export async function setAlertEnabled(userId: number, alertId: number, enabled: boolean, userSession: string) {
  const alert = await getAlert(alertId, userId);
  if (!alert.scheduleCronTaskUid) {
    if (process.env.NODE_ENV !== "production") throw new Error("This project must be published before alert schedules can be activated.");
    throw new Error("This alert has no schedule identifier; recreate it after publishing.");
  }
  await updateHeartbeatJob(alert.scheduleCronTaskUid, { enable: enabled }, userSession);
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

export async function evaluateAlert(alertId: number, expectedTaskUid?: string) {
  const alert = await getAlert(alertId);
  if (!alert.isEnabled && expectedTaskUid) return { triggered: false, skipped: "disabled" as const };
  if (expectedTaskUid && alert.scheduleCronTaskUid !== expectedTaskUid) throw new Error("Alert task identifier does not match this scheduled callback.");
  const conditions = parseConditions(alert.conditions);
  if (alert.lastTriggeredAt && Date.now() - alert.lastTriggeredAt.getTime() < conditions.cooldownMinutes * 60_000) return { triggered: false, skipped: "cooldown" as const };
  const configuration = await getUserScoringConfig(alert.userId);
  const scan = await buildLiveScanner(true, configuration);
  const matches = scan.rows.filter(row => row.score && qualifiesForAlert(row.score, row.asset.id, conditions));
  if (!matches.length) return { triggered: false, skipped: "threshold-not-met" as const, generatedAt: scan.generatedAt };
  const snapshot = { generatedAt: scan.generatedAt, conditions, scoringConfiguration: configuration, marketRegime: scan.marketRegime, matches: matches.map(row => ({ asset: { id: row.asset.id, symbol: row.asset.symbol, name: row.asset.name, price: row.asset.price, sector: row.asset.sector }, score: row.score ? { opportunity: row.score.score, confidence: row.score.confidence, technical: row.score.technicalScore, setup: row.score.setupType, confirmingSignals: row.score.reasons.filter(reason => reason.direction === "positive").slice(0, 4), risks: row.score.missingConditions } : null, dataStatus: row.dataStatus })) };
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; alert result cannot be stored.");
  await db.update(alerts).set({ lastTriggeredAt: new Date(scan.generatedAt), lastSignalSnapshot: snapshot }).where(eq(alerts.id, alert.id));
  return { triggered: true, snapshot };
}

export async function evaluateAlertByTaskUid(taskUid: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; scheduled alert cannot be evaluated.");
  const alert = (await db.select().from(alerts).where(eq(alerts.scheduleCronTaskUid, taskUid)).limit(1))[0];
  if (!alert) return { triggered: false, skipped: "orphan" as const };
  return evaluateAlert(alert.id, taskUid);
}
