import { and, desc, eq, inArray, notInArray } from "drizzle-orm";
import { getDb } from "../db";
import { setupMonitorEvents, setupMonitorInstances } from "../../drizzle/schema";
import { getTradeSetups, type TradeSetupMode } from "./tradeSetup";
import type { ScoringConfig } from "../../shared/crypto";
import type { OpportunityDiscoveryItem } from "./opportunityDiscovery";
import { detectOpportunityLifecycleEvent } from "./opportunityEventStore";
import { lifecycleState } from "./opportunityLifecycle";

export const SETUP_MONITOR_VERSION = "SETUP_MONITOR_V1";
export const ACTIVE_MONITOR_STATUSES = ["NEW", "WATCH", "POTENTIAL", "QUALIFIED", "TARGET_1_REACHED", "TARGET_2_REACHED"] as const;
export const TERMINAL_MONITOR_STATUSES = ["TARGET_3_REACHED", "INVALIDATED", "ARCHIVED"] as const;
export type SetupMonitorStatus = typeof ACTIVE_MONITOR_STATUSES[number] | typeof TERMINAL_MONITOR_STATUSES[number] | "DATA_UNAVAILABLE";
export type SetupMonitorHealth = "HEALTHY" | "CAUTION" | "REVERSAL_RISK" | "INVALIDATED" | "DATA_UNAVAILABLE";
export type SetupMonitorEventType = "CREATED" | "STATE_CHANGED" | "TARGET_REACHED" | "CAUTION" | "REVERSAL_RISK" | "INVALIDATED" | "DATA_UNAVAILABLE" | "ARCHIVED";

type JsonRecord = Record<string, unknown>;

type MonitorPlan = {
  version: typeof SETUP_MONITOR_VERSION;
  instanceId: number;
  assetId: string;
  symbol: string;
  setupType: TradeSetupMode;
  timeframe: string;
  original: JsonRecord;
  current: JsonRecord;
  events: Array<typeof setupMonitorEvents.$inferSelect>;
};

const asJson = (value: unknown): JsonRecord | null => value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
const round = (value: number, digits = 4) => Number(value.toFixed(digits));
const setupMode = (value: string): TradeSetupMode => value === "SCALP" ? "SCALP" : "SWING";

export function monitorStatus(item: OpportunityDiscoveryItem): SetupMonitorStatus {
  if (item.status === "DATA UNAVAILABLE") return "DATA_UNAVAILABLE";
  if (item.status === "QUALIFIED") return "QUALIFIED";
  if (item.status === "POTENTIAL") return "POTENTIAL";
  if (item.status === "WATCH") return "WATCH";
  return item.maturity === "INVALIDATED" ? "INVALIDATED" : "WATCH";
}

export function healthFor(item: OpportunityDiscoveryItem, status: SetupMonitorStatus): { state: SetupMonitorHealth; reason: string } {
  if (status === "DATA_UNAVAILABLE") return { state: "DATA_UNAVAILABLE", reason: "Current validated market inputs are unavailable; setup health cannot be determined." };
  if (status === "INVALIDATED") return { state: "INVALIDATED", reason: "The current server-derived setup no longer satisfies its invalidation or structural conditions." };
  if (status === "REVERSAL_RISK" as SetupMonitorStatus) return { state: "REVERSAL_RISK", reason: "Required confirmation has deteriorated and the setup is approaching a derived invalidation condition." };
  if (status === "QUALIFIED" || status === "TARGET_1_REACHED" || status === "TARGET_2_REACHED" || status === "TARGET_3_REACHED") return { state: "HEALTHY", reason: "Current validated evidence still supports the monitored setup thesis." };
  if (item.status === "WATCH") return { state: "REVERSAL_RISK", reason: "Directional confirmation is not currently complete; the monitored setup requires renewed evidence before qualification." };
  return { state: "CAUTION", reason: "The setup remains under observation while required confirmation is incomplete." };
}

