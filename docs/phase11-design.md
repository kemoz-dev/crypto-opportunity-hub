# Phase 11 Additive Design Contract

## Scope

Phase 11 extends the existing Phase 10C server-authoritative Setup Monitor and established Scalping/Swing presentation. It does not introduce a second setup engine, new providers, new schedules, new tables, score changes, alert actions, Paper Trading automation, or real trading.

## State boundary

`DISCOVERY` remains the public read-only Opportunity Discovery result. `CONDITIONAL SETUP` remains the existing validated candidate plan for Potential and Watch. `ACTIVE MONITORING` begins only after an authenticated owner explicitly saves a Potential, Qualified, or Watch setup. `INVALIDATED SETUP` is persisted as a terminal monitor state when the server-derived current item reaches invalidation.

The original snapshot remains immutable. It contains the original status, Opportunity and readiness snapshots, entry zone, preferred entry, targets, stop/invalidation, evidence, provider, timeframe, timestamp, freshness, and validation status. Current monitoring state is written separately in the existing JSON current-state columns and includes current price, current technical snapshot, target path, health, reversal-risk reason, current evidence, provider provenance, freshness, and validation timestamps.

## Plan levels

Entry zone and preferred entry continue to come only from the existing validated Trade Setup engine. Targets continue to use the existing validated swing-structure and ATR-extension levels; no target is padded or fabricated to fill T1/T2/T3. Stop and invalidation continue to use the existing structural pivot with its existing ATR buffer. R:R is descriptive and calculated from the actual preferred entry, stop, and each available target; it never changes Opportunity Score, Regime Score, or eligibility thresholds.

## Health and target path

Health is a deterministic presentation of the current server-derived state: `HEALTHY` when a qualified/target-progress setup remains supported, `CAUTION` while a Potential setup remains under observation, `REVERSAL_RISK` when Watch/confirmation deterioration is present, `INVALIDATED` after the existing invalidation gate, and `DATA_UNAVAILABLE` when required validated inputs are stale, incoherent, or unavailable. Reversal risk is phrased as increased risk with evidence; it is never presented as a certainty.

Target progress is direction-aware. A target is reached only when the current validated price is at or beyond it in the setup direction. Progress toward an unreached target is bounded to 0–100% using the original preferred entry and target. Once a target is passed, it is marked reached rather than displaying misleading negative or over-100% progress. Missing current price or invalidated/unavailable data stops live progress calculation.

## Events and safety

Only meaningful transitions generate events, and each event remains deduplicated by the existing `(instanceId, eventKey)` uniqueness rule. Refresh never creates a Paper Trade, alert, notification, or automatic close/stop/reversal. Mutations remain protected and online-only; the Service Worker remains static-shell-only and never caches protected Setup Monitor data.

## Evidence labels

Values calculated or selected by the server are labeled server-derived in the UI and retain provider, timeframe, timestamp, freshness, validation state, and provenance. UI filters and formatting are display-only. There are no user-input trading levels in this phase.


## Visual verification note

The desktop shell retained the established research-terminal hierarchy with Setup Monitor visible in the sidebar and no layout overflow. The mobile shell retained compact bottom navigation and safe-width cards without horizontal overflow; the reconnecting/data-unavailable state remained visible and did not fabricate live setups. Detailed Setup Monitor/Discovery controls require an authenticated online workspace because the current preview screenshot was on the dashboard shell.
