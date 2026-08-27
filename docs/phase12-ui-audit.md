# Phase 12 UI and Information-Architecture Audit

## Scope

The current product is a capable research terminal, but its navigation and presentation read as a long list of independent tools. The existing implementation is concentrated in `Home.tsx`, which owns the desktop sidebar, dashboard, scanner, overlay workspaces, and navigation state. The shared `DashboardLayout` template remains a generic scaffold and is not the active product shell. The PWA uses a compact primary-plus-More navigation, while desktop exposes almost every subsystem as a top-level destination.

## Findings

| Area | Current observation | UX consequence | Phase 12 response |
|---|---|---|---|
| Desktop navigation | Sixteen mostly flat entries, including research/data/admin tools and a planned Sectors item | High scanning cost and weak mental model | Group entries into Home, Trade, Analysis, Research, Monitor, and System |
| Mobile navigation | Five primary items plus a More drawer; Setup Monitor, Discovery, Alerts, and Research are discoverable but not grouped semantically | Good reachability, but weak relationship between destinations | Preserve primary-plus-secondary behavior and align labels with grouped IA |
| Dashboard | Strong regime/provider banner, scanner, sector rotation, and score controls; top cards are score-centric | User must navigate elsewhere to understand plans, health, active setups, and Paper Trading state | Add compact server-derived control-center sections |
| Opportunity presentation | Scanner rows, Discovery cards, Scalping/Swing cards, and Asset Intelligence use different layouts | Repeated concepts are learned multiple times | Introduce one reusable Opportunity Card contract and shared status tokens |
| Trade health | Setup Monitor has detailed health/progress; established setup cards have a lighter health label | Health semantics are not consistent across surfaces | Reuse the same text labels, evidence order, and unavailable treatment |
| No-trade and unavailable states | Existing copy is generally truthful and fail-closed, but appears in different card/panel styles | Data unavailability can feel like a broken screen | Standardize state panels while keeping `NO TRADE` separate from `DATA UNAVAILABLE` |
| Responsive layout | The shell is mobile-aware and uses safe-area CSS; scanner uses a wide grid and relies on responsive CSS | Dense tables and detail panels need deliberate narrow-screen treatment | Prefer stacked cards, horizontal scroll only for genuinely tabular data, and bounded dialogs |
| Dialogs and overlays | Many workspaces open as fixed full-screen sections or dialogs from Home | Context can be lost and navigation depth feels inconsistent | Keep functionality, but standardize overlay headers, back actions, and responsive content widths |
| Data and safety | tRPC queries and protected mutations are already server-authoritative; service worker is static-shell-only | Redesign must not introduce client calculations or cached private state | Keep all levels, health, scores, and summaries server-derived; preserve cache and auth boundaries |

## Target information architecture

| Group | Destinations | Access intent |
|---|---|---|
| Home | Dashboard | First landing and market control center |
| Trade | Scalping, Swing, Setup Monitor, Paper Trading | Active setup interpretation and simulated execution |
| Analysis | Market Scanner, Opportunity Discovery, Asset Intelligence | Explore and inspect current signals |
| Research | Research Lab, Research Summary, Historical Data, Execution Cost Lab, Backtesting | Historical and methodological analysis |
| Monitor | Watchlist, Alerts | Ongoing observation and user-defined monitoring |
| System | Data / Provider Health, Backup & Recovery, Settings | Operational status and configuration |

Existing Backup & Recovery, Research Summary, Historical Data, Execution Cost Lab, and Backtesting functionality will remain accessible through grouped navigation or contextual controls. The current Sectors item is still planned and will remain non-actionable rather than receiving fabricated content.

## Design decisions

The redesign will use the existing dark research-terminal visual language, but with stronger hierarchy: grouped navigation labels, compact section headers, consistent status badges, and cards that expose the evidence order users need first. Text labels will accompany color for every status. `DATA UNAVAILABLE` will remain a neutral unavailable state and will never be collapsed into `NO TRADE`. The Dashboard will summarize rather than duplicate the full Paper Trading, Research Lab, or Setup Monitor workspaces.

All new UI values are display-only unless they are already existing authenticated actions. Opportunity scores, regime values, levels, health, target progress, timestamps, freshness, and provider provenance will continue to come from existing tRPC responses. No new scoring, provider, database, scheduler, alert, Paper Trading, or real-trading behavior is part of this redesign.


## Visual verification checkpoint

Desktop captures at 1440×1000 confirmed that the grouped sidebar is readable, the Market Control Center establishes a clear orientation layer, and the current unavailable/reconnecting state remains truthful rather than fabricating rows or scores. The dark quant-terminal palette, cyan action hierarchy, amber operational state, and compact section labels remain coherent. The full-page view also showed that the lower scanner and configuration sections retain the existing terminal rhythm without horizontal overflow at desktop width.

The screenshot reflects a live-data limitation in the preview runtime: the banner reports `RECONNECTING`, the regime and scanner values are unavailable, and skeletons remain visible while the server-validated response is pending. This is expected state handling, not a data fabrication or scoring change. Mobile capture remains required before release to verify the bottom navigation, grouped controls, and narrow-card reflow at phone and tablet widths.


## Mobile visual verification

A 390×844 full-page capture confirmed the bottom mobile navigation remains visible with Home/Discovery as the primary context and Scalping, Swing, and Setup Monitor discoverable in the secondary row. The Market Control Center reflows into a single-column metric stack, its workspace actions wrap without horizontal overflow, and the scanner cards remain contained within the viewport. Live rows rendered with real server-derived values in this capture; no fallback or fabricated values were introduced. The existing reconnecting/data-availability status remains prominent at the top, and the fixed mobile navigation does not overlap the lower content.
