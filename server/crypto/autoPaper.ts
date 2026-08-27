import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { autoPaperAccounts, autoPaperEvents, autoPaperSettings, autoPaperTrials } from "../../drizzle/schema";
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

export const AUTO_PAPER_MODES = ["CONSERVATIVE", "BALANCED", "OPPORTUNITY", "EXPERIMENTAL", "CUSTOM"] as const;
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

export async function getAutoPaperAccount(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; Auto Paper account cannot be loaded.");
  return (await db.select().from(autoPaperAccounts).where(eq(autoPaperAccounts.userId, userId)).orderBy(asc(autoPaperAccounts.id)).limit(1))[0] ?? null;
}

export async function getAutoPaperSettings(userId: number): Promise<AutoPaperSettings> {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; Auto Paper settings cannot be loaded.");
  const row = (await db.select().from(autoPaperSettings).where(eq(autoPaperSettings.userId, userId)).limit(1))[0];
  return row ? normalizeSettings(row) : autoPaperSettingsSchema.parse(AUTO_PAPER_DEFAULTS);
}

export async function saveAutoPaperSettings(userId: number, input: AutoPaperSettingsInput, startingCapital = 100000): Promise<AutoPaperSettings> {
  const validated = autoPaperSettingsSchema.parse(input);
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; Auto Paper settings cannot be saved.");
  await db.insert(autoPaperSettings).values({ userId, ...validated }).onDuplicateKeyUpdate({ set: validated });
  if (validated.enabled) {
    const account = await getAutoPaperAccount(userId);
    if (!account) await db.insert(autoPaperAccounts).values({ userId, startingCapital, currentEquity: startingCapital, availableCash: startingCapital, realizedPnl: 0, unrealizedPnl: 0 });
  }
  return validated;
}

