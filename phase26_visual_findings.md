# Phase 26 Visual and Runtime Findings

## Preview visual QA

- Desktop 1280px `/asset/bitcoin`: the canonical route opens the Asset Trade Investigation dialog; Summary and Provenance are visible, the chart/plan area continues below the viewport, and the dialog remains bounded without horizontal clipping.
- iPhone 375px `/asset/BTC`: canonical symbol normalization resolves to Bitcoin. The mobile header shows `DATA STATUS` separately from `NETWORK CONNECTED`, with `Last validated: UNAVAILABLE` when the server has not returned a validated asset response. The full-screen dialog remains within the viewport and the mobile bottom navigation no longer covers the visible content after the safe-area bottom padding change.
- The 375px capture occurred while the dev runtime was reconnecting and asset evidence was loading, so this is an honest loading/unavailable observation rather than evidence of live market data.

## Production observation

- The published host remains limited/stale from the previous deployment observation and returned the known 404/limited behavior for the canonical asset route. No authentication bypass or mutation was attempted. A fresh production propagation check is required after the Phase 26 checkpoint.

## Mobile overlay finding

The first 390px capture showed the persistent bottom navigation visually covering the lower edge of the Asset Workspace. The shared DialogContent default is `z-50`, while the navigation uses `z-[80]`; safe-area content padding alone did not guarantee that fixed chrome could not overlay the dialog. The final fix adds a document-level asset-workspace state and hides only `.pwa-mobile-nav` while the investigation is open. Follow-up 390px, 375px, and 414px captures show the full-screen workspace without the navigation covering content. The close control remains visible, and the mobile Data Status block remains separate from network connectivity. The 414px capture also remains clean while OHLCV is unavailable and the view is loading honestly.

## Unknown asset QA

The 390px `/asset/not-a-supported-coin` capture renders `ASSET NOT FOUND`, explains that no canonical tracked asset matches the identifier, and states that no provider request was made. The route remains full-screen and does not show fabricated market values.

## Integrity notes

- No synthetic price, candle, score, setup, regime, Auto Paper trial, or event was added.
- Unknown canonical asset IDs are blocked before the asset intelligence and protected Auto Paper queries run.
- Service Worker behavior remains static-shell-only; `/api/` requests are bypassed by the worker.