export function targetProgress(item: OpportunityDiscoveryItem) {
  const price = item.readinessPlan.currentPrice;
  const readinessPlan = item.readinessPlan as OpportunityDiscoveryItem["readinessPlan"] & { entryZone?: OpportunityDiscoveryItem["readinessPlan"]["entryZone"] };
  const entry = Object.prototype.hasOwnProperty.call(readinessPlan, "entryZone") ? readinessPlan.entryZone?.preferred ?? null : item.readinessPlan.currentPrice;
  const invalidation = item.readinessPlan.invalidation?.price ?? null;
  const direction = item.direction === "SHORT" ? -1 : 1;
  return item.readinessPlan.targets.map((target, index) => {
    const reached = price != null && (item.direction === "SHORT" ? price <= target.price : price >= target.price);
    const targetDistance = entry != null ? Math.abs(target.price - entry) : null;
    const directionalProgress = price != null && entry != null && targetDistance && targetDistance > 0
      ? Math.min(100, Math.max(0, ((price - entry) * direction) / targetDistance * 100))
      : null;
    return {
      label: target.label,
      price: target.price,
      reached,
      status: reached ? "REACHED" : "PENDING",
      distancePercent: price != null ? round(Math.abs(target.price - price) / Math.max(price, Number.EPSILON) * 100, 2) : null,
      progressPercent: reached ? 100 : directionalProgress == null ? null : round(directionalProgress, 2),
      distanceFromEntryPercent: price != null && entry != null ? round(Math.abs(price - entry) / Math.max(Math.abs(entry), Number.EPSILON) * 100, 2) : null,
      distanceToInvalidationPercent: price != null && invalidation != null ? round(Math.abs(price - invalidation) / Math.max(Math.abs(price), Number.EPSILON) * 100, 2) : null,
      ordinal: index + 1,
    };
  });
}

export function reachedStatus(progress: ReturnType<typeof targetProgress>, base: SetupMonitorStatus): SetupMonitorStatus {
  const reached = progress.filter(target => target.reached);
  if (!reached.length || base === "INVALIDATED" || base === "DATA_UNAVAILABLE") return base;
  const last = reached[reached.length - 1].ordinal;
  return last >= 3 ? "TARGET_3_REACHED" : last === 2 ? "TARGET_2_REACHED" : "TARGET_1_REACHED";
}

function evidenceSnapshot(item: OpportunityDiscoveryItem, status: SetupMonitorStatus) {
  const health = healthFor(item, status);
  const progress = targetProgress(item);
  return {
    version: SETUP_MONITOR_VERSION,
    capturedAt: Date.now(),
    assetId: item.assetId,
    symbol: item.symbol,
    setupType: item.mode,
    timeframe: item.timeframes,
    status,
    maturity: item.maturity,
    setupReadiness: item.setupReadiness,
    opportunityScore: item.opportunityScore,
    direction: item.direction,
    provider: item.provider,
    dataTimestamp: item.dataTimestamp,
    freshness: item.freshness,
    validationStatus: item.validationStatus,
    regime: item.regime,
    timeframeAgreement: item.timeframeAgreement,
    whyInteresting: item.whyInteresting,
    missingEvidence: item.missingEvidence,
    confirmationRequirements: item.confirmationRequirements,
    entryZone: item.readinessPlan.entryZone,
    stop: item.sourcePlan.stop,
    targets: item.readinessPlan.targets,
    invalidation: item.readinessPlan.invalidation,
    rewardRisk: item.readinessPlan.rewardRisk,
    currentPrice: item.readinessPlan.currentPrice,
    targetProgress: progress,
    health,
    reason: item.exactReason,
    dataReason: item.dataReason,
    currentStateReason: health.reason,
    sourcePresentationStatus: item.sourcePresentationStatus,
  } satisfies JsonRecord;
}

function instanceView(row: typeof setupMonitorInstances.$inferSelect, events: Array<typeof setupMonitorEvents.$inferSelect>): MonitorPlan {
  return { version: SETUP_MONITOR_VERSION, instanceId: row.id, assetId: row.assetId, symbol: String((asJson(row.immutableCreationSnapshot)?.symbol ?? row.assetId)), setupType: setupMode(row.setupType), timeframe: row.timeframe, original: asJson(row.immutableCreationSnapshot) ?? {}, current: { status: row.currentStatus, readiness: row.currentReadinessSnapshot, currentPrice: row.currentPrice, technicalState: row.currentTechnicalState, providerProvenance: row.currentProviderProvenance, stateReason: row.currentStateReason, lastValidatedAt: row.lastValidatedAt, terminalAt: row.terminalAt }, events };
}

