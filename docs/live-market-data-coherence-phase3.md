# Live Market-Data Coherence — Phase 3

**Status:** Implemented and validated in the development runtime on 2026-08-25. This document describes the technical data-integrity layer used by the live scanner and the Scalping/Swing research workspaces. It is not a trading recommendation.

> A plan is eligible for technical scoring only when every required timeframe is validated, fresh, and supplied by one approved provider family. Missing, stale, invalid, rate-limited, or incoherent data produces explicit evidence and never synthetic candles, a blended series, or a trade.

## Scope and preserved boundaries

Phase 3 changes data acquisition, coherence evidence, and presentation only. **Opportunity Score, Regime Score, indicator formulas, setup thresholds, stop/invalidation/target derivation, R:R minimum, alerts, Paper Trading economics, Paper Trade automation boundaries, Research Lab methodology, historical ingestion, and scheduled Provider Health monitor cadence remain unchanged.** No provider credentials are sent to the browser, no exchange order capability exists, and `1m`, `3m`, and `5m` remain disabled.

| Area | Phase 3 behavior | Boundary retained |
| --- | --- | --- |
| Technical OHLCV | Binance Futures is attempted first for the required timeframes. | No direct browser provider request and no credential requirement. |
| Regional restriction | Only a Binance Futures HTTP 451 makes Kraken Spot eligible. | HTTP 451 is classified as unavailable; it is never bypassed. |
| Fallback | A complete Kraken bundle is used only when every required timeframe validates from Kraken. | A partial fallback is ineligible; mixed Binance/Kraken analytical series are never used. |
| Data quality | Each series validates timestamps, cadence, positive OHLC, positive volume, completed-candle depth, and freshness. | Invalid or incomplete rows cannot become indicators, scores, levels, or trades. |
| Caching | The scanner retains a 60-second in-memory snapshot and its server-private raw provider bundles. | Raw candle bundles are not exposed in the public scanner response or persisted as a new authoritative store. |

## Provider model and validation contract

The live scanner continues to request the approved `15m`, `1h`, `4h`, and `1d` intervals. The setup engine selects the existing mode-specific subsets: `15m / 1h / 4h` for Scalping and `1h / 4h / 1d` for Swing. It now reuses the scanner’s server-private coherent bundle rather than making a separate execution-timeframe request for each setup card.

| Provider | Role | Eligible technical outcome | Ineligible outcome |
| --- | --- | --- | --- |
| Binance Futures | Primary live technical OHLCV and derivatives context. | Every requested timeframe passes validation from Binance Futures. | Any failed required timeframe without an HTTP 451 fallback trigger prevents a bundle. |
| Kraken Spot | Controlled secondary technical OHLCV source. | Binance returned HTTP 451 **and** all required timeframes validate from Kraken Spot. | Missing mapping, malformed row, stale candle, missing volume, rate limit, timeout, or partial coverage prevents eligibility. |
| CoinGecko | Live market snapshot and global market context. | Market/context fields are shown with their own provenance. | It is not treated as a substitute technical OHLCV source. |

The complete-bundle resolver has two conservative paths. When all Binance timeframes validate, it selects Binance. When every Binance request is regionally unavailable and the first-pass Kraken responses are all valid, it reuses that all-Kraken bundle. If the first pass contains a mix of valid Binance and fallback Kraken series, it revalidates the **entire** required set from Kraken before any result can be eligible. This is the only case that performs an additional fallback sweep, avoiding unnecessary duplicate requests while preserving provider coherence.

## Explicit data-quality states

The technical data contract emits a provider, symbol, timeframe, timestamps, candle count, freshness, error class, and scoring-eligibility flag for each required timeframe. These states appear in diagnostics and the setup workspace.

| State | Meaning | Scoring / setup consequence |
| --- | --- | --- |
| `VALID` | Complete, ordered, positive-volume closed candles passed all validations and freshness allowance. | Eligible only as part of a fully coherent provider bundle. |
| `STALE` | The newest complete candle exceeds the existing three-interval freshness allowance. | Treated as stale; no current setup plan is eligible. |
| `INSUFFICIENT` | Fewer than the configured indicator lookback candles are complete. | No analysis is calculated from the series. |
| `INCOHERENT` | Required timeframes would span provider families. | The attempted blend is rejected. |
| `PROVIDER_UNAVAILABLE` | A provider is unavailable, including Binance HTTP 451. | Fallback is considered only for Binance HTTP 451. |
| `INVALID` | Symbol mapping, timestamp, OHLC, or volume validation failed. | The series is rejected; no values are repaired or inferred. |
| `NO_DATA` | A request failed, timed out, or was rate-limited. | No fallback occurs unless the failure is specifically Binance HTTP 451. |

## Request and cache behavior

For a cold scanner run, the current 12-asset universe requires up to 48 primary technical OHLCV requests: four intervals per asset. Under a Binance HTTP 451 condition, the approved Kraken fallback can add up to 48 requests. Asset processing is bounded to three concurrent asset workers; each asset’s approved timeframes are requested concurrently. Cached scanner responses remain reusable for 60 seconds, and the matching raw bundle is retained only alongside that in-memory snapshot for setup-plan reuse.

This behavior is intentionally conservative. A provider error, validation error, rate limit, or timeout does not cause retries across unrelated providers, and a setup workspace does not initiate a second independent technical series when the current scanner already has a coherent bundle.

## Scalping and Swing presentation

Both workspaces now show the current provider-health panel, per-plan bundle state, provider, closed-candle count, retrieval time, quality state, and eligibility. A dedicated **Provider coherence and data quality** condition appears in every NO TRADE explanation. It reports the actual timeframe/provider state and the existing requirement for one coherent technical provider bundle.

The aggregate diagnostic summary distinguishes root data failures from downstream conditions that are intentionally not evaluated after an earlier gate blocks the existing setup engine. Therefore, coherent inputs with a neutral Opportunity direction are classified as **lack of market setup**, not missing data. Existing R:R failures remain separately classified as an existing setup requirement.

## Validation and limitations

The implementation includes deterministic tests for Binance HTTP 451 classification, valid/invalid Kraken fallback, missing volume, symbol mismatch, timeframe mismatch, timestamp corruption, stale data, insufficient candles, rate limits, timeout classification, normal all-Kraken fallback reuse, and mixed-provider full revalidation. Existing Provider Health monitor and Paper Trading regression tests remain in the full suite. Desktop and mobile-class browser render checks confirmed that the application shell remains responsive; current setup output was separately validated through the public server query so that a loading-state screenshot was not treated as data evidence.

The phase does not prove permanent provider availability or guarantee that a live market setup will exist. It does not add WebSocket data, private exchange APIs, 1M/3M/5M support, persistence of new candle stores, automated trade actions, or real order execution. Live output remains a research signal and must remain subject to the application’s existing risk disclosures.
