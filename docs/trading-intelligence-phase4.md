# Phase 4 — Trading Intelligence and Trade Monitoring

## Scope

Phase 4 is an additive, server-authoritative interpretation and monitoring layer for the existing Scalping, Swing, and simulated Paper Trading workspaces. It preserves **Opportunity Score**, **Regime Score**, all indicator calculations, provider selection and coherence gates, Paper Trading entry economics, alert behavior, research methodology, scheduled jobs, and the prohibition on real trading. The phase adds neither an exchange integration nor a browser-side data provider.

| Area | Phase 4 behavior | Explicit boundary |
|---|---|---|
| Setup presentation | `QUALIFIED`, `WATCH`, and `NO TRADE` are descriptive states derived from the existing setup result. | No setup threshold, score, or risk/reward rule changes. |
| Ranking | Qualified setups are ordered only by the existing Opportunity Score. | No new composite ranking or hidden competing score. |
| Watch | Coherent current inputs may be shown as Watch only when an existing directional or R:R confirmation remains absent. | A global `RISK OFF` rejection remains `NO TRADE`, not Watch. |
| Targets | Existing structural targets and ATR extensions are displayed with target-specific R:R explanation. | No target is created when the established setup engine cannot derive one. |
| Trade Health | Current validated data is compared with the immutable entry plan. | Entry evidence is never overwritten by a current scan. |
| Monitoring | The user manually requests a refresh; material events remain deduplicated. | No timer, cron, automatic close, reversal, trailing stop, or notification is added. |

## Setup Interpretation

Each Scalping and Swing response retains the Phase 3 coherent provider bundle, individual timeframe evidence, diagnostic cards, and existing entry-plan data. Phase 4 adds a presentational status and, for a Watch state, a concise list of the exact existing confirmations that remain missing and the existing conditions that would need to pass. The UI does not offer a Paper Trading action for Watch or No Trade cards.

An actionable card retains its server-derived entry zone, preferred entry, structural stop, invalidation, and one to three validated targets. The displayed per-target R:R is a transparent explanation calculated from the existing entry and stop levels; it does not create or modify any trading level. The Asset Intelligence route remains the technical-chart inspection surface so that current workspace cards do not duplicate or fabricate chart overlays.

## Immutable Entry and Current Trade Health

When a user explicitly opens a simulated Paper Trade with a valid Scalping or Swing context, the server revalidates the setup and stores the selected setup plan inside the existing immutable entry snapshot. The snapshot includes the setup mode, direction, provider, timestamp, validated timeframes, entry zone, stop, invalidation, targets, evidence, and risks when available. Existing Paper Trading position size, ATR stop, 2R economics, ownership checks, and manual close flow are unchanged.

Current Trade Health is a separate reference. A health result is available only when the current scanner provides a coherent and live provider bundle for the required technical frames. The outcome is **HEALTHY**, **CAUTION**, **REVERSAL RISK**, **INVALIDATED**, or **HEALTH UNKNOWN**. Stale or unavailable current data yields **HEALTH UNKNOWN** and an unavailable target path; the implementation does not extrapolate a mark, target status, or technical state.

| Health state | Current interpretation | Automated consequence |
|---|---|---|
| HEALTHY | Current validated technical evidence supports the immutable thesis. | None. |
| CAUTION | The setup remains valid but execution-timeframe momentum has weakened. | None. |
| REVERSAL RISK | Current execution and confirmation evidence no longer support the original thesis. | None. |
| INVALIDATED | The immutable invalidation level was crossed using a current validated price. | None. |
| HEALTH UNKNOWN | Coherent current data is unavailable or stale, or the entry has no immutable setup plan. | None. |

## Workspace and Offline Behavior

The Scalping and Swing workspaces show data quality, provider provenance, current regime context, ranked qualified cards, Watch evidence, No Trade diagnostics, and a direct Asset Intelligence inspection action. The Paper Trading workspace presents account totals, position health counts, presentation-only filters for health and strategy mode, responsive open-position cards, and an expandable detail view that separates immutable Entry State from Current State.

The PWA remains static-shell cached only. Offline mode remains read-only: creating or closing a Paper Trade and manually refreshing Trade Health are disabled, and existing current data is not cached as authoritative. No provider credentials, database credentials, scheduler secrets, or exchange credentials are exposed in browser code.

## Validation Boundary

The phase is validated with deterministic setup, target-path, stale-data, snapshot-immutability, Paper Trading accounting, and filter tests; TypeScript; production build; static secret/cache inspection; and desktop/mobile-class visual checks. A controlled production smoke check is required after publication to report the actual provider/regime/setup state. The smoke check must not open, close, or refresh any simulated position unless an explicit user-authorized test position already exists.