async function currentItem(assetId: string, mode: TradeSetupMode, configuration: ScoringConfig) {
  const response = await getTradeSetups(mode, configuration);
  const item = response.discovery.items.find(candidate => candidate.assetId === assetId);
  if (!item) throw new Error("Asset is not available in the current server-authoritative setup universe.");
  return item;
}

async function insertEvent(db: Awaited<ReturnType<typeof getDb>>, instanceId: number, event: { key: string; type: SetupMonitorEventType; reason: string; price: number | null; timeframe: string | null; provider: string | null; provenance: unknown; freshness: string | null }) {
  if (!db) throw new Error("Database is unavailable.");
  const existing = await db.select({ id: setupMonitorEvents.id }).from(setupMonitorEvents).where(and(eq(setupMonitorEvents.instanceId, instanceId), eq(setupMonitorEvents.eventKey, event.key))).limit(1);
  if (existing.length) return false;
  try {
    await db.insert(setupMonitorEvents).values({ instanceId, eventKey: event.key, eventType: event.type, reason: event.reason, relevantPrice: event.price, relevantTimeframe: event.timeframe, provider: event.provider, provenance: event.provenance as any, freshness: event.freshness });
    return true;
  } catch (error) {
    if (String(error).includes("Duplicate") || String(error).includes("duplicate") || String(error).includes("1062")) return false;
    throw error;
  }
}

export async function createSetupMonitor(userId: number, assetId: string, mode: TradeSetupMode, configuration: ScoringConfig) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const item = await currentItem(assetId, mode, configuration);
  if (!["POTENTIAL", "QUALIFIED", "WATCH"].includes(item.status)) throw new Error("Only Potential, Qualified, or Watch setups can be explicitly saved for monitoring.");
  const status = monitorStatus(item);
  const snapshot = evidenceSnapshot(item, status);
  const inserted = await db.insert(setupMonitorInstances).values({ userId, assetId: item.assetId, setupType: mode, timeframe: JSON.stringify(item.timeframes), immutableCreationSnapshot: snapshot, originalStatus: status, originalReadinessSnapshot: item.setupReadiness, originalOpportunitySnapshot: { opportunityScore: item.opportunityScore, direction: item.direction, regime: item.regime }, originalTechnicalEvidence: { whyInteresting: item.whyInteresting, timeframeAgreement: item.timeframeAgreement, evidence: item.sourcePlan.evidence }, originalEntryZone: item.readinessPlan.entryZone, originalStopLoss: item.sourcePlan.stop?.price ?? null, originalTargets: item.readinessPlan.targets, originalInvalidationCondition: item.readinessPlan.invalidation, originalProviderProvenance: { provider: item.provider, dataTimestamp: item.dataTimestamp, freshness: item.freshness, validationStatus: item.validationStatus }, currentStatus: status, currentReadinessSnapshot: item.setupReadiness, currentPrice: item.readinessPlan.currentPrice, currentTechnicalState: { health: snapshot.health, targetProgress: snapshot.targetProgress, direction: item.direction, currentSnapshot: snapshot }, currentProviderProvenance: { provider: item.provider, dataTimestamp: item.dataTimestamp, freshness: item.freshness, validationStatus: item.validationStatus }, currentStateReason: snapshot.currentStateReason, lastValidatedAt: item.dataTimestamp ? new Date(item.dataTimestamp) : null }).$returningId();
  const instanceId = inserted[0]?.id;
  if (!instanceId) throw new Error("Setup Monitor instance was not created.");
  await insertEvent(db, instanceId, { key: "CREATED", type: "CREATED", reason: `Saved ${status} setup for server-authoritative monitoring.`, price: item.readinessPlan.currentPrice, timeframe: JSON.stringify(item.timeframes), provider: item.provider, provenance: snapshot, freshness: item.freshness });
  return getSetupMonitorDetail(userId, instanceId);
}

