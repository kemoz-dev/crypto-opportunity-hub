import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { autoPaperEvents, autoPaperSettings, autoPaperTrials, paperPortfolios, paperTrades } from "../../drizzle/schema";
import type { ScoringConfig } from "../../shared/crypto";
import { getDb } from "../db";
import { cloneImmutableEntrySnapshot } from "./paperTrading";
import type { AdaptiveTradingMode } from "./adaptiveQualification";
import type { TradeSetupPlan, TradeSetupMode } from "./tradeSetup";
import { buildLiveScanner, getScannerLiveOhlcvBundle } from "./marketService";
import { getTradeSetupForRow } from "./tradeSetup";
import { qualifyAdaptive } from "./adaptiveQualification";

export const AUTO_PAPER_SOURCE = "AUTO_PAPER" as const;
export const AUTO_PAPER_DEFAULTS = {
  enabled: false,
  mode: "BALANCED" as const,
  maxPositions: 1,
  minSetupQuality: 70,
  minRewardRisk: 1.5,
  strategies: ["SCALP", "SWING"] as string[],
  directions: ["LONG", "SHORT"] as string[],
  allowPotential: false,
  riskPercent: 1,
};

export const AUTO_PAPER_MODES = ["CONSERVATIVE", "BALANCED", "OPPORTUNITY", "CUSTOM"] as const;
const settingsInput = {
  enabled: z.boolean().default(false),
  mode: z.enum(AUTO_PAPER_MODES).default("BALANCED"),
  maxPositions: z.union([z.literal(1), z.literal(3), z.literal(5), z.literal(10)]).default(1),
  minSetupQuality: z.number().min(0).max(100).default(70),
  minRewardRisk: z.number().positive().max(100).default(1.5),
  strategies: z.array(z.enum(["SCALP", "SWING", "15M FAST SCALP"])).min(1).max(3).default(["SCALP", "SWING"]),
  directions: z.array(z.enum(["LONG", "SHORT"])).min(1).max(2).default(["LONG", "SHORT"]),
  allowPotential: z.boolean().default(false),
  riskPercent: z.union([z.literal(0.5), z.literal(1), z.literal(2)]).default(1),
};

import { z } from "zod";
export const autoPaperSettingsSchema = z.object(settingsInput);
export type AutoPaperSettingsInput = z.input<typeof autoPaperSettingsSchema>;
export type AutoPaperSettings = z.output<typeof autoPaperSettingsSchema>;

function normalizeSettings(value: unknown): AutoPaperSettings {
  const parsed = autoPaperSettingsSchema.safeParse(value);
  return parsed.success ? parsed.data : autoPaperSettingsSchema.parse(AUTO_PAPER_DEFAULTS);
}

export async function getAutoPaperSettings(userId: number): Promise<AutoPaperSettings> {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; Auto Paper settings cannot be loaded.");
  const row = (await db.select().from(autoPaperSettings).where(eq(autoPaperSettings.userId, userId)).limit(1))[0];
  return row ? normalizeSettings(row) : autoPaperSettingsSchema.parse(AUTO_PAPER_DEFAULTS);
}

export async function saveAutoPaperSettings(userId: number, input: AutoPaperSettingsInput): Promise<AutoPaperSettings> {
  const validated = autoPaperSettingsSchema.parse(input);
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; Auto Paper settings cannot be saved.");
  await db.insert(autoPaperSettings).values({ userId, ...validated }).onDuplicateKeyUpdate({ set: validated });
  return validated;
}

async function getOrCreatePaperPortfolio(userId: number, paperCapital: number, db: any) {
  if (!db) throw new Error("Database is unavailable; Auto Paper cannot be created.");
  const existing = (await db.select().from(paperPortfolios).where(eq(paperPortfolios.userId, userId)).orderBy(asc(paperPortfolios.id)).limit(1))[0];
  if (existing) return existing;
  await db.insert(paperPortfolios).values({ userId, name: "Primary paper portfolio", startingCapital: paperCapital, currentEquity: paperCapital });
  const created = (await db.select().from(paperPortfolios).where(eq(paperPortfolios.userId, userId)).orderBy(asc(paperPortfolios.id)).limit(1))[0];
  if (!created) throw new Error("Paper portfolio creation failed.");
  return created;
}

