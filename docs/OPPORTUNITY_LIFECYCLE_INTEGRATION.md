# Opportunity Lifecycle Integration

The canonical lifecycle is owned by `opportunityLifecycle.ts`.

The integration boundary is `opportunityEventStore.ts`:
- accepts the previous canonical state and current discovery item
- emits an immutable lifecycle event only when state changes
- never recalculates Opportunity or Technical Score
- identifies notification-worthy transitions as POTENTIAL_STARTED and QUALIFIED_STARTED

The existing Setup Monitor remains responsible for persistence of monitored setups. Its state transition events should consume this bridge so history and notifications share the same canonical event semantics.

## Required notification transitions
- WATCH -> POTENTIAL: notify
- POTENTIAL -> QUALIFIED: notify
- Other transitions remain in history and may be surfaced as optional alerts.

## Event snapshot requirements
Every lifecycle event carries event time and price plus Opportunity Score, Technical Score, direction, entry, stop, targets, invalidation, provider, data timestamp, and concise reasons.
