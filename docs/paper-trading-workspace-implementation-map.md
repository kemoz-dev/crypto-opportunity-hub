# Paper Trading 2.0 — Implementation Map

## Existing architecture to reuse

| Concern | Existing source | Reuse boundary |
| --- | --- | --- |
| Navigation shell | `client/src/pages/Home.tsx` | The single-page terminal already owns main-navigation state. Paper Trading will become an in-shell full-width workspace rather than a primary dialog. |
| Order and position workflow | `server/crypto/paperTrading.ts` | `openLivePaperTrade` and `closeLivePaperTrade` remain the only write paths. No client-side calculation is a source of truth. |
| Portfolio and P&L | `getPaperPortfolio`, `calculateMetrics` | Existing persistent trades plus current scanner prices provide realized/unrealized P&L and equity. New UI metrics must be derived from those fields only. |
| Persistence | `paperPortfolios`, `paperTrades` in `drizzle/schema.ts` | Existing starting capital, positions, exits, size, risk, R:R, and immutable snapshot remain canonical. No migration is required for presentation. |
| Entry evidence | `PaperTradeSnapshot`, `buildPaperTradeSnapshot` | The immutable snapshot already contains score, confidence, setup, regime, technical-by-timeframe evidence, provider-state data status within opportunity context, and entry terms. It is never reconstructed from live state. |
| Entry UI | `PaperTradingPanel.tsx` | Reuse existing LONG/SHORT and `openPaperTrade` mutation, but move it to a large confirmation workspace within the Paper Trading page. |
| Asset handoff | `AssetIntelligencePanel.tsx` and `Home.tsx` | Existing “Paper trade” selection hands a real `ScannerRow` into Paper Trading. The workspace will preserve this selected context and show the new position immediately after mutation invalidation. |
| Existing test baseline | `server/crypto/paperTrading.test.ts` | Existing 2R long/short, immutable-clone, and full-entry-evidence tests remain required. New tests extend derived metrics, equity points, filters, and entry/current-state separation. |

## Data that can be reliably displayed

| Display | Source | State if not available |
| --- | --- | --- |
| Starting capital, equity, realized/unrealized P&L, win rate, drawdown, profit factor, total/open trades | Existing `getPaperPortfolio().metrics` | `UNAVAILABLE` only if the portfolio query itself is unavailable. |
| Available cash | Starting capital + realized P&L − open-position entry notional | Derived from persistent trade records; explicitly labelled as paper cash estimate. |
| Average win/loss | Closed persistent `realizedPnl` values | `UNAVAILABLE` if no qualifying closed winners/losses exist. |
| Equity curve | Starting capital plus closed realized P&L in immutable exit order, followed by current equity | No fabricated interim marks; open P&L appears only at the current endpoint. |
| Open position current state | Current scanner price and score, alongside immutable entry snapshot | Current values become `UNAVAILABLE` if scanner data is unavailable; entry state remains visible. |
| Trade history and filters | Persisted `paperTrades` | Client-side display filtering only; records are never changed. |
| Fees/slippage | No persisted paper-trade execution-cost field | `UNAVAILABLE`; no estimate will be fabricated. |

## Workspace audit

| Current interface | Classification | Intended action |
| --- | --- | --- |
| Paper Trading | Information-dense | Convert primary navigation target to a full-width responsive workspace; retain compact confirmation as a child panel. |
| Trade detail and entry snapshot | Information-dense | Display in the Paper Trading workspace’s detail pane/full-height view, not a narrow dialog. |
| Asset Intelligence | Information-dense | Already large responsive dialog; retain it and ensure paper handoff closes/opens clear context rather than squeezing more content. |
| Research Lab/ResearchRunWorkspace | Information-dense | Already wide, tabbed, internally scrollable workspace; retain architecture. |
| Historical Data, Execution Cost Lab, Backup & Recovery | Information-dense | Already use wide internally scrollable dialogs; no logic/UI rewrite in this phase unless a direct clipping issue is found. |
| Settings and short confirmation/destructive actions | Quick action | Keep dialog treatment. |

## Explicit non-goals

This work does not alter the Opportunity Engine, score weights/thresholds, indicator or regime formulas, alerts, provider selection, historical ingestion, research methodology, real trading, desktop packaging, PDF export, or saved scanner filters. No research experiment is started. If the UI needs data outside the persistent trade/snapshot/current-scanner contract, it must show `UNAVAILABLE` rather than infer a value.
