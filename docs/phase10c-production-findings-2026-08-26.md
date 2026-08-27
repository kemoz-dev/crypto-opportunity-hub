# Phase 10C Production Findings — 2026-08-26

The production domain `https://cryptohub-dfa6xdxp.manus.space` responded with HTTP 200 for the root shell. The browser loaded the Manus billing/hosting limitation banner and remained blank aside from the owner-notification and Manus chrome; no authenticated Crypto Opportunity Hub workspace rendered.

Read-only API probing after deployment propagation confirmed the implemented Setup Monitor procedures are now present under both `/api/trpc` and `/api/v1/trpc`. Unauthenticated requests returned HTTP 401 with the expected `UNAUTHORIZED` / `Please login` response for active list, history list, detail, create, refresh, and archive procedures. This replaces the earlier HTTP 404 observation.

The browser session did not provide an authenticated application view, so authenticated empty-state, cross-user, and legitimate setup-creation verification were not performed. No mutation, setup creation, Paper Trade, alert, setting change, or database alteration was attempted. The database tables were previously verified read-only and present with zero rows.


Through the connected browser session, production rendered the authenticated application and the Setup Monitor workspace. The page showed `ONLINE · SERVER AUTHORITATIVE`, `Active setups` with no saved setups, and `History` with no terminal setups. The workspace text states that saved Potential, Qualified, and Watch setups are re-evaluated only on authenticated refresh and that monitoring does not open a Paper Trade, send an alert, or change original evidence. No create, refresh, archive, or Paper Trade action was invoked.

The same read-only page showed current provider evidence: market regime `RISK OFF` at 30/100; Binance Futures HTTP 451 region restriction; Kraken Spot last success but invalid due missing/zero candle volume; no cross-provider series was constructed. This is a live-data limitation for current setup availability, not a Setup Monitor deployment/API failure.
