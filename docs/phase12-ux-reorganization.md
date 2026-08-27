# Phase 12 — Crypto Hub UX Reorganization

## Scope

Phase 12 reorganizes the existing Crypto Opportunity Hub into a coherent dark quant research terminal. The work is presentation-only and additive: it changes information architecture, shared visual composition, responsive layout, and explanatory hierarchy without changing server calculations or action permissions.

## Information architecture

The desktop sidebar now groups workspaces into **Home**, **Trade**, **Analysis**, **Research**, **Monitor**, and **System** sections. Existing workspaces remain reachable, including Dashboard, Scalping, Swing, Setup Monitor, Paper Trading, Market Scanner, Opportunity Discovery, Asset Intelligence, Research Lab, Research Summary, Historical Data, Execution Cost Lab, Backtesting, Alerts, Provider Health, Backup & Recovery, Settings, and planned Watchlist/Sectors destinations.

The mobile shell preserves its primary-plus-secondary navigation pattern. Dashboard/Discovery remain the primary context, while Scalping, Swing, Paper Trading, Alerts, Research, and Setup Monitor remain discoverable without changing offline behavior.

## Dashboard control center

The Dashboard now includes a compact Market Control Center between source status and the opportunity overview. It summarizes only existing scanner response fields: market regime, scored-asset coverage, live-feed count, and latest scan age. It provides clear shortcuts to Discovery, Scalping, Swing, and Setup Monitor. No additional API request, threshold, score, or provider calculation was introduced.

## Shared opportunity presentation

`OpportunityCard` and `statusTokens` provide a consistent summary layer across Opportunity Discovery, Asset Intelligence, Scalping, Swing, and the Dashboard-adjacent flows. The card hierarchy is status first, then asset/direction/score, then levels and readiness, followed by health and rationale. Missing values remain explicitly `UNAVAILABLE`; the card never derives a score, target, stop, or eligibility from incomplete client data.

Paper Trading remains separately gated by each existing caller’s server-derived qualification and online state. The shared card exposes caller-provided actions only; it does not create trades, monitor events, alerts, or automatic actions.

## Responsive behavior

Desktop captures at 1440×1000 confirmed readable grouped navigation, control-center hierarchy, contained scanner layouts, and an honest reconnecting/unavailable state. Mobile captures at 390×844 confirmed single-column metric reflow, wrapped workspace shortcuts, contained scanner cards, fixed bottom navigation, and no horizontal overflow. The existing safe-area and scrollable-dialog rules remain active.

## Preserved boundaries

The redesign does not modify Opportunity Score, Confidence Score, Regime Score, technical indicators, provider selection or fallback policy, ingestion, schedules, alerts, Research Lab behavior, Paper Trading economics or ownership, real-trading restrictions, database schema, authentication, or the static-shell-only PWA cache policy. Browser provider endpoints and credentials remain absent from client code. Setup Monitor mutations remain online-only and owner-authenticated.

## Validation evidence

The focused Phase 12 PWA contract suite passed with 12 tests. The complete suite passed with **247 tests across 43 files**. TypeScript completed without errors. The production Vite frontend and esbuild server bundle completed successfully, with only the existing non-blocking chunk-size advisory. Desktop and mobile visual checks passed for Dashboard, Discovery, and Setup Monitor paths. The current runtime may still truthfully show reconnecting or unavailable market evidence when validated server data is unavailable; the redesign does not replace that state with mock data.
