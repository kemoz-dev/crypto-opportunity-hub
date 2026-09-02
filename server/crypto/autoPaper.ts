import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { autoPaperAccounts, autoPaperEquitySnapshots, autoPaperEvents, autoPaperSettings, autoPaperTrials } from "../../drizzle/schema";
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

export const AUTO_PAPER_ELIGIBILITY_STATES = ["ELIGIBLE", "NOT_ELIGIBLE", "DATA_UNAVAILABLE", "REQUIRES_CONFIRMATION", "DUPLICATE"] as const;
export type AutoPaperEligibilityState = (typeof AUTO_PAPER_ELIGIBILITY_STATES)[number];

export async function getAutoPaperEligibilitySummary(userId: number, configuration: ScoringConfig) {
  const settings = await getAutoPaperSettings(userId);
  const history = await getAutoPaperHistory(userId);
  const active = history.filter(trial => ACTIVE_TRIAL_STATUSES.includes(trial.status as typeof ACTIVE_TRIAL_STATUSES[number]));
  const activeIdentities = new Set(active.map(trial => trial.setupIdentity));
  const scan = await buildLiveScanner(false, configuration);
  const rows: Array<{ assetId: string; symbol: string; strategy: string; timeframe: string; direction: string; state: AutoPaperEligibilityState; qualification: string; warning: string | null; reason: string; primaryReason: string; additionalReasons: string[]; dataBlock: string[]; strategyBlock: string[]; setupQuality: number | null; setupReadiness: string; entryZone: { low: number; high: number; preferred: number } | null; stop: number | null; targets: Array<{ label: string; price: number }>; rewardRisk: number | null; regime: string | null; health: string; provider: string | null; freshness: string | null; dataQuality: string; dataValid: boolean; setupValid: boolean; setupIdentity: string | null }> = [];
  const requestedModes = settings.strategies.includes("SWING") ? (["SWING", "SCALP"] as const) : (["SCALP"] as const);
  for (const candidate of scan.rows) {
    for (const setupMode of requestedModes) {
      const bundle = getScannerLiveOhlcvBundle(scan, candidate.asset.symbol);
      const plan = await getTradeSetupForRow(setupMode, candidate, scan.marketRegime, configuration, undefined, bundle);
      const adaptive = qualifyAdaptive(plan);
      const identity = planIdentity(plan);
      const dataUnavailable = plan.availability !== "LIVE" || !bundle?.coherent || !bundle.eligibleForScoring || plan.currentPrice === null;
      const state: AutoPaperEligibilityState = dataUnavailable ? "DATA_UNAVAILABLE" : activeIdentities.has(identity) ? "DUPLICATE" : !validAutoPlan(plan, settings) ? "NOT_ELIGIBLE" : active.length >= settings.maxPositions ? "NOT_ELIGIBLE" : !settings.enabled ? "REQUIRES_CONFIRMATION" : "ELIGIBLE";
      const reason = dataUnavailable ? plan.unavailable?.[0] ?? bundle?.statusMessage ?? "Required live data is unavailable." : state === "DUPLICATE" ? "An active Auto Paper trial already exists for this server setup identity." : state === "NOT_ELIGIBLE" ? (adaptive.reasons?.[0] ?? "The setup does not satisfy the current Auto Paper settings and risk controls.") : state === "REQUIRES_CONFIRMATION" ? "Auto Paper is OFF; explicit owner confirmation is required before simulation." : active.length >= settings.maxPositions ? "The configured maximum active Auto Paper positions has been reached." : "Validated setup satisfies the current server-side Auto Paper requirements.";
      const dataBlock = plan.diagnostics.filter(condition => ["provider_bundle", "live_price", "freshness"].includes(condition.key)).map(condition => `${condition.label}: ${condition.status} · ${condition.actual} · Required: ${condition.required}`);
      if (!dataBlock.length) dataBlock.push(`Provider: ${plan.provider ?? "UNAVAILABLE"} · Freshness: ${plan.availability} · Data bundle: ${plan.dataBundle.state ?? "UNAVAILABLE"}`);
      const strategyBlock = plan.diagnostics.filter(condition => !["provider_bundle", "live_price", "freshness"].includes(condition.key) && condition.status !== "PASSED").map(condition => `${condition.label}: ${condition.status} · ${condition.actual} · Required: ${condition.required}`);
      const additionalReasons = Array.from(new Set([...strategyBlock, ...(adaptive.reasons ?? []), ...(plan.watch?.missing ?? []), ...(plan.unavailable ?? [])].filter(Boolean))).slice(0, 6);
      const primaryReason = dataUnavailable ? plan.unavailable?.[0] ?? plan.dataBundle.statusMessage : state === "DUPLICATE" ? "An active Auto Paper trial already exists for this setup identity." : state === "REQUIRES_CONFIRMATION" ? "Auto Paper is OFF; explicit owner confirmation is required before simulation." : adaptive.reasons?.[0] ?? strategyBlock[0] ?? reason;
      const dataValid = !dataUnavailable;
      const setupValid = dataValid && (plan.actionable || plan.readinessCandidate?.availability === "SUPPORTED" || plan.readinessCandidate?.availability === "PARTIAL");
      rows.push({ assetId: plan.assetId, symbol: candidate.asset.symbol, strategy: planStrategy(plan), timeframe: plan.timeframes.execution, direction: plan.direction, state, qualification: adaptive.status, warning: adaptive.warnings?.[0] ?? null, reason, primaryReason, additionalReasons, dataBlock, strategyBlock, setupQuality: plan.tradeSetupQuality, setupReadiness: plan.readinessCandidate?.availability ?? (plan.actionable ? "VALIDATED" : "UNAVAILABLE"), entryZone: plan.entryZone ? { low: plan.entryZone.low, high: plan.entryZone.high, preferred: plan.entryZone.preferred } : null, stop: plan.stop?.price ?? null, targets: plan.targets.slice(0, 3).map(target => ({ label: target.label, price: target.price })), rewardRisk: plan.rewardRisk, regime: plan.regimeClassification, health: "HEALTH UNKNOWN · ELIGIBILITY ONLY", provider: plan.provider, freshness: plan.availability, dataQuality: plan.dataBundle.state ?? "UNAVAILABLE", dataValid, setupValid, setupIdentity: identity });
    }
  }
  const counts = Object.fromEntries(AUTO_PAPER_ELIGIBILITY_STATES.map(state => [state, rows.filter(row => row.state === state).length])) as Record<AutoPaperEligibilityState, number>;
  const completedCount = history.filter(trial => ["STOPPED", "CLOSED", "COMPLETED", "EXPIRED"].includes(trial.status)).length;
  const funnel = { allDiscovered: rows.length, dataValid: rows.filter(row => row.dataValid).length, setupValid: rows.filter(row => row.setupValid).length, eligible: counts.ELIGIBLE, autoPaperAccepted: history.length, active: active.length, completed: completedCount };
  const qualificationCounts = { qualified: rows.filter(row => ["QUALIFIED", "STRONG SETUP"].includes(row.qualification)).length, potential: rows.filter(row => ["POTENTIAL", "LOW CONFIDENCE", "CAUTION"].includes(row.qualification)).length, watch: rows.filter(row => row.qualification === "WATCH").length, noTrade: rows.filter(row => row.qualification === "NO TRADE").length, dataUnavailable: rows.filter(row => row.qualification === "DATA UNAVAILABLE").length, duplicate: counts.DUPLICATE };
  const regimeCounts = { riskOn: rows.filter(row => row.regime === "RISK ON").length, neutral: rows.filter(row => row.regime === "NEUTRAL").length, riskOff: rows.filter(row => row.regime === "RISK OFF").length, unavailable: rows.filter(row => row.regime == null).length };
  return { generatedAt: scan.generatedAt, enabled: settings.enabled, settings: { mode: settings.mode, maxPositions: settings.maxPositions, strategies: settings.strategies, directions: settings.directions, allowPotential: settings.allowPotential, minSetupQuality: settings.minSetupQuality, minRewardRisk: settings.minRewardRisk, riskPercent: settings.riskPercent }, activeCount: active.length, eligibleCount: counts.ELIGIBLE + counts.REQUIRES_CONFIRMATION, counts, qualificationCounts, regimeCounts, funnel, rows, source: AUTO_PAPER_SOURCE };
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
    await tx.insert(autoPaperEvents).values([{ trialId, eventKey: "SETUP_DETECTED", eventType: "SETUP_DETECTED", reason: "Server-derived setup passed the enabled Auto Paper eligibility boundary.", price: entry, timeframe: plan.timeframes.execution, provider: plan.provider ?? undefined, freshness: plan.availability, provenance: plan.dataBundle }, { trialId, eventKey: "ENTRY_SIMULATED", eventType: "ENTRY_SIMULATED", reason: "Entry was simulated from the server-derived validated plan; no real order was sent.", price: entry, timeframe: plan.timeframes.execution, provider: plan.provider ?? undefined, freshness: plan.availability, provenance: plan.dataBundle }, { trialId, eventKey: "TRIAL_CREATED", eventType: "SIMULATED_ENTRY", reason: "Validated setup satisfied the enabled Auto Paper requirements; no real order was sent.", price: entry, timeframe: plan.timeframes.execution, provider: plan.provider ?? undefined, freshness: plan.availability, provenance: plan.dataBundle }]);
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
  const status = observation.status === "INVALIDATED" ? "STOPPED" as const : observation.status === "TARGET_3_REACHED" ? "COMPLETED" as const : observation.status;
  const currentPnl = Number(((row.asset.price - trial.entryPrice) * trial.positionSize * (trial.direction === "long" ? 1 : -1)).toFixed(8));
  const terminal = status === "STOPPED" || status === "COMPLETED";
  const currentSnapshot = { observedAt: scan.generatedAt, status, price: row.asset.price, provider: bundle.provider, dataQuality: bundle.state, reason: observation.reason, reachedTargets: observation.reached, currentPnl };
  await db.update(autoPaperTrials).set({ currentSnapshot, currentPnl: terminal ? 0 : currentPnl, realizedPnl: terminal ? currentPnl : trial.realizedPnl, status, completedAt: terminal ? new Date(scan.generatedAt) : undefined }).where(and(eq(autoPaperTrials.id, trial.id), eq(autoPaperTrials.userId, userId)));
  const resumed = trial.status === "DATA_UNAVAILABLE" ? await recordEventIfAbsent(db, trial, { eventKey: "RESUMED", eventType: "RESUMED", reason: "Validated live data resumed monitoring without closing or repricing the simulation.", price: row.asset.price, provider: bundle.provider, freshness: bundle.state, provenance: bundle }) : false;
  const eventKey = observation.eventType === "HEALTH_CHANGED" ? `HEALTH_CHANGED:${observation.status}` : observation.eventType === "STOP_REACHED" ? "STOP_LOSS" : observation.eventType;
  const recorded = await recordEventIfAbsent(db, trial, { eventKey, eventType: eventKey, reason: observation.reason, price: row.asset.price, provider: bundle.provider, freshness: bundle.state, provenance: bundle });
  return { trial: { ...trial, currentSnapshot, currentPnl, status }, refreshed: true as const, recordedEvents: [...(resumed ? ["RESUMED"] : []), ...(recorded ? [eventKey] : [])] };
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

const AUTO_PAPER_SNAPSHOT_BUCKET_MS = 5 * 60 * 1000;

export function autoPaperSnapshotDeduplicationKey(accountId: number, capturedAt: number) { return `${accountId}:${Math.floor(capturedAt / AUTO_PAPER_SNAPSHOT_BUCKET_MS)}`; }

export async function persistAutoPaperEquitySnapshot(userId: number, capturedAt = Date.now()) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; Auto Paper snapshot cannot be written.");
  const account = await getAutoPaperAccount(userId);
  if (!account) return { created: false as const, reason: "ACCOUNT_NOT_INITIALIZED" as const };
  const trials = await getAutoPaperHistory(userId);
  const state = deriveAutoPaperAccountState(account, trials);
  const deduplicationKey = autoPaperSnapshotDeduplicationKey(account.id, capturedAt);
  const existing = (await db.select({ id: autoPaperEquitySnapshots.id }).from(autoPaperEquitySnapshots).where(and(eq(autoPaperEquitySnapshots.accountId, account.id), eq(autoPaperEquitySnapshots.userId, userId), eq(autoPaperEquitySnapshots.deduplicationKey, deduplicationKey))).limit(1))[0];
  if (existing) return { created: false as const, reason: "DUPLICATE_BUCKET" as const, id: existing.id };
  const active = trials.filter(trial => ACTIVE_TRIAL_STATUSES.includes(trial.status as typeof ACTIVE_TRIAL_STATUSES[number]));
  const provenance = active[0]?.provenance ?? null;
  const freshness = active[0]?.freshness ?? "UNAVAILABLE";
  try {
    const inserted = await db.insert(autoPaperEquitySnapshots).values({ accountId: account.id, userId, capturedAt: new Date(capturedAt), equity: state.currentEquity, availableCash: state.availableCash, realizedPnl: state.realizedPnl, unrealizedPnl: state.unrealizedPnl, exposure: state.reservedCapital, activeTrialCount: active.length, provenance, freshness, deduplicationKey });
    return { created: true as const, id: Number(inserted[0]?.insertId ?? 0), capturedAt };
  } catch (error) {
    if (error instanceof Error && /duplicate|unique/i.test(error.message)) return { created: false as const, reason: "DUPLICATE_BUCKET" as const };
    throw error;
  }
}