function planStrategy(plan: TradeSetupPlan) { return plan.mode === "SCALP" ? "SCALP" : "SWING"; }
function planIdentity(plan: TradeSetupPlan) { return `${plan.assetId}:${plan.direction}:${planStrategy(plan)}:${plan.timeframes.execution}:${plan.dataTimestamp ?? "NO_TIMESTAMP"}:${plan.setupType}`; }
function validAutoPlan(plan: TradeSetupPlan, settings: AutoPaperSettings) {
  const direction = plan.direction;
  const strategy = planStrategy(plan);
  const quality = plan.tradeSetupQuality;
  return plan.availability === "LIVE" && plan.dataBundle.coherent && plan.dataBundle.eligibleForScoring && plan.currentPrice !== null && (direction === "LONG" || direction === "SHORT") && plan.entryZone !== null && plan.stop !== null && plan.targets.length > 0 && plan.rewardRisk !== null && plan.rewardRisk >= settings.minRewardRisk && quality !== null && quality >= settings.minSetupQuality && settings.strategies.includes(strategy) && settings.directions.includes(direction) && (plan.actionable || settings.allowPotential);
}

function positionSize(entryPrice: number, stopPrice: number, equity: number, riskPercent: number) {
  const riskDistance = Math.abs(entryPrice - stopPrice);
  if (!Number.isFinite(riskDistance) || riskDistance <= 0) throw new Error("Auto Paper requires a valid non-zero stop distance.");
  return Number(((equity * riskPercent / 100) / riskDistance).toFixed(8));
}

export async function createAutoPaperTrial(userId: number, plan: TradeSetupPlan, configuration: ScoringConfig, settingsInputValue?: AutoPaperSettingsInput) {
  const settings = settingsInputValue ? autoPaperSettingsSchema.parse(settingsInputValue) : await getAutoPaperSettings(userId);
  if (!settings.enabled) throw new Error("Auto Paper is disabled for this user.");
  if (!validAutoPlan(plan, settings)) throw new Error("The current validated setup does not satisfy the Auto Paper requirements.");
  if (plan.direction === "NO TRADE" || !plan.entryZone || !plan.stop || !plan.targets[0] || plan.currentPrice === null || plan.tradeSetupQuality === null || plan.rewardRisk === null) throw new Error("A complete validated Auto Paper plan is required.");
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; Auto Paper cannot be created.");
  const identity = planIdentity(plan);
  const existing = (await db.select().from(autoPaperTrials).where(and(eq(autoPaperTrials.userId, userId), eq(autoPaperTrials.setupIdentity, identity))).limit(1))[0];
  if (existing && ["OPEN", "HEALTHY", "WARNING", "REVERSAL_RISK", "TARGET_1_REACHED", "TARGET_2_REACHED", "TARGET_3_REACHED"].includes(existing.status)) return { created: false as const, duplicate: true as const, trial: existing };
  const active = await db.select({ count: sql<number>`count(*)` }).from(autoPaperTrials).where(and(eq(autoPaperTrials.userId, userId), inArray(autoPaperTrials.status, ["OPEN", "HEALTHY", "WARNING", "REVERSAL_RISK", "TARGET_1_REACHED", "TARGET_2_REACHED", "TARGET_3_REACHED"])));
  if (Number(active[0]?.count ?? 0) >= settings.maxPositions) throw new Error("The configured maximum number of simultaneous Auto Paper positions has been reached.");
  const entry = plan.entryZone.preferred;
  const stop = plan.stop.price;
  const targets = plan.targets.slice(0, 3);
  const tradeDirection: "long" | "short" = plan.direction === "LONG" ? "long" : "short";
  const paperSide: "long" | "short" = tradeDirection;
  const strategy: "SCALP" | "SWING" = planStrategy(plan) as "SCALP" | "SWING";
  const validatedRewardRisk = plan.rewardRisk;
  const validatedSetupQuality = plan.tradeSetupQuality;
  const now = Date.now();
  return db.transaction(async tx => {
    const portfolio = await getOrCreatePaperPortfolio(userId, configuration.paperCapital, tx);
    const size = positionSize(entry, stop, portfolio.currentEquity, settings.riskPercent);
    const snapshot = cloneImmutableEntrySnapshot({ source: AUTO_PAPER_SOURCE, createdAt: now, plan });
    const insertedTrade = await tx.insert(paperTrades).values([{ portfolioId: portfolio.id, assetId: plan.assetId, status: "open" as const, side: paperSide, entryAt: new Date(now), entryPrice: entry, stopLoss: stop, takeProfit: targets.map(target => ({ label: target.label, price: target.price })), positionSize: size, riskPercent: settings.riskPercent, rewardRisk: validatedRewardRisk, immutableEntrySnapshot: snapshot }]);
    const paperTradeId = Number(insertedTrade[0].insertId);
    const trialValues: typeof autoPaperTrials.$inferInsert = { userId, paperTradeId, setupIdentity: identity, assetId: plan.assetId, direction: tradeDirection, strategy, timeframe: plan.timeframes.execution, source: AUTO_PAPER_SOURCE, status: "OPEN", immutablePlanSnapshot: cloneImmutableEntrySnapshot(plan), immutableEntrySnapshot: snapshot, currentSnapshot: { observedAt: now, status: "OPEN", price: entry }, entryPrice: entry, stopPrice: stop, target1: targets[0]?.price, target2: targets[1]?.price, target3: targets[2]?.price, setupQuality: validatedSetupQuality, rewardRisk: validatedRewardRisk, provider: plan.provider ?? "UNAVAILABLE", provenance: plan.dataBundle, freshness: plan.availability, startedAt: new Date(now) };
    const insertedTrial = await tx.insert(autoPaperTrials).values(trialValues);
    const trialId = Number(insertedTrial[0].insertId);
    await tx.insert(autoPaperEvents).values([{ trialId, eventKey: "TRIAL_CREATED", eventType: "TRIAL_CREATED", reason: "Validated setup satisfied the enabled Auto Paper requirements.", price: entry, timeframe: plan.timeframes.execution, provider: plan.provider ?? undefined, freshness: plan.availability, provenance: plan.dataBundle }]);
    return { created: true as const, duplicate: false as const, trialId, paperTradeId, identity, source: AUTO_PAPER_SOURCE, snapshot };
  });
}