export async function listActiveSetupMonitors(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const rows = await db.select().from(setupMonitorInstances).where(and(eq(setupMonitorInstances.userId, userId), notInArray(setupMonitorInstances.currentStatus, [...TERMINAL_MONITOR_STATUSES]))).orderBy(desc(setupMonitorInstances.updatedAt));
  return rows.map(row => instanceView(row, []));
}

export async function listSetupMonitorHistory(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const rows = await db.select().from(setupMonitorInstances).where(and(eq(setupMonitorInstances.userId, userId), inArray(setupMonitorInstances.currentStatus, [...TERMINAL_MONITOR_STATUSES]))).orderBy(desc(setupMonitorInstances.updatedAt));
  return rows.map(row => instanceView(row, []));
}

export async function getSetupMonitorDetail(userId: number, instanceId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const rows = await db.select().from(setupMonitorInstances).where(and(eq(setupMonitorInstances.id, instanceId), eq(setupMonitorInstances.userId, userId))).limit(1);
  const row = rows[0];
  if (!row) throw new Error("Setup Monitor instance not found.");
  const events = await db.select().from(setupMonitorEvents).where(eq(setupMonitorEvents.instanceId, instanceId)).orderBy(desc(setupMonitorEvents.createdAt));
  return instanceView(row, events);
}