function planStrategy(plan: TradeSetupPlan) { return plan.mode === "SCALP" ? "SCALP" : "SWING"; }
function planIdentity(plan: TradeSetupPlan) { return `${plan.assetId}:${plan.direction}:${planStrategy(plan)}:${plan.timeframes.execution}:${plan.dataTimestamp ?? "NO_TIMESTAMP"}:${plan.setupType}`; }
function validAutoPlan(plan: TradeSetupPlan, settings: AutoPaperSettings) {
  const direction = plan.direction;
  const strategy = planStrategy(plan);
  const quality = plan.tradeSetupQuality;
  const mode = settings.mode === "CUSTOM" ? "EXPERIMENTAL" : settings.mode;
  const modeMinimumQuality = mode === "CONSERVATIVE" ? Math.max(settings.minSetupQuality, 80) : mode === "OPPORTUNITY" ? Math.max(settings.minSetupQuality, 55) : mode === "EXPERIMENTAL" ? Math.max(settings.minSetupQuality, 45) : settings.minSetupQuality;
  const modeMinimumRewardRisk = mode === "CONSERVATIVE" ? Math.max(settings.minRewardRisk, 2) : mode === "OPPORTUNITY" || mode === "EXPERIMENTAL" ? Math.max(settings.minRewardRisk, 1) : settings.minRewardRisk;
  const potentialAllowed = settings.allowPotential || mode === "OPPORTUNITY" || mode === "EXPERIMENTAL";
  return plan.availability === "LIVE" && plan.dataBundle.coherent && plan.dataBundle.eligibleForScoring && plan.currentPrice !== null && (direction === "LONG" || direction === "SHORT") && plan.entryZone !== null && plan.stop !== null && plan.targets.length > 0 && plan.rewardRisk !== null && plan.rewardRisk >= modeMinimumRewardRisk && quality !== null && quality >= modeMinimumQuality && (settings.strategies.includes(strategy) || (strategy === "SCALP" && settings.strategies.includes("15M FAST SCALP"))) && settings.directions.includes(direction) && (plan.actionable || potentialAllowed);
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
  if (existing && ACTIVE_TRIAL_STATUSES.includes(existing.status as typeof ACTIVE_TRIAL_STATUSES[number])) return { created: false as const, duplicate: true as const, trial: existing };
  const active = await db.select({ count: sql<number>`count(*)` }).from(autoPaperTrials).where(and(eq(autoPaperTrials.userId, userId), inArray(autoPaperTrials.status, ACTIVE_TRIAL_STATUSES)));
  if (Number(active[0]?.count ?? 0) >= settings.maxPositions) throw new Error("The configured maximum number of simultaneous Auto Paper positions has been reached.");
  const entry = plan.entryZone.preferred;
  const stop = plan.stop.price;
  const targets = plan.targets.slice(0, 3);
  const tradeDirection: "long" | "short" = plan.direction === "LONG" ? "long" : "short";
  const strategy: "SCALP" | "SWING" = planStrategy(plan) as "SCALP" | "SWING";
  const validatedRewardRisk = plan.rewardRisk;
  const validatedSetupQuality = plan.tradeSetupQuality;
  const now = Date.now();
  return db.transaction(async tx => {
    const account = (await tx.select().from(autoPaperAccounts).where(eq(autoPaperAccounts.userId, userId)).orderBy(asc(autoPaperAccounts.id)).limit(1))[0];
    if (!account) throw new Error("Auto Paper account is not initialized. Enable Auto Paper explicitly before creating simulations.");
    const size = positionSize(entry, stop, account.currentEquity, settings.riskPercent);
    const reservedCapital = Number((entry * size).toFixed(8));
    if (!Number.isFinite(reservedCapital) || reservedCapital <= 0 || reservedCapital > account.availableCash) throw new Error("Auto Paper does not have enough independent simulated cash for this entry.");
    await tx.update(autoPaperAccounts).set({ availableCash: account.availableCash - reservedCapital }).where(and(eq(autoPaperAccounts.id, account.id), eq(autoPaperAccounts.userId, userId)));
    const snapshot = cloneImmutableEntrySnapshot({ source: AUTO_PAPER_SOURCE, createdAt: now, plan, mode: settings.mode, reservedCapital });
    const trialValues: typeof autoPaperTrials.$inferInsert = { userId, accountId: account.id, paperTradeId: null, setupIdentity: identity, assetId: plan.assetId, direction: tradeDirection, strategy, timeframe: plan.timeframes.execution, source: AUTO_PAPER_SOURCE, mode: settings.mode, status: "ENTERED", immutablePlanSnapshot: cloneImmutableEntrySnapshot(plan), immutableEntrySnapshot: snapshot, currentSnapshot: { observedAt: now, status: "ENTERED", price: entry }, entryPrice: entry, stopPrice: stop, target1: targets[0]?.price, target2: targets[1]?.price, target3: targets[2]?.price, setupQuality: validatedSetupQuality, rewardRisk: validatedRewardRisk, positionSize: size, riskPercent: settings.riskPercent, realizedPnl: 0, currentPnl: 0, provider: plan.provider ?? "UNAVAILABLE", provenance: plan.dataBundle, freshness: plan.availability, startedAt: new Date(now) };
    const insertedTrial = await tx.insert(autoPaperTrials).values(trialValues);
    const trialId = Number(insertedTrial[0].insertId);
    await tx.insert(autoPaperEvents).values([{ trialId, eventKey: "TRIAL_CREATED", eventType: "SIMULATED_ENTRY", reason: "Validated setup satisfied the enabled Auto Paper requirements; no real order was sent.", price: entry, timeframe: plan.timeframes.execution, provider: plan.provider ?? undefined, freshness: plan.availability, provenance: plan.dataBundle }]);
    return { created: true as const, duplicate: false as const, trialId, paperTradeId: null, identity, source: AUTO_PAPER_SOURCE, snapshot };
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

const ACTIVE_TRIAL_STATUSES = ["DETECTED", "ENTERED", "OPEN", "HEALTHY", "WARNING", "REVERSAL_RISK", "TARGET_1_REACHED", "TARGET_2_REACHED", "TARGET_3_REACHED", "DATA_UNAVAILABLE"] as const;

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
  const status = observation.status === "INVALIDATED" ? "STOPPED" as const : observation.status;
  const currentPnl = Number(((row.asset.price - trial.entryPrice) * trial.positionSize * (trial.direction === "long" ? 1 : -1)).toFixed(8));
  const currentSnapshot = { observedAt: scan.generatedAt, status, price: row.asset.price, provider: bundle.provider, dataQuality: bundle.state, reason: observation.reason, reachedTargets: observation.reached, currentPnl };
  await db.update(autoPaperTrials).set({ currentSnapshot, currentPnl: status === "STOPPED" ? 0 : currentPnl, realizedPnl: status === "STOPPED" ? currentPnl : trial.realizedPnl, status, completedAt: status === "STOPPED" ? new Date(scan.generatedAt) : undefined }).where(and(eq(autoPaperTrials.id, trial.id), eq(autoPaperTrials.userId, userId)));
  const eventKey = observation.eventType === "HEALTH_CHANGED" ? `HEALTH_CHANGED:${observation.status}` : observation.eventType;
  const recorded = await recordEventIfAbsent(db, trial, { eventKey, eventType: observation.eventType, reason: observation.reason, price: row.asset.price, provider: bundle.provider, freshness: bundle.state, provenance: bundle });
  return { trial: { ...trial, currentSnapshot, currentPnl, status }, refreshed: true as const, recordedEvents: recorded ? [eventKey] : [] };
}

export async function refreshAutoPaperForAllEnabled(getConfiguration: (userId: number) => Promise<ScoringConfig>) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; Auto Paper cannot be refreshed.");
  const enabledUsers = await db.select({ userId: autoPaperSettings.userId }).from(autoPaperSettings).where(eq(autoPaperSettings.enabled, true));
  const results = [];
  for (const row of enabledUsers) {
    const configuration = await getConfiguration(row.userId);
    const settings = await getAutoPaperSettings(row.userId);
    const scan = await buildLiveScanner(false, configuration);
    const createdTrials: unknown[] = [];
    for (const candidate of scan.rows) {
      const requestedModes = settings.strategies.includes("SWING") ? (["SWING", "SCALP"] as const) : (["SCALP"] as const);
      for (const setupMode of requestedModes) {
        const plan = await getTradeSetupForRow(setupMode, candidate, scan.marketRegime, configuration, undefined, getScannerLiveOhlcvBundle(scan, candidate.asset.symbol));
        const adaptive = qualifyAdaptive(plan);
        if (!adaptive.eligibleForAutoPaper || !validAutoPlan(plan, settings)) continue;
        try {
          const created = await createAutoPaperTrial(row.userId, plan, configuration, settings);
          if (created.created) createdTrials.push(created);
        } catch (error) {
          if (!(error instanceof Error) || !error.message.includes("maximum number")) throw error;
          break;
        }
      }
    }
    const refreshed = await refreshAutoPaperActive(row.userId, configuration);
    results.push({ userId: row.userId, createdTrials, trials: refreshed });
  }
  return { users: enabledUsers.length, results };
}

export function deriveAutoPaperAccountState(account: Pick<typeof autoPaperAccounts.$inferSelect, "startingCapital">, trials: Array<Pick<typeof autoPaperTrials.$inferSelect, "status" | "entryPrice" | "positionSize" | "realizedPnl" | "currentPnl">>) {
  const active = trials.filter(trial => ACTIVE_TRIAL_STATUSES.includes(trial.status as typeof ACTIVE_TRIAL_STATUSES[number]));
  const realizedPnl = trials.reduce((sum, trial) => sum + Number(trial.realizedPnl ?? 0), 0);
  const unrealizedPnl = active.reduce((sum, trial) => sum + Number(trial.currentPnl ?? 0), 0);
  const reservedCapital = active.reduce((sum, trial) => sum + Number(trial.entryPrice * trial.positionSize), 0);
  const availableCash = Math.max(0, account.startingCapital + realizedPnl - reservedCapital);
  return { startingCapital: account.startingCapital, reservedCapital, availableCash, unrealizedPnl, realizedPnl, currentEquity: account.startingCapital + realizedPnl + unrealizedPnl };
}

export async function refreshAutoPaperActive(userId: number, configuration: ScoringConfig) {
  const active = await getAutoPaperActive(userId);
  const refreshed = await Promise.all(active.map(trial => refreshAutoPaperTrial(userId, trial.id, configuration)));
  const db = await getDb();
  if (db) {
    const account = await getAutoPaperAccount(userId);
    if (account) {
      const trials = await getAutoPaperHistory(userId);
      const state = deriveAutoPaperAccountState(account, trials);
      await db.update(autoPaperAccounts).set({ realizedPnl: state.realizedPnl, unrealizedPnl: state.unrealizedPnl, currentEquity: state.currentEquity, availableCash: state.availableCash }).where(and(eq(autoPaperAccounts.id, account.id), eq(autoPaperAccounts.userId, userId)));
    }
  }
  return refreshed;
}

export async function getAutoPaperEventFeed(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; Auto Paper feed cannot be loaded.");
  return db.select({ event: autoPaperEvents, trial: autoPaperTrials }).from(autoPaperEvents).innerJoin(autoPaperTrials, eq(autoPaperEvents.trialId, autoPaperTrials.id)).where(eq(autoPaperTrials.userId, userId)).orderBy(desc(autoPaperEvents.createdAt)).limit(100);
}

export async function getAutoPaperEvents(userId: number, trialId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; Auto Paper events cannot be loaded.");
  const owned = (await db.select({ id: autoPaperTrials.id }).from(autoPaperTrials).where(and(eq(autoPaperTrials.id, trialId), eq(autoPaperTrials.userId, userId))).limit(1))[0];
  if (!owned) throw new Error("Auto Paper trial not found in this private account.");
  return db.select().from(autoPaperEvents).where(eq(autoPaperEvents.trialId, trialId)).orderBy(asc(autoPaperEvents.createdAt));
}

export async function getAutoPaperPerformance(userId: number, filters?: { strategy?: string; timeframe?: string; direction?: "long" | "short"; mode?: string; assetId?: string; from?: number; to?: number }) {
  const all = await getAutoPaperHistory(userId);
  const trials = all.filter(trial => (!filters?.strategy || trial.strategy === filters.strategy) && (!filters?.timeframe || trial.timeframe === filters.timeframe) && (!filters?.direction || trial.direction === filters.direction) && (!filters?.mode || trial.mode === filters.mode || (filters.mode === "EXPERIMENTAL" && trial.mode === "CUSTOM")) && (!filters?.assetId || trial.assetId === filters.assetId) && (!filters?.from || trial.createdAt.getTime() >= filters.from) && (!filters?.to || trial.createdAt.getTime() <= filters.to));
  const targetStatuses = ["TARGET_1_REACHED", "TARGET_2_REACHED", "TARGET_3_REACHED"];
  const terminalStatuses = ["INVALIDATED", "STOPPED", "CLOSED", "COMPLETED", "EXPIRED"];
  const wins = trials.filter(trial => targetStatuses.includes(trial.status));
  const losses = trials.filter(trial => ["INVALIDATED", "STOPPED"].includes(trial.status));
  const completed = trials.filter(trial => terminalStatuses.includes(trial.status) || targetStatuses.includes(trial.status));
  const active = trials.filter(trial => ACTIVE_TRIAL_STATUSES.includes(trial.status as typeof ACTIVE_TRIAL_STATUSES[number]));
  const rValues = completed.map(trial => targetStatuses.includes(trial.status) ? trial.rewardRisk : losses.some(loss => loss.id === trial.id) ? -1 : null).filter((value): value is number => value !== null);
  const averageR = rValues.length ? rValues.reduce((sum, value) => sum + value, 0) / rValues.length : null;
  const positiveR = rValues.filter(value => value > 0).reduce((sum, value) => sum + value, 0);
  const negativeR = Math.abs(rValues.filter(value => value < 0).reduce((sum, value) => sum + value, 0));
  const pnl = trials.reduce((sum, trial) => sum + trial.realizedPnl + trial.currentPnl, 0);
  const by = (key: "strategy" | "mode") => Array.from(new Set(trials.map(trial => trial[key]))).map(value => { const group = trials.filter(trial => trial[key] === value); const groupWins = group.filter(trial => targetStatuses.includes(trial.status)).length; return { [key]: value, trials: group.length, active: group.filter(trial => ACTIVE_TRIAL_STATUSES.includes(trial.status as typeof ACTIVE_TRIAL_STATUSES[number])).length, wins: groupWins, losses: group.filter(trial => ["INVALIDATED", "STOPPED"].includes(trial.status)).length, winRate: group.length ? groupWins / group.length * 100 : null, averageR: group.length ? group.reduce((sum, trial) => sum + (targetStatuses.includes(trial.status) ? trial.rewardRisk : trial.status === "INVALIDATED" || trial.status === "STOPPED" ? -1 : 0), 0) / group.length : null }; });
  return { totalTrials: trials.length, active: active.length, open: active.length, completed: completed.length, closed: completed.length, wins: wins.length, losses: losses.length, breakeven: completed.filter(trial => trial.realizedPnl === 0 && !targetStatuses.includes(trial.status) && !["INVALIDATED", "STOPPED"].includes(trial.status)).length, t1Hit: trials.filter(trial => targetStatuses.includes(trial.status)).length, t2Hit: trials.filter(trial => ["TARGET_2_REACHED", "TARGET_3_REACHED"].includes(trial.status)).length, t3Hit: trials.filter(trial => trial.status === "TARGET_3_REACHED").length, reversalRate: trials.length ? trials.filter(trial => trial.status === "REVERSAL_RISK").length / trials.length * 100 : null, stopRate: trials.length ? losses.length / trials.length * 100 : null, winRate: completed.length >= 5 ? wins.length / completed.length * 100 : null, lossRate: completed.length >= 5 ? losses.length / completed.length * 100 : null, averageR: completed.length >= 5 ? averageR : null, totalR: completed.length >= 5 ? rValues.reduce((sum, value) => sum + value, 0) : null, simulatedPnl: pnl, profitFactor: completed.length >= 5 && negativeR > 0 ? positiveR / negativeR : null, insufficientSample: completed.length < 5, byStrategy: by("strategy"), byMode: by("mode") };
}

export async function getAutoPaperActive(userId: number) {
  const history = await getAutoPaperHistory(userId);
  return history.filter(trial => ACTIVE_TRIAL_STATUSES.includes(trial.status as typeof ACTIVE_TRIAL_STATUSES[number]));
}

export function isAutoPaperOnlySource(source: string) { return source === AUTO_PAPER_SOURCE; }
export type AutoPaperMode = AdaptiveTradingMode;
