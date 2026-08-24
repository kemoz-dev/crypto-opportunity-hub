# Asset Intelligence — Implementation Map

## Objective and non-mutation boundary

This upgrade is a presentation and explainability layer over the existing live scanner, Opportunity Engine, technical analysis, Paper Trading, alerts, and Research Lab. It must not create a second score, recalculate or reweight the Opportunity Score, alter thresholds, create provider substitutions, create trades, trigger alerts, start experiments, or change historical ingestion.

## Existing logic to reuse

| Concern | Existing source | Data consumed without duplication |
| --- | --- | --- |
| Live asset navigation and selected asset | `client/src/pages/Home.tsx` | `ScannerRow`, selected asset state, dashboard/scanner row actions, existing inline detail panel. |
| Opportunity Engine and score explanation | `server/crypto/scoring.ts` | `OpportunityScore`, `ScoreReason[]`, score components, missing conditions, setup, risk level, `technicalByTimeframe`, and market-regime reasons. |
| Technical calculations | `server/crypto/technical.ts` | Current RSI, MACD, EMA20/50/200, Bollinger, ATR, volume expansion, price structure, reason direction, and timeframe bias. |
| Provider-normalized OHLCV | `server/crypto/providers.ts` | Validated single-provider candle series, provider, timestamp, timeframe, normalization version, and explicit unavailable classifications. |
| Live scanner orchestration | `server/crypto/marketService.ts` | Current scanner response, real market asset values, data status, regime, technical analyses, and no-mixed-provider rule. |
| Paper Trading | `server/crypto/paperTrading.ts`, `client/src/components/crypto/PaperTradingPanel.tsx` | Existing paper-only confirmation and immutable `PaperTradeSnapshot`; no execution changes. |
| Research Lab | `client/src/components/crypto/OpportunityResearchLab.tsx`, `server/crypto/researchLab.ts` | Persisted experiment configuration, protocol/fingerprint, aggregate results, calibration, segments, exports, and saved run selection. |
| Alert evidence | `client/src/components/crypto/AlertsPanel.tsx`, `server/crypto/alerts.ts` | Existing immutable alert execution history; no alert-rule changes. |
| APIs and security | `server/routers/crypto.ts` | Existing `scanner`, paper portfolio, research experiment, and alert procedures; new detail presentation receives no write-only path beyond existing Paper Trading controls. |
| Existing regression baseline | `server/crypto/scoring.test.ts`, `technical.test.ts`, `providers.test.ts`, `paperTrading.test.ts`, research/alert tests | Current score, unavailable-data, provider validation, immutable snapshot, and no-mutation constraints. |

## Planned modifications

| File or area | Modification | Boundary |
| --- | --- | --- |
| `shared/crypto.ts` | Add presentation-only detail/provenance types if required. | No score formula or type semantics changed. |
| `server/crypto/technical.ts` | Export a presentation helper that derives chart overlay series from the same existing indicator functions and validated candles. | No scoring calculation or thresholds changed. |
| `server/crypto/assetIntelligence.ts` | New read-only assembly service combining an existing scanner row with provider-normalized chart data and explicit unavailable fields. | No persistence, score mutation, or provider order change. |
| `server/routers/crypto.ts` | Add a read-only asset-intelligence procedure reusing user configuration and existing scanner/provider logic. | No new write procedure. |
| `client/src/components/crypto/AssetIntelligencePanel.tsx` | New responsive drill-down workspace with score reasons, matrix, evidence, chart, risk/context/provenance, and existing Paper Trading handoff. | No fabricated metric: absent values render `UNAVAILABLE`. |
| `client/src/components/crypto/TechnicalChart.tsx` | New SVG presentation component using returned validated candles and computed overlays; no external chart dependency or mock data. | If candle/indicator data is unavailable, render explicit unavailable state. |
| `client/src/pages/Home.tsx` | Replace/extend the selected-row detail flow with the shared Asset Intelligence workspace and preserve existing dashboard/scanner selection. | Dashboard scoring and scanner fetching remain unchanged. |
| `PaperTradingPanel.tsx` | Add read-only “Why this trade?” inspector from stored immutable snapshot. | Existing open/close execution procedures unchanged. |
| `OpportunityResearchLab.tsx` | Reorganize existing persisted-run result view into Overview, Variables, Methodology, Dataset, Results, Calibration, Segments, Trades, and Export tabs. | No automatic experiment run or methodology change. |

## New components

`AssetIntelligencePanel`, `TechnicalChart`, and small presentation-only evidence/matrix components will be added under `client/src/components/crypto/`. They will consume only the real tRPC detail payload and existing scanner-row data. Catalyst/Rumor will be explicitly `UNAVAILABLE` because no verified source is currently persisted.

## Data and provenance behavior

The asset header will show the market provider/timestamp separately from the selected validated OHLCV provider/timestamp/timeframe. Current, delayed, stale, and unavailable states will derive from existing `DataStatus` and returned source timestamps. Support/resistance, stop, target, and R:R will remain `UNAVAILABLE` unless provided by the immutable Paper Trading entry snapshot; no new levels will be invented.

## Test additions

Tests will cover detail assembly traceability to existing reasons/analyses, provider/timeframe/timestamp propagation, missing/unavailable states, no-mixed-provider behavior, no score recalculation, unchanged paper snapshot fields, route authorization, and responsive drill-down behavior. Existing full regression tests will remain the final guardrail.