export async function refreshSetupMonitor(userId: number, instanceId: number, configuration: ScoringConfig) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const rows = await db.select().from(setupMonitorInstances).where(and(eq(setupMonitorInstances.id, instanceId), eq(setupMonitorInstances.userId, userId))).limit(1);
  const existing = rows[0];
  if (!existing) throw new Error("Setup Monitor instance not found.");
  if (existing.currentStatus === "ARCHIVED") throw new Error("Archived Setup Monitor instances cannot be refreshed.");
  const existingStatus = existing.currentStatus as SetupMonitorStatus;
  const item = await currentItem(existing.assetId, setupMode(existing.setupType), configuration);
  const baseStatus = monitorStatus(item);
  const progress = targetProgress(item);
  const nextStatus = reachedStatus(progress, baseStatus);
  const snapshot = evidenceSnapshot(item, nextStatus);
  const previousState = asJson(existing.currentTechnicalState) ?? {};
  const previousProgress = Array.isArray(previousState.targetProgress) ? previousState.targetProgress as Array<{ ordinal?: number; reached?: boolean }> : [];
  const events: Array<{ key: string; type: SetupMonitorEventType; reason: string; price: number | null; timeframe: string | null; provider: string | null; provenance: unknown; freshness: string | null }> = [];

  if (nextStatus !== existing.currentStatus) {
    const eventAt = Date.now();
    const previousLifecycleState = lifecycleStateFromMonitorStatus(existingStatus);
    const lifecycleEvent = previousLifecycleState ? detectOpportunityLifecycleEvent(previousLifecycleState, item, eventAt) : null;
    if (lifecycleEvent) {
      events.push({
        key: lifecycleEvent.key,
        type: lifecycleEvent.type === "INVALIDATED" ? "INVALIDATED" : "STATE_CHANGED",
        reason: `Opportunity lifecycle changed from ${lifecycleEvent.from ?? "NONE"} to ${lifecycleEvent.to}.`,
        price: lifecycleEvent.price,
        timeframe: JSON.stringify(item.timeframes),
        provider: item.provider,
        provenance: lifecycleEvent.snapshot,
        freshness: item.freshness,
      });
    } else {
      events.push({ key: `STATE:${nextStatus}:${eventAt}`, type: nextStatus === "INVALIDATED" ? "INVALIDATED" : nextStatus === "DATA_UNAVAILABLE" ? "DATA_UNAVAILABLE" : "STATE_CHANGED", reason: `Setup state changed from ${existing.currentStatus} to ${nextStatus}.`, price: item.readinessPlan.currentPrice, timeframe: JSON.stringify(item.timeframes), provider: item.provider, provenance: snapshot, freshness: item.freshness });
    }
  }
  for (const target of progress) if (target.reached && !previousProgress.some(previous => previous.ordinal === target.ordinal && previous.reached)) events.push({ key: `TARGET:${target.ordinal}`, type: "TARGET_REACHED", reason: `${target.label} was reached by the current validated price.`, price: item.readinessPlan.currentPrice, timeframe: JSON.stringify(item.timeframes), provider: item.provider, provenance: snapshot, freshness: item.freshness });
  const health = snapshot.health as { state: SetupMonitorHealth; reason: string };
  if (health.state === "CAUTION") events.push({ key: "HEALTH:CAUTION", type: "CAUTION", reason: health.reason, price: item.readinessPlan.currentPrice, timeframe: JSON.stringify(item.timeframes), provider: item.provider, provenance: snapshot, freshness: item.freshness });
  if (health.state === "REVERSAL_RISK") events.push({ key: "HEALTH:REVERSAL_RISK", type: "REVERSAL_RISK", reason: health.reason, price: item.readinessPlan.currentPrice, timeframe: JSON.stringify(item.timeframes), provider: item.provider, provenance: snapshot, freshness: item.freshness });
  const unavailable = nextStatus === "DATA_UNAVAILABLE";
  const terminalAt = TERMINAL_MONITOR_STATUSES.includes(nextStatus as typeof TERMINAL_MONITOR_STATUSES[number]) ? new Date() : existing.terminalAt;
  const unavailableObservation = { observedAt: Date.now(), provider: item.provider, dataTimestamp: item.dataTimestamp, freshness: item.freshness, validationStatus: item.validationStatus, reason: health.reason };
  await db.update(setupMonitorInstances).set({ currentStatus: nextStatus, currentReadinessSnapshot: unavailable ? existing.currentReadinessSnapshot : item.setupReadiness, currentPrice: unavailable ? existing.currentPrice : item.readinessPlan.currentPrice, currentTechnicalState: unavailable ? { ...previousState, health, unavailableObservation } : { health, targetProgress: progress, direction: item.direction, currentSnapshot: snapshot }, currentProviderProvenance: unavailable ? { ...(asJson(existing.currentProviderProvenance) ?? {}), unavailableObservation } : { provider: item.provider, dataTimestamp: item.dataTimestamp, freshness: item.freshness, validationStatus: item.validationStatus }, currentStateReason: health.reason, lastValidatedAt: unavailable ? existing.lastValidatedAt : item.dataTimestamp ? new Date(item.dataTimestamp) : new Date(), terminalAt }).where(and(eq(setupMonitorInstances.id, instanceId), eq(setupMonitorInstances.userId, userId)));
  for (const event of events) await insertEvent(db, instanceId, event);
  return getSetupMonitorDetail(userId, instanceId);
}

function lifecycleStateFromMonitorStatus(status: SetupMonitorStatus) {
  if (["WATCH", "POTENTIAL", "QUALIFIED", "TARGET_1_REACHED", "TARGET_2_REACHED", "TARGET_3_REACHED", "INVALIDATED", "ARCHIVED"].includes(status)) return status as Parameters<typeof detectOpportunityLifecycleEvent>[0];
  return null;
}

export async function archiveSetupMonitor(userId: number, instanceId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const result = await db.update(setupMonitorInstances).set({ currentStatus: "ARCHIVED", terminalAt: new Date(), currentStateReason: "Monitoring was explicitly archived by the owner; historical evidence is retained." }).where(and(eq(setupMonitorInstances.id, instanceId), eq(setupMonitorInstances.userId, userId)));
  if (!result) throw new Error("Setup Monitor instance was not archived.");
  await insertEvent(db, instanceId, { key: "ARCHIVED", type: "ARCHIVED", reason: "Monitoring was explicitly archived by the owner; history is retained.", price: null, timeframe: null, provider: null, provenance: null, freshness: null });
  return getSetupMonitorDetail(userId, instanceId);
}

export function monitorStateLabel(status: SetupMonitorStatus) {
  return status === "DATA_UNAVAILABLE" ? "DATA UNAVAILABLE" : status.replaceAll("_", " ");
}