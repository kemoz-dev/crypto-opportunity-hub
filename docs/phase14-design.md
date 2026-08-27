# Phase 14 Design Contract

## Product direction

Crypto Hub remains a server-authoritative crypto intelligence terminal. Phase 14 is a presentation and isolated discovery enhancement: it makes the market state, opportunities, setup evidence, health, and limitations easier to understand without changing scoring, data methodology, provider policy, authorization, Paper Trading mechanics, alerts, schedules, Research Lab calculations, or real-trading restrictions.

## Information architecture

The primary desktop hierarchy is Dashboard, Opportunities, Scalping, Swing, Monitor, Paper Trading, Research, and Settings. Asset Intelligence remains an asset/detail destination rather than a competing top-level destination wherever the existing navigation flow already provides it. Secondary operational surfaces remain reachable through a More/System menu so no existing functionality is deleted.

Mobile prioritizes Dashboard, Opportunities, Scalping, Swing, and Monitor in bottom navigation. Paper Trading, Research, Settings, and operational tools remain in the accessible More surface. All menus, dialogs, and sheets retain safe-area padding, visible focus, keyboard reachability, readable labels, and complete scrolling content.

## Theme contract

Dark and Light are first-class themes. An explicit local preference wins; otherwise the first launch follows `prefers-color-scheme`. The selected theme is applied to semantic CSS variables and the document class, and the visible control exposes the current mode in text and with an accessible label. Status meaning is never conveyed by color alone.

## Opportunity evidence contract

The reusable Opportunity Card accepts only caller-provided server-derived fields. It may show asset identity, direction, opportunity/readiness scores, status, health, timeframe, provider, freshness, data-quality state, entry zone, invalidation/stop, validated targets, R:R, target progress, distance to invalidation, rationale, and confirmation gaps. Missing fields render as `Unavailable`, `No valid level`, or an explicit data-quality explanation; the browser never derives a score, target, entry, provider, timestamp, or trade state.

## Scalping ladder

The existing Bybit-native 1M/3M/5M route remains isolated and unchanged in its provider, mapping, coherence, freshness, candle, and fail-closed rules. Phase 14 may add a separate 15M Fast Scalp presentation only by reusing an existing validated 15M server bundle and the existing technical/trade-setup evidence. It must be labeled `15M Fast Scalp`, must disclose `1M/3M/5M unavailable`, and must never be represented as native 1M, 3M, or 5M data. If validated 15M evidence is unavailable or insufficient, the result remains `DATA UNAVAILABLE` or `NO TRADE` with a concise reason.

## Safety boundaries

No client-side provider calls, secret exposure, API-cache changes, portfolio initialization from summary reads, automatic Paper Trades, automatic alerts, automatic closing/reversal, real orders, fabricated market values, mixed-provider timeframe series, or weakened status/data-quality rules are permitted. Existing Setup Monitor original/current separation and event history remain intact.

## Validation contract

Validation must include focused deterministic tests for theme persistence/system fallback, navigation and menu accessibility contracts, Opportunity Card unavailable/evidence semantics, the Scalping ladder and 15M label/provenance, Swing presentation states, and existing protected boundaries. Full tests, TypeScript, production build, security scans, PWA/cache checks, bundle inspection, and visual checks at desktop, tablet, and iPhone-class widths are required. Physical iPhone/iPad claims remain out of scope unless performed on hardware.


## Visual validation checkpoint

The refreshed desktop preview rendered the current Phase 14 source successfully after a managed server restart. The light theme now uses cool institutional blue-neutral surfaces, charcoal text, stronger borders, and cyan live-signal accents. The desktop shell retained grouped navigation, the Market Control Center, compact data-quality block, and explicit unavailable provider state without horizontal overflow.

At a 390×844 mobile viewport, the Dashboard reflowed into a readable single-column layout with the five-item primary navigation and accessible More entry. Opportunity Discovery retained its Back to Dashboard route and truthful loading state. Setup Monitor retained its server-derived empty active/history states and bottom navigation. No fabricated market values appeared. The current screenshots remain constrained by the known reconnecting/provider-unavailable state, so populated opportunity-card density and natural setup transitions remain unverified until validated live inputs are available.
