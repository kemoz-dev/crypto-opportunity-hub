# Phase 18B Preview Visual Findings

Date: 2026-08-27

The preview Auto Paper Lab rendered the Phase 18B UI at the direct `?workspace=auto-paper` route. The shell remained responsive and exposed the existing responsive navigation. The Lab showed `AUTO PAPER OFF · auto paper is disabled`, the four existing mode choices, the simulation-only boundary, the existing controls, `AUTO PAPER BALANCE Not initialized`, `Available cash —`, `Today’s entries 0`, and the new chart empty state `AUTO PAPER ACCOUNT NOT INITIALIZED`. The date range controls showed Today, 7 Days, 30 Days, All Time, and Custom, with no snapshot or trial data created. Active trials, completed trials, comparisons, and feed were all honest empty states.

The preview itself showed the existing `RECONNECTING` / unavailable live-data shell and no authenticated session, so no settings mutation or snapshot capture was attempted. The earlier authenticated production session was used only for read-only endpoint diagnostics; the latest production deployment remained the prior version until this Phase 18B checkpoint propagates.

## Production propagation result

After checkpoint `ad8e30d1`, read-only requests to all six combinations of `/api/trpc` and `/api/v1/trpc` with `crypto.autoPaperEquitySnapshots`, `crypto.autoPaperEquityHistory`, and `crypto.autoPaperEquitySummary` still returned HTTP 404. The published HTML still carried the previous `crypto-hub-pwa-r3-20260825` marker and did not expose the new Phase 18B procedure names. No retry involving mutation, authentication bypass, schedule, or data creation was attempted. Under the supplied specification, this is a production propagation/runtime mismatch and Phase 18B remains INCOMPLETE until the exact checkpoint is reachable in Production.

## Phase 18C production synchronization result

After the Phase 18C republish checkpoint, all seven protected procedures returned HTTP 401 from clean unauthenticated requests under both `/api/trpc` and `/api/v1/trpc`, including all three Phase 18B snapshot procedures. This confirms that the routes are now present in the deployed runtime and are not publicly exposed.

The current browser page at Production displayed `Sign in` and `Authentication required`, so no authenticated owner session was available in this browser context to prove the required HTTP 200 results. No login bypass, credential creation, or mutation was attempted. Auto Paper remained OFF/not initialized, with no trials, snapshots, trades, settings changes, alerts, schedules, or real orders created. The Phase 18C acceptance criteria requiring authenticated 200 responses therefore remain incomplete pending a valid existing owner session.
