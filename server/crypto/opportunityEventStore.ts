import type { OpportunityDiscoveryItem } from "./opportunityDiscovery";
import { buildLifecycleEvent, lifecycleState, type OpportunityLifecycleEvent } from "./opportunityLifecycle";

/**
 * Pure lifecycle bridge. The monitor can call this with the previous canonical
 * state and current discovery item. Persistence/notification adapters consume
 * the returned immutable event; no scoring logic is duplicated here.
 */
export function detectOpportunityLifecycleEvent(
  previousState: ReturnType<typeof lifecycleState>,
  item: OpportunityDiscoveryItem,
  eventAt = Date.now(),
): OpportunityLifecycleEvent | null {
  return buildLifecycleEvent(previousState, item, eventAt);
}

export function shouldNotifyLifecycleEvent(event: OpportunityLifecycleEvent | null) {
  if (!event) return false;
  return event.type === "POTENTIAL_STARTED" || event.type === "QUALIFIED_STARTED";
}

export function shouldDispatchLifecycleNotification(inserted: boolean, event: OpportunityLifecycleEvent | null) {
  return inserted && shouldNotifyLifecycleEvent(event);
}
