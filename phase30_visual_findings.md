# Phase 30 Visual QA Findings

## Desktop 1440px

The canonical `/opportunities` Feed, `/decision` Decision Center, and `/asset/btc` Opportunity Workspace all render with the intended terminal hierarchy. The workspace header presents asset identity and data badges, while loading and unavailable states remain explicit and do not fabricate market values.

## Mobile 390px

The Feed preserves Market State, filters, honest loading/unavailable behavior, and bottom navigation. Decision Center preserves its summary-first hierarchy. The Asset Workspace now presents `BACK TO OPPORTUNITIES` as a full-width touch target, followed by OHLCV/provider badges and the DATA STATUS block; the earlier clipping defect is resolved. No horizontal overflow was observed in the captured viewport.

The live preview currently returns a server-validation/unavailable state, so the screenshots verify the honest outage/loading boundaries rather than asserting live opportunity values.

## Acceptance follow-up

At 390px with `status=potential&strategy=scalp&direction=long`, the Feed now shows a compact `3 FILTERS` summary with removable `POTENTIAL`, `SCALP`, and `LONG` chips plus `CLEAR ALL`. The summary remains above the result area, respects the mobile bottom navigation, and shows no horizontal overflow in the captured viewport.
