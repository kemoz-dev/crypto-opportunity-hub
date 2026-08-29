import type { OpportunityDiscoveryItem, OpportunityDiscoveryStatus } from "./opportunityDiscovery";

/**
 * Canonical lifecycle helpers for the Opportunity Feed.
 *
 * The discovery engine remains the source of truth for the current state.
 * This module only turns a state transition into a small, immutable event
 * payload that can be persisted and used by the notification layer.
 */
export const OPPORTUNITY_LIFECYCLE_VERSION = "OPPORTUNITY_LIFECYCLE_V1" as const;

export type OpportunityLifecycleState = Extract<OpportunityDiscoveryStatus, "WATCH" | "POTENTIAL" | "QUALIFIED"> | "TARGET_1_REACHED" | "TARGET_2_REACHED" | "TARGET_3_REACHED" | "INVALIDATED" | "ARCHIVED";

export type OpportunityLifecycleEventType =
  | "CREATED"
  | "WATCH_STARTED"
  | "POTENTIAL_STARTED"
  | "QUALIFIED_STARTED"
  | "TARGET_REACHED"
  | "INVALIDATED"
  | "ARCHIVED";

export type OpportunityLifecycleSnapshot = {
  version: typeof OPPORTUNITY_LIFECYCLE_VERSION;
  capturedAt: number;
  assetId: string;
  symbol: string;
  state: OpportunityLifecycleState;
  price: number | null;
  opportunityScore: number | null;
  technicalScore: number | null;
  direction: OpportunityDiscoveryItem["direction"];
  entryZone: OpportunityDiscoveryItem["readinessPlan"]["entryZone"];
  stop: OpportunityDiscoveryItem["sourcePlan"]["stop"];
  targets: OpportunityDiscoveryItem["readinessPlan"]["targets"];
  invalidation: OpportunityDiscoveryItem["readinessPlan"]["invalidation"];
  provider: string | null;
  dataTimestamp: number | null;
  reasons: string[];
};

export type OpportunityLifecycleEvent = {
  version: typeof OPPORTUNITY_LIFECYCLE_VERSION;
  type: OpportunityLifecycleEventType;
  from: OpportunityLifecycleState | null;
  to: OpportunityLifecycleState;
  eventAt: number;
  price: number | null;
  snapshot: OpportunityLifecycleSnapshot;
};

const isLifecycleState = (value: string): value is OpportunityLifecycleState =>
  ["WATCH", "POTENTIAL", "QUALIFIED", "TARGET_1_REACHED", "TARGET_2_REACHED", "TARGET_3_REACHED", "INVALIDATED", "ARCHIVED"].includes(value);

export function lifecycleState(item: OpportunityDiscoveryItem): OpportunityLifecycleState | null {
  if (isLifecycleState(item.status)) return item.status;
  if (item.maturity === "INVALIDATED") return "INVALIDATED";
  return null;
}

export function lifecycleSnapshot(item: OpportunityDiscoveryItem, state: OpportunityLifecycleState, capturedAt = Date.now()): OpportunityLifecycleSnapshot {
  const score = item.opportunityScore;
  const scoreRecord = score && typeof score === "object" ? score as unknown as { technicalScore?: number | null } : null;

  return {
    version: OPPORTUNITY_LIFECYCLE_VERSION,
    capturedAt,
    assetId: item.assetId,
    symbol: item.symbol,
    state,
    price: item.readinessPlan.currentPrice,
    opportunityScore: item.opportunityScore,
    technicalScore: scoreRecord?.technicalScore ?? null,
    direction: item.direction,
    entryZone: item.readinessPlan.entryZone,
    stop: item.sourcePlan.stop,
    targets: item.readinessPlan.targets,
    invalidation: item.readinessPlan.invalidation,
    provider: item.provider,
    dataTimestamp: item.dataTimestamp,
    reasons: item.whyInteresting.slice(0, 4),
  };
}

const eventTypeFor = (to: OpportunityLifecycleState): OpportunityLifecycleEventType => {
  if (to === "WATCH") return "WATCH_STARTED";
  if (to === "POTENTIAL") return "POTENTIAL_STARTED";
  if (to === "QUALIFIED") return "QUALIFIED_STARTED";
  if (to === "INVALIDATED") return "INVALIDATED";
  if (to === "ARCHIVED") return "ARCHIVED";
  return "TARGET_REACHED";
};

/**
 * Returns an event only when the canonical opportunity state changes.
 * This deliberately does not emit an event for score-only fluctuations.
 */
export function buildLifecycleEvent(
  previousState: OpportunityLifecycleState | null,
  item: OpportunityDiscoveryItem,
  eventAt = Date.now(),
): OpportunityLifecycleEvent | null {
  const nextState = lifecycleState(item);
  if (!nextState || previousState === nextState) return null;

  return {
    version: OPPORTUNITY_LIFECYCLE_VERSION,
    type: eventTypeFor(nextState),
    from: previousState,
    to: nextState,
    eventAt,
    price: item.readinessPlan.currentPrice,
    snapshot: lifecycleSnapshot(item, nextState, eventAt),
  };
}