export async function evaluateAndCreateAutoPaperTrial(userId: number, assetId: string, mode: TradeSetupMode, configuration: ScoringConfig) {
  const settings = await getAutoPaperSettings(userId);
  if (!settings.enabled) throw new Error("Auto Paper is disabled for this user.");
  const scan = await buildLiveScanner(false, configuration);
  const row = scan.rows.find(candidate => candidate.asset.id === assetId);
  if (!row) throw new Error("The requested canonical asset is not available in the current server scan.");
  const plan = await getTradeSetupForRow(mode, row, scan.marketRegime, configuration, undefined, getScannerLiveOhlcvBundle(scan, row.asset.symbol));
  const adaptive = qualifyAdaptive(plan);
  return { assetId, mode, adaptive, trial: adaptive.eligibleForAutoPaper ? await createAutoPaperTrial(userId, plan, configuration, settings) : null };
}

export async function getAutoPaperHistory(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; Auto Paper history cannot be loaded.");
  return db.select().from(autoPaperTrials).where(eq(autoPaperTrials.userId, userId)).orderBy(desc(autoPaperTrials.createdAt));
}

export async function recordAutoPaperEvent(userId: number, trialId: number, event: { eventKey: string; eventType: string; reason: string; price?: number | null; timeframe?: string | null; provider?: string | null; freshness?: string | null; provenance?: unknown }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; Auto Paper events cannot be recorded.");
  const trial = (await db.select().from(autoPaperTrials).where(and(eq(autoPaperTrials.id, trialId), eq(autoPaperTrials.userId, userId))).limit(1))[0];
  if (!trial) throw new Error("Auto Paper trial not found in this private account.");
  const known = (await db.select({ eventKey: autoPaperEvents.eventKey }).from(autoPaperEvents).where(and(eq(autoPaperEvents.trialId, trialId), eq(autoPaperEvents.eventKey, event.eventKey))).limit(1))[0];
  if (known) return { recorded: false as const, duplicate: true as const, eventKey: event.eventKey };
  await db.insert(autoPaperEvents).values({ trialId, ...event });
  return { recorded: true as const, duplicate: false as const, eventKey: event.eventKey };
}

const ACTIVE_TRIAL_STATUSES = ["OPEN", "HEALTHY", "WARNING", "REVERSAL_RISK", "TARGET_1_REACHED", "TARGET_2_REACHED", "TARGET_3_REACHED", "DATA_UNAVAILABLE"] as const;

