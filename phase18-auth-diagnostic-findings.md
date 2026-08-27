# Phase 18 Read-Only Authentication Diagnostic

Date: 2026-08-27

## Observed production session

The published dashboard loaded with live server-derived content and the Paper Trading summary showed a simulated portfolio value of 100,000, total P/L +0, zero open positions, and zero completed trades. This indicates the browser session was recognized as authenticated. No login, settings mutation, Auto Paper enablement, trade, trial, snapshot, alert, or schedule action was performed.

## Protected endpoint results with authenticated browser session

- `crypto.autoPaperAccount`: HTTP 200; account value was an empty/object empty state and the UI reported Auto Paper `OFF`, account `Not initialized`, equity unavailable, P/L 0.00.
- `crypto.autoPaperPerformance` with `{}`: HTTP 200; object response with safe metric keys including totalTrials, active, completed, winRate, simulatedPnl, currentEquity, startingCapital, insufficientSample, and sampleLabel.
- `crypto.autoPaperEquityCurve` with `{}`: HTTP 200; array length 2 (the UI reported no completed Auto Paper trials; points are not treated as persisted snapshot evidence).
- `crypto.autoPaperHistory` with `{}`: HTTP 200; array length 0.
- `crypto.autoPaperEquitySnapshots`: HTTP 404 on the currently published deployment.
- `crypto.autoPaperEquityHistory`: HTTP 404 on the currently published deployment.
- `crypto.autoPaperEquitySummary`: HTTP 404 on the currently published deployment.

## Clean unauthenticated requests

From a request context with no session cookies, `crypto.autoPaperAccount`, `crypto.autoPaperHistory`, `crypto.autoPaperPerformance`, and `crypto.autoPaperEquityCurve` each returned HTTP 401.

## PWA observations

The browser reported one active Service Worker registration, the page was controlled by the worker, and the cache list contained only `crypto-hub-shell-crypto-hub-pwa-r3-20260825`. No API response was intentionally cached or mutated during this diagnostic. The published `/sw.js` was inspected read-only; a final source-level cache-boundary review remains represented by the existing PWA contract tests.

## Boundary conclusion

The authenticated browser session can be used for owner-scoped read-only verification. The published deployment is behind the current source for the new Phase 18 snapshot/history procedure names (HTTP 404), while existing protected account/performance/curve/history procedures are accessible and empty. This diagnostic created no snapshot merely to populate the UI.