export async function getAutoPaperEquitySnapshots(userId: number, from?: number, to?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; Auto Paper snapshots cannot be loaded.");
  const conditions = [eq(autoPaperEquitySnapshots.userId, userId)];
  if (from != null) conditions.push(gte(autoPaperEquitySnapshots.capturedAt, new Date(from)));
  if (to != null) conditions.push(lte(autoPaperEquitySnapshots.capturedAt, new Date(to)));
  return db.select().from(autoPaperEquitySnapshots).where(and(...conditions)).orderBy(asc(autoPaperEquitySnapshots.capturedAt));
}

export async function getAutoPaperEquityHistory(userId: number, from?: number, to?: number) {
  const account = await getAutoPaperAccount(userId);
  if (!account) return { state: "NOT_INITIALIZED" as const, points: [] };
  const snapshots = await getAutoPaperEquitySnapshots(userId, from, to);
  if (!snapshots.length) return { state: "NO_SNAPSHOTS" as const, points: [] };
  return { state: "READY" as const, points: snapshots.map(snapshot => ({ timestamp: snapshot.capturedAt.getTime(), equity: snapshot.equity, availableCash: snapshot.availableCash, realizedPnl: snapshot.realizedPnl, unrealizedPnl: snapshot.unrealizedPnl, exposure: snapshot.exposure, activeTrialCount: snapshot.activeTrialCount, provenance: snapshot.provenance, freshness: snapshot.freshness })) };
}