export function currentTrialStatus(trial: typeof autoPaperTrials.$inferSelect, price: number) {
  const direction = trial.direction;
  const targets = [trial.target1, trial.target2, trial.target3].filter((value): value is number => value !== null).sort((left, right) => direction === "long" ? left - right : right - left);
  const reached = targets.reduce((count, target) => count + (direction === "long" ? (price >= target ? 1 : 0) : (price <= target ? 1 : 0)), 0);
  const stopReached = direction === "long" ? price <= trial.stopPrice : price >= trial.stopPrice;
  if (stopReached) return { status: "INVALIDATED" as const, eventType: "STOP_REACHED", reason: `Validated current price ${price} crossed the recorded stop/invalidation ${trial.stopPrice}.`, reached };
  if (reached >= 3) return { status: "TARGET_3_REACHED" as const, eventType: "TARGET_3_REACHED", reason: `Validated current price ${price} reached all recorded target levels.`, reached };
  if (reached === 2) return { status: "TARGET_2_REACHED" as const, eventType: "TARGET_2_REACHED", reason: `Validated current price ${price} reached the second recorded target.`, reached };
  if (reached === 1) return { status: "TARGET_1_REACHED" as const, eventType: "TARGET_1_REACHED", reason: `Validated current price ${price} reached the first recorded target.`, reached };
  const riskDistance = Math.abs(trial.entryPrice - trial.stopPrice);
  const adverseDistance = direction === "long" ? trial.entryPrice - price : price - trial.entryPrice;
  if (adverseDistance >= riskDistance * 0.75) return { status: "REVERSAL_RISK" as const, eventType: "REVERSAL_WARNING", reason: `Validated price moved ${((adverseDistance / riskDistance) * 100).toFixed(1)}% of the stop distance against the recorded plan.`, reached };
  if (adverseDistance >= riskDistance * 0.5) return { status: "WARNING" as const, eventType: "HEALTH_CHANGED", reason: `Validated price moved ${((adverseDistance / riskDistance) * 100).toFixed(1)}% of the stop distance against the recorded plan.`, reached };
  return { status: "HEALTHY" as const, eventType: "HEALTH_CHANGED", reason: "Validated current price remains within the recorded plan’s non-terminal risk path.", reached };
}

async function recordEventIfAbsent(db: any, trial: typeof autoPaperTrials.$inferSelect, event: { eventKey: string; eventType: string; reason: string; price: number; provider?: string | null; freshness?: string | null; provenance?: unknown }) {
  const existing = (await db.select({ id: autoPaperEvents.id }).from(autoPaperEvents).where(and(eq(autoPaperEvents.trialId, trial.id), eq(autoPaperEvents.eventKey, event.eventKey))).limit(1))[0];
  if (existing) return false;
  await db.insert(autoPaperEvents).values([{ trialId: trial.id, eventKey: event.eventKey, eventType: event.eventType, reason: event.reason, price: event.price, timeframe: trial.timeframe, provider: event.provider ?? trial.provider, freshness: event.freshness ?? trial.freshness, provenance: event.provenance ?? trial.provenance }]);
  return true;
}

export async function refreshAutoPaperTrial(userId: number, trialId: number, configuration: ScoringConfig) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; Auto Paper cannot be refreshed.");
  const trial = (await db.select().from(autoPaperTrials).where(and(eq(autoPaperTrials.id, trialId), eq(autoPaperTrials.userId, userId))).limit(1))[0];
  if (!trial) throw new Error("Auto Paper trial not found in this private account.");
  if (!ACTIVE_TRIAL_STATUSES.includes(trial.status as typeof ACTIVE_TRIAL_STATUSES[number])) return { trial, refreshed: false as const, reason: "terminal" as const, recordedEvents: [] };
  const scan = await buildLiveScanner(false, configuration);
  const row = scan.rows.find(candidate => candidate.asset.id === trial.assetId);
  const bundle = row ? getScannerLiveOhlcvBundle(scan, row.asset.symbol) : null;
  if (!row || row.asset.price === null || !bundle?.coherent || !bundle.eligibleForScoring) {
    const currentSnapshot = { observedAt: Date.now(), status: "DATA_UNAVAILABLE", price: row?.asset.price ?? null, provider: bundle?.provider ?? null, dataQuality: bundle?.state ?? "NO_DATA", reason: bundle?.statusMessage ?? "The authoritative scan did not return a validated current row." };
    await db.update(autoPaperTrials).set({ currentSnapshot, status: "DATA_UNAVAILABLE" }).where(and(eq(autoPaperTrials.id, trial.id), eq(autoPaperTrials.userId, userId)));
    const recorded = await recordEventIfAbsent(db, trial, { eventKey: "DATA_UNAVAILABLE", eventType: "DATA_UNAVAILABLE", reason: currentSnapshot.reason, price: row?.asset.price ?? trial.entryPrice, provider: bundle?.provider, freshness: bundle?.state, provenance: bundle });
    return { trial: { ...trial, currentSnapshot, status: "DATA_UNAVAILABLE" as const }, refreshed: true as const, recordedEvents: recorded ? ["DATA_UNAVAILABLE"] : [] };
  }
  const observation = currentTrialStatus(trial, row.asset.price);
  const currentSnapshot = { observedAt: scan.generatedAt, status: observation.status, price: row.asset.price, provider: bundle.provider, dataQuality: bundle.state, reason: observation.reason, reachedTargets: observation.reached };
  await db.update(autoPaperTrials).set({ currentSnapshot, status: observation.status, completedAt: observation.status === "INVALIDATED" ? new Date(scan.generatedAt) : undefined }).where(and(eq(autoPaperTrials.id, trial.id), eq(autoPaperTrials.userId, userId)));
  const eventKey = observation.eventType === "HEALTH_CHANGED" ? `HEALTH_CHANGED:${observation.status}` : observation.eventType;
  const recorded = await recordEventIfAbsent(db, trial, { eventKey, eventType: observation.eventType, reason: observation.reason, price: row.asset.price, provider: bundle.provider, freshness: bundle.state, provenance: bundle });
  return { trial: { ...trial, currentSnapshot, status: observation.status }, refreshed: true as const, recordedEvents: recorded ? [eventKey] : [] };
}

