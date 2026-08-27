# Phase 13 — Paper Trading Summary, Watchlist, and Frontend Loading

## Scope

Phase 13 adds three additive product capabilities on top of the published Phase 12 terminal. The Dashboard now includes a protected, read-only Paper Trading summary. The Monitor group now includes an authenticated Watchlist workspace backed by the existing `userSettings.watchlist` JSON field. Heavy workspaces are loaded through route-level dynamic imports and stable Vite vendor chunks.

The implementation does not alter Opportunity Score, Confidence Score, Regime Score, indicator formulas, provider priority, data-quality gates, Paper Trading accounting, Paper Trading open/close mechanics, alerts, schedules, Research Lab calculations, authentication, PWA cache policy, or real-trading boundaries.

## Paper Trading summary

The Dashboard calls `crypto.paperTradingSummary` only when the user is authenticated and the browser is online. The server first checks for an existing owner-scoped `paperPortfolios` row. If none exists, it returns an explicit empty state and performs no insert. If a portfolio exists, it reuses the established server-authoritative `getPaperPortfolio` presentation, including current equity, total P&L, open positions, win rate, and completed trade count.

This path is intentionally separate from `crypto.paperPortfolio`, whose historical behavior initializes a primary portfolio when needed for the full Paper Trading workspace. The Dashboard summary therefore cannot create a portfolio as a side effect. It is display-only and provides a link to the protected Paper Trading workspace for intentional user actions.

## Watchlist

The repository already contained a nullable `userSettings.watchlist` JSON field, so no migration was required. The server exposes four owner-scoped procedures: `watchlist`, `addWatchlistAsset`, and `removeWatchlistAsset`, plus the existing authenticated context boundary. Additions are validated against the canonical `assets` table, deduplicated, bounded to 100 asset IDs, and persisted only for the requesting user. The client enriches watched IDs with the existing server-derived scanner response; it never calls provider APIs directly and never infers a score or setup state.

Watchlist mutations are disabled when offline. The UI clearly distinguishes a followed asset from an actionable setup, alert, or Paper Trading position. Unknown or unavailable scanner data is shown as unavailable rather than fabricated. The workspace is reachable from the desktop Monitor group and the mobile More menu.

## Loading and bundle strategy

The Dashboard keeps the shell, scanner, control center, shared status tokens, and summary card eager. Asset Intelligence, Setup Monitor, Watchlist, Discovery, Scalping/Swing, Paper Trading, Research, historical, recovery, alert, and backtesting surfaces are lazy-loaded with React `lazy`/`Suspense`. Vite now emits stable `react`, `trpc`, `charts`, and `ui` vendor chunks. The build still reports a conservative large-chunk advisory for the eager application shell; this is documented as an optimization limitation, not treated as a false performance claim.

## Validation

Focused validation passed with 25 tests across the PWA contract, Paper Trading integrity, and settings suites, followed by TypeScript. The full regression suite, TypeScript, and production build passed. The production build emitted separate chunks for Watchlist, Paper Trading, Setup Monitor, Discovery, Asset Intelligence, Trade Setup, Research, Recovery, and vendor groups. The provider/secret scan found only the pre-existing authorized Google Maps frontend connector reference. The executable real-order scan found only the existing alert disclaimer stating that no paper or real trade was created. The service-worker scan confirmed API-path exclusion, non-GET exclusion, and absence of Paper Trading mutation caching.

Desktop visual verification showed the control center’s honest reconnecting/unavailable state and the authenticated-gated Watchlist sign-in state without horizontal overflow. A physical authenticated multi-user isolation test and a real provider-healthy Watchlist creation flow remain pending because the current preview is unauthenticated/provider-limited.

## Stop conditions and next validation

No simulated asset, score, setup, portfolio, trade, alert, or market value was created during validation. The next production validation should use a real authenticated owner session and a canonical asset already present in the published asset universe. It should verify one add, one protected read, and one remove, then confirm that no Paper Trade or alert row changes. No automated Watchlist alerts or automatic Paper Trading behavior are part of Phase 13.