export async function getAutoPaperEquitySummary(userId: number, from?: number, to?: number) {
  const account = await getAutoPaperAccount(userId);
  if (!account) return { state: "NOT_INITIALIZED" as const, startingCapital: null, currentEquity: null, availableCash: null, realizedPnl: null, unrealizedPnl: null, totalPnl: null, returnPercent: null, peakEquity: null, maximumDrawdown: null, snapshotCount: 0, firstSnapshotAt: null, latestSnapshotAt: null, activeTrialCount: 0 };
  const snapshots = await getAutoPaperEquitySnapshots(userId, from, to);
  const equities = snapshots.map(snapshot => snapshot.equity);
  const latest = snapshots.at(-1);
  const peakEquity = equities.length ? Math.max(...equities) : account.currentEquity;
  return { state: snapshots.length ? "READY" as const : "NO_SNAPSHOTS" as const, startingCapital: account.startingCapital, currentEquity: latest?.equity ?? account.currentEquity, availableCash: latest?.availableCash ?? account.availableCash, realizedPnl: latest?.realizedPnl ?? account.realizedPnl, unrealizedPnl: latest?.unrealizedPnl ?? account.unrealizedPnl, totalPnl: account.currentEquity - account.startingCapital, returnPercent: account.startingCapital ? (account.currentEquity - account.startingCapital) / account.startingCapital * 100 : null, peakEquity, maximumDrawdown: calculateAutoPaperMaximumDrawdown(equities), snapshotCount: snapshots.length, firstSnapshotAt: snapshots[0]?.capturedAt ?? null, latestSnapshotAt: latest?.capturedAt ?? null, activeTrialCount: latest?.activeTrialCount ?? 0 };
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
      await persistAutoPaperEquitySnapshot(userId);
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

type AutoPaperPerformanceFilters = { strategy?: string; timeframe?: string; direction?: "long" | "short"; mode?: string; assetId?: string; regime?: string; from?: number; to?: number; status?: string; qualification?: string };
const AUTO_PAPER_TERMINAL_STATUSES = ["STOPPED", "CLOSED", "COMPLETED", "EXPIRED"] as const;
const AUTO_PAPER_TARGET_STATUSES = ["TARGET_1_REACHED", "TARGET_2_REACHED", "TARGET_3_REACHED"] as const;

function trialRegime(trial: any) { return typeof trial.immutablePlanSnapshot?.regime === "string" ? trial.immutablePlanSnapshot.regime : typeof trial.immutablePlanSnapshot?.marketRegime === "string" ? trial.immutablePlanSnapshot.marketRegime : "UNAVAILABLE"; }
function trialQualification(trial: any) { return trial.immutablePlanSnapshot?.adaptiveQualification?.status ?? trial.immutablePlanSnapshot?.qualification?.status ?? "UNAVAILABLE"; }
function isCompletedTrial(trial: any) { return AUTO_PAPER_TERMINAL_STATUSES.includes(trial.status); }
function isWinningTrial(trial: any) { return isCompletedTrial(trial) && Number(trial.realizedPnl ?? 0) > 0; }
function isLosingTrial(trial: any) { return isCompletedTrial(trial) && Number(trial.realizedPnl ?? 0) < 0; }
function reachedTargets(trial: any) { return Number((trial.currentSnapshot as any)?.reachedTargets ?? 0); }
export function getAutoPaperSampleLabel(completed: number) { return completed >= 500 ? "LARGER SAMPLE" : completed >= 50 ? "EARLY EVIDENCE" : "LIMITED SAMPLE"; }
export function getAutoPaperIntelligenceSampleLabel(completed: number) { return completed >= 100 ? "STRONG SAMPLE" : completed >= 50 ? "GOOD SAMPLE" : completed >= 20 ? "MODERATE SAMPLE" : completed >= 5 ? "SMALL SAMPLE" : "VERY SMALL SAMPLE"; }
export function calculateAutoPaperRMultiple(realizedPnl: number, riskAmount: number) { return realizedPnl / Math.max(1, riskAmount); }
export function calculateAutoPaperMaximumDrawdown(equity: readonly number[]) { let peak = equity[0] ?? 0; let maximum = 0; for (const value of equity) { peak = Math.max(peak, value); maximum = Math.max(maximum, peak - value); } return maximum; }

export async function getAutoPaperPerformance(userId: number, filters?: AutoPaperPerformanceFilters) {
  const all = await getAutoPaperHistory(userId);
  const trials = all.filter(trial => (!filters?.strategy || trial.strategy === filters.strategy) && (!filters?.timeframe || trial.timeframe === filters.timeframe) && (!filters?.direction || trial.direction === filters.direction) && (!filters?.mode || trial.mode === filters.mode || (filters.mode === "EXPERIMENTAL" && trial.mode === "CUSTOM")) && (!filters?.assetId || trial.assetId === filters.assetId) && (!filters?.regime || trialRegime(trial) === filters.regime) && (!filters?.status || trial.status === filters.status) && (!filters?.qualification || trialQualification(trial) === filters.qualification) && (!filters?.from || trial.createdAt.getTime() >= filters.from) && (!filters?.to || trial.createdAt.getTime() <= filters.to));
  const completed = trials.filter(isCompletedTrial);
  const active = trials.filter(trial => ACTIVE_TRIAL_STATUSES.includes(trial.status as typeof ACTIVE_TRIAL_STATUSES[number]));
  const wins = completed.filter(isWinningTrial);
  const losses = completed.filter(isLosingTrial);
  const rValues = completed.map(trial => calculateAutoPaperRMultiple(Number(trial.realizedPnl ?? 0), Number(trial.entryPrice * trial.positionSize * trial.riskPercent / 100))).filter(Number.isFinite);
  const winningPnls = wins.map(trial => Number(trial.realizedPnl ?? 0));
  const losingPnls = losses.map(trial => Number(trial.realizedPnl ?? 0));
  const grossProfit = winningPnls.reduce((sum, value) => sum + value, 0);
  const grossLoss = Math.abs(losingPnls.reduce((sum, value) => sum + value, 0));
  const realizedPnl = completed.reduce((sum, trial) => sum + Number(trial.realizedPnl ?? 0), 0);
  const unrealizedPnl = active.reduce((sum, trial) => sum + Number(trial.currentPnl ?? 0), 0);
  const positiveR = rValues.filter(value => value > 0).reduce((sum, value) => sum + value, 0);
  const negativeR = Math.abs(rValues.filter(value => value < 0).reduce((sum, value) => sum + value, 0));
  const by = (key: "strategy" | "mode" | "direction" | "timeframe" | "assetId") => Array.from(new Set(trials.map(trial => trial[key]))).map(value => { const group = trials.filter(trial => trial[key] === value); const groupCompleted = group.filter(isCompletedTrial); const groupWins = group.filter(isWinningTrial); const groupLosses = group.filter(isLosingTrial); const groupR = groupCompleted.map(trial => Number(trial.realizedPnl ?? 0) / Math.max(1, Number(trial.entryPrice * trial.positionSize * trial.riskPercent / 100))); const groupProfit = groupWins.reduce((sum, trial) => sum + Number(trial.realizedPnl ?? 0), 0); const groupLoss = Math.abs(groupLosses.reduce((sum, trial) => sum + Number(trial.realizedPnl ?? 0), 0)); return { [key]: value, trials: group.length, active: group.filter(trial => ACTIVE_TRIAL_STATUSES.includes(trial.status as typeof ACTIVE_TRIAL_STATUSES[number])).length, completed: groupCompleted.length, wins: groupWins.length, losses: groupLosses.length, pnl: group.reduce((sum, trial) => sum + Number(trial.realizedPnl ?? 0) + (ACTIVE_TRIAL_STATUSES.includes(trial.status as typeof ACTIVE_TRIAL_STATUSES[number]) ? Number(trial.currentPnl ?? 0) : 0), 0), winRate: groupCompleted.length >= 5 ? groupWins.length / groupCompleted.length * 100 : null, profitFactor: groupCompleted.length >= 5 && groupLoss > 0 ? groupProfit / groupLoss : null, averageR: groupCompleted.length >= 5 && groupR.length ? groupR.reduce((sum, r) => sum + r, 0) / groupR.length : null }; });
  const account = await getAutoPaperAccount(userId);
  const startingCapital = account?.startingCapital ?? 0;
  const intelligenceSample = getAutoPaperIntelligenceSampleLabel(completed.length);
  const qualityOf = (trial: any) => String((trial.currentSnapshot as any)?.dataQuality ?? trial.freshness ?? "UNAVAILABLE").toUpperCase();
  const setupQualityOf = (trial: any) => { const value = Number(trial.setupQuality); return Number.isFinite(value) ? value >= 80 ? "STRONG" : value >= 70 ? "GOOD" : value >= 55 ? "MODERATE" : "WEAK" : "UNAVAILABLE"; };
  const intelligenceBy = (key: string, valueOf: (trial: any) => string) => Array.from(new Set(trials.map(valueOf))).filter(Boolean).map(value => { const group = trials.filter(trial => valueOf(trial) === value); const groupCompleted = group.filter(isCompletedTrial); const groupWins = group.filter(isWinningTrial); const groupR = groupCompleted.map(trial => calculateAutoPaperRMultiple(Number(trial.realizedPnl ?? 0), Number(trial.entryPrice * trial.positionSize * trial.riskPercent / 100))).filter(Number.isFinite); const groupPnl = group.reduce((sum, trial) => sum + Number(trial.realizedPnl ?? 0) + (ACTIVE_TRIAL_STATUSES.includes(trial.status as typeof ACTIVE_TRIAL_STATUSES[number]) ? Number(trial.currentPnl ?? 0) : 0), 0); return { [key]: value, trials: group.length, completed: groupCompleted.length, wins: groupWins.length, losses: groupCompleted.filter(isLosingTrial).length, open: group.filter(trial => ACTIVE_TRIAL_STATUSES.includes(trial.status as typeof ACTIVE_TRIAL_STATUSES[number])).length, winRate: groupCompleted.length >= 5 ? groupWins.length / groupCompleted.length * 100 : null, averageR: groupCompleted.length >= 5 && groupR.length ? groupR.reduce((sum, item) => sum + item, 0) / groupR.length : null, totalR: groupCompleted.length >= 5 ? groupR.reduce((sum, item) => sum + item, 0) : null, pnl: groupPnl, sampleQuality: getAutoPaperIntelligenceSampleLabel(groupCompleted.length), dataQuality: group.length ? Array.from(new Set(group.map(qualityOf))).join(" / ") : "NO SAMPLE" }; });
  const terminalBy = (label: string, predicate: (trial: any) => boolean) => { const count = trials.filter(predicate).length; return { label, count, percentage: trials.length ? count / trials.length * 100 : null }; };
  const targetLadder = [terminalBy("TP1 REACHED", trial => reachedTargets(trial) >= 1), terminalBy("TP2 REACHED", trial => reachedTargets(trial) >= 2), terminalBy("TP3 REACHED", trial => reachedTargets(trial) >= 3), terminalBy("STOP LOSS", trial => trial.status === "STOPPED" || trial.status === "INVALIDATED"), terminalBy("INVALIDATED", trial => trial.status === "INVALIDATED"), terminalBy("OPEN", trial => ACTIVE_TRIAL_STATUSES.includes(trial.status as typeof ACTIVE_TRIAL_STATUSES[number])), terminalBy("DATA UNAVAILABLE", trial => trial.status === "DATA_UNAVAILABLE")];
  const exitIntelligence = [
    terminalBy("TARGET_1", trial => trial.status === "TARGET_1_REACHED"),
    terminalBy("TARGET_2", trial => trial.status === "TARGET_2_REACHED"),
    terminalBy("TARGET_3", trial => trial.status === "TARGET_3_REACHED"),
    terminalBy("STOP_LOSS", trial => trial.status === "STOPPED"),
    terminalBy("INVALIDATED", trial => trial.status === "INVALIDATED"),
    terminalBy("DATA_UNAVAILABLE", trial => trial.status === "DATA_UNAVAILABLE"),
    terminalBy("OPEN", trial => ACTIVE_TRIAL_STATUSES.includes(trial.status as typeof ACTIVE_TRIAL_STATUSES[number])),
  ];
  const failureIntelligence = [terminalBy("STOP_LOSS", trial => trial.status === "STOPPED"), terminalBy("INVALIDATED", trial => trial.status === "INVALIDATED"), terminalBy("DATA_UNAVAILABLE", trial => trial.status === "DATA_UNAVAILABLE"), terminalBy("TARGET_NOT_REACHED", trial => isCompletedTrial(trial) && reachedTargets(trial) === 0)];
  const rDistribution = [{ label: "NEGATIVE R", count: rValues.filter(value => value < 0).length }, { label: "0R", count: rValues.filter(value => value === 0).length }, { label: "+1R", count: rValues.filter(value => value >= 1 && value < 2).length }, { label: "+2R", count: rValues.filter(value => value >= 2 && value < 3).length }, { label: "+3R+", count: rValues.filter(value => value >= 3).length }].map(item => ({ ...item, percentage: rValues.length ? item.count / rValues.length * 100 : null }));
  const intelligence = { sampleQuality: intelligenceSample, averagePnl: completed.length ? realizedPnl / completed.length : null, totalPnl: realizedPnl + unrealizedPnl, dataUnavailableCount: trials.filter(trial => trial.status === "DATA_UNAVAILABLE").length, strategy: intelligenceBy("strategy", trial => trial.strategy), timeframe: intelligenceBy("timeframe", trial => trial.timeframe), direction: intelligenceBy("direction", trial => String(trial.direction).toUpperCase()), regime: intelligenceBy("regime", trial => trialRegime(trial)), qualification: intelligenceBy("qualification", trial => trialQualification(trial)), setupQuality: intelligenceBy("setupQuality", setupQualityOf), dataQuality: intelligenceBy("dataQuality", qualityOf), provider: intelligenceBy("provider", trial => trial.provider), targetLadder, exits: exitIntelligence, failures: failureIntelligence, rDistribution, insufficientSample: completed.length < 5 };
  return { totalTrials: trials.length, active: active.length, open: active.length, completed: completed.length, closed: completed.length, wins: wins.length, losses: losses.length, breakeven: completed.filter(trial => Number(trial.realizedPnl ?? 0) === 0).length, t1Hit: trials.filter(trial => reachedTargets(trial) >= 1).length, t2Hit: trials.filter(trial => reachedTargets(trial) >= 2).length, t3Hit: trials.filter(trial => reachedTargets(trial) >= 3).length, reversalRate: trials.length ? trials.filter(trial => trial.status === "REVERSAL_RISK").length / trials.length * 100 : null, stopRate: trials.length ? losses.length / trials.length * 100 : null, winRate: completed.length >= 5 ? wins.length / completed.length * 100 : null, lossRate: completed.length >= 5 ? losses.length / completed.length * 100 : null, averageWinningTrade: winningPnls.length ? grossProfit / winningPnls.length : null, averageLosingTrade: losingPnls.length ? -grossLoss / losingPnls.length : null, grossProfit, grossLoss, netPnl: realizedPnl + unrealizedPnl, simulatedPnl: realizedPnl + unrealizedPnl, currentEquity: account?.currentEquity ?? startingCapital, startingCapital, returnPercent: startingCapital ? (Number(account?.currentEquity ?? startingCapital) - startingCapital) / startingCapital * 100 : null, averageR: completed.length >= 5 && rValues.length ? rValues.reduce((sum, value) => sum + value, 0) / rValues.length : null, totalR: completed.length >= 5 ? rValues.reduce((sum, value) => sum + value, 0) : null, profitFactor: completed.length >= 5 && grossLoss > 0 ? grossProfit / grossLoss : null, maximumDrawdown: await getAutoPaperMaximumDrawdown(userId, filters), insufficientSample: completed.length < 5, sampleLabel: getAutoPaperSampleLabel(completed.length), byStrategy: by("strategy"), byMode: by("mode"), byDirection: by("direction"), byTimeframe: by("timeframe"), byAsset: by("assetId"), intelligence };
}

export async function getAutoPaperMaximumDrawdown(userId: number, filters?: AutoPaperPerformanceFilters) {
  const curve = await getAutoPaperEquityCurve(userId, filters);
  return calculateAutoPaperMaximumDrawdown(curve.map(point => point.equity));
}

export async function getAutoPaperEquityCurve(userId: number, filters?: AutoPaperPerformanceFilters) {
  const account = await getAutoPaperAccount(userId);
  if (!account) return [];

  const canUseAccountSnapshots = !filters?.strategy && !filters?.timeframe && !filters?.direction && !filters?.mode && !filters?.assetId && !filters?.regime && !filters?.qualification && !filters?.status;
  const snapshots = canUseAccountSnapshots ? await getAutoPaperEquitySnapshots(userId, filters?.from, filters?.to) : [];
  const all = await getAutoPaperHistory(userId);
  const trials = all.filter(trial => (!filters?.strategy || trial.strategy === filters.strategy) && (!filters?.timeframe || trial.timeframe === filters.timeframe) && (!filters?.direction || trial.direction === filters.direction) && (!filters?.mode || trial.mode === filters.mode || (filters.mode === "EXPERIMENTAL" && trial.mode === "CUSTOM")) && (!filters?.assetId || trial.assetId === filters.assetId) && (!filters?.regime || trialRegime(trial) === filters.regime) && (!filters?.qualification || trialQualification(trial) === filters.qualification) && (!filters?.from || trial.createdAt.getTime() >= filters.from) && (!filters?.to || trial.createdAt.getTime() <= filters.to));
  const startingCapital = account.startingCapital;
  let equity = startingCapital;
  const completedTrials = [...trials].filter(isCompletedTrial).sort((a, b) => (a.completedAt?.getTime() ?? a.createdAt.getTime()) - (b.completedAt?.getTime() ?? b.createdAt.getTime()));
  if (!snapshots.length && !completedTrials.length) return [];
  const points: Array<{ timestamp: number; equity: number; drawdown: number; trialId?: number; event?: string; provenance?: unknown; freshness?: string | null }> = [];
  if (snapshots.length) {
    for (const snapshot of snapshots) points.push({ timestamp: snapshot.capturedAt.getTime(), equity: snapshot.equity, drawdown: 0, event: "EQUITY_SNAPSHOT", provenance: snapshot.provenance, freshness: snapshot.freshness });
  } else {
    points.push({ timestamp: completedTrials[0]?.createdAt.getTime() ?? Date.now(), equity, drawdown: 0, event: "STARTING_CAPITAL", provenance: "AUTO_PAPER_TRIAL_HISTORY", freshness: "HISTORICAL" });
    for (const trial of completedTrials) { equity += Number(trial.realizedPnl ?? 0); points.push({ timestamp: trial.completedAt?.getTime() ?? trial.createdAt.getTime(), equity, drawdown: 0, trialId: trial.id, event: trial.status, provenance: trial.provenance, freshness: trial.freshness }); }
    points.push({ timestamp: Date.now(), equity: Number(account.currentEquity), drawdown: 0, event: "CURRENT_EQUITY", provenance: "AUTO_PAPER_ACCOUNT", freshness: "CURRENT" });
  }
  let peak = points[0]?.equity ?? 0;
  return points.map(point => { peak = Math.max(peak, point.equity); return { ...point, drawdown: peak - point.equity }; });
}

export async function buildAutoPaperReport(userId: number, filters?: AutoPaperPerformanceFilters) {
  const account = await getAutoPaperAccount(userId);
  const performance = await getAutoPaperPerformance(userId, filters);
  const trials = (await getAutoPaperHistory(userId)).filter(trial => (!filters?.strategy || trial.strategy === filters.strategy) && (!filters?.timeframe || trial.timeframe === filters.timeframe) && (!filters?.direction || trial.direction === filters.direction) && (!filters?.mode || trial.mode === filters.mode || (filters.mode === "EXPERIMENTAL" && trial.mode === "CUSTOM")) && (!filters?.assetId || trial.assetId === filters.assetId) && (!filters?.regime || trialRegime(trial) === filters.regime) && (!filters?.qualification || trialQualification(trial) === filters.qualification) && (!filters?.from || trial.createdAt.getTime() >= filters.from) && (!filters?.to || trial.createdAt.getTime() <= filters.to));
  return { metadata: { report: "AUTO_PAPER_PERFORMANCE_V1", generatedAt: new Date().toISOString(), accountId: account?.id ?? null, filters: filters ?? {}, source: AUTO_PAPER_SOURCE, secretsIncluded: false }, account: account ? { id: account.id, startingCapital: account.startingCapital, currentEquity: account.currentEquity, availableCash: account.availableCash, realizedPnl: account.realizedPnl, unrealizedPnl: account.unrealizedPnl } : null, performance, trades: trials.map(trial => ({ id: trial.id, assetId: trial.assetId, strategy: trial.strategy, timeframe: trial.timeframe, direction: trial.direction, mode: trial.mode, status: trial.status, entry: trial.entryPrice, exit: trial.status === "STOPPED" ? (trial.currentSnapshot as any)?.price ?? null : null, targets: [trial.target1, trial.target2, trial.target3].filter(Boolean), stop: trial.stopPrice, realizedPnl: trial.realizedPnl, currentPnl: trial.currentPnl, rMultiple: Number(trial.realizedPnl ?? 0) / Math.max(1, Number(trial.entryPrice * trial.positionSize * trial.riskPercent / 100)), createdAt: trial.createdAt, completedAt: trial.completedAt, provider: trial.provider, freshness: trial.freshness, provenance: trial.provenance, setupQuality: trial.setupQuality, regime: trialRegime(trial), reason: (trial.currentSnapshot as any)?.reason ?? null })) };
}

export async function getAutoPaperActive(userId: number) {
  const history = await getAutoPaperHistory(userId);
  return history.filter(trial => ACTIVE_TRIAL_STATUSES.includes(trial.status as typeof ACTIVE_TRIAL_STATUSES[number]));
}

export function isAutoPaperOnlySource(source: string) { return source === AUTO_PAPER_SOURCE; }
export type AutoPaperMode = AdaptiveTradingMode;