export async function refreshAutoPaperForAllEnabled(getConfiguration: (userId: number) => Promise<ScoringConfig>) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; Auto Paper cannot be refreshed.");
  const enabledUsers = await db.select({ userId: autoPaperSettings.userId }).from(autoPaperSettings).where(eq(autoPaperSettings.enabled, true));
  const results = [];
  for (const row of enabledUsers) results.push({ userId: row.userId, trials: await refreshAutoPaperActive(row.userId, await getConfiguration(row.userId)) });
  return { users: enabledUsers.length, results };
}

export async function refreshAutoPaperActive(userId: number, configuration: ScoringConfig) {
  const active = await getAutoPaperActive(userId);
  return Promise.all(active.map(trial => refreshAutoPaperTrial(userId, trial.id, configuration)));
}

export async function getAutoPaperEvents(userId: number, trialId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; Auto Paper events cannot be loaded.");
  const owned = (await db.select({ id: autoPaperTrials.id }).from(autoPaperTrials).where(and(eq(autoPaperTrials.id, trialId), eq(autoPaperTrials.userId, userId))).limit(1))[0];
  if (!owned) throw new Error("Auto Paper trial not found in this private account.");
  return db.select().from(autoPaperEvents).where(eq(autoPaperEvents.trialId, trialId)).orderBy(asc(autoPaperEvents.createdAt));
}

export async function getAutoPaperPerformance(userId: number) {
  const trials = await getAutoPaperHistory(userId);
  const closed = trials.filter(trial => ["CLOSED", "INVALIDATED"].includes(trial.status));
  const wins = trials.filter(trial => ["TARGET_1_REACHED", "TARGET_2_REACHED", "TARGET_3_REACHED"].includes(trial.status));
  const averageR = trials.length ? trials.reduce((sum, trial) => sum + trial.rewardRisk, 0) / trials.length : null;
  const byStrategy = Array.from(new Set(trials.map(trial => trial.strategy))).map(strategy => ({ strategy, trials: trials.filter(trial => trial.strategy === strategy).length, wins: wins.filter(trial => trial.strategy === strategy).length }));
  return { totalTrials: trials.length, open: trials.filter(trial => !closed.includes(trial) && !wins.includes(trial)).length, closed: closed.length, wins: wins.length, losses: trials.filter(trial => trial.status === "INVALIDATED").length, t1Hit: trials.filter(trial => ["TARGET_1_REACHED", "TARGET_2_REACHED", "TARGET_3_REACHED"].includes(trial.status)).length, t2Hit: trials.filter(trial => ["TARGET_2_REACHED", "TARGET_3_REACHED"].includes(trial.status)).length, t3Hit: trials.filter(trial => trial.status === "TARGET_3_REACHED").length, winRate: trials.length ? wins.length / trials.length * 100 : null, averageR, byStrategy };
}

export async function getAutoPaperActive(userId: number) {
  const history = await getAutoPaperHistory(userId);
  return history.filter(trial => ["OPEN", "HEALTHY", "WARNING", "REVERSAL_RISK", "TARGET_1_REACHED", "TARGET_2_REACHED", "TARGET_3_REACHED", "DATA_UNAVAILABLE"].includes(trial.status));
}

export function isAutoPaperOnlySource(source: string) { return source === AUTO_PAPER_SOURCE; }
export type AutoPaperMode = AdaptiveTradingMode;
