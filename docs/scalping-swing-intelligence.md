# Scalping and Swing Intelligence

## Scope and Boundary

This additive layer is a server-authoritative research and simulated-trading planning surface. It preserves the existing **Opportunity Score**, **Regime Score**, technical calculations, provider ordering, Paper Trading execution economics, alert logic, and real-trading prohibition. It uses no private exchange credentials, local trade ledger, or client-side market calculation.

| Workspace | Validated timeframes | Purpose | Provider and isolation policy |
|---|---|---|---|
| **Scalping Intelligence — Phase 6** | 1M micro trend, 3M short trend, 5M structure and volatility | Independent low-timeframe technical planning | **Bybit Spot only**. All three intervals must independently validate from the same approved mapping; it never replaces the core Binance→Kraken resolver. |
| Established Scalping | 15M execution, 1H confirmation, 4H context | Existing short-term technical setup research | Preserved intact as a separately selectable view. |
| Swing | 1H execution, 4H confirmation, 1D context | Longer-horizon technical setup research | No lower-timeframe data is implied or synthesized. |

## Setup Plan Methodology

`TRADE_SETUP_ENGINE_V1` uses the existing live scanner's direction and validated multi-timeframe analyses. It derives a plan only when all required inputs exist. The entry zone is defined by the current price and execution-timeframe EMA20. The structural stop and invalidation are the most recent execution-timeframe pivot plus a 0.25 ATR volatility buffer. Targets use next validated swing structure followed, only when necessary, by ATR extensions. A target is never shown unless the first target produces a positive R:R of at least 1.0.

If direction is neutral, regime is risk-off, provider coherence fails, a required timeframe is unavailable, ATR is unavailable, or a structurally valid stop/target cannot be calculated, the result is **NO TRADE** or **UNAVAILABLE**. The workspace never manufactures an entry, target, probability, or lower-timeframe candle.

> Setup Quality remains an explainable technical-evidence field. Phase 4 workspace ranking uses the existing **Opportunity Score** only; Setup Quality is not a competing score, an input to Opportunity/Regime, or a modification of either engine.

## Paper Trading and Monitoring

Opening a Paper Trade from a setup passes the selected `SCALP` or `SWING` mode to the server. The server revalidates the setup, confirms the requested simulated direction, and writes the setup plan inside the immutable entry snapshot. Existing server-side Paper Trading position sizing, stop/target economics, and manual close behavior remain authoritative and unchanged.

Phase 6 adds an explicit `LOW_TIMEFRAME_SCALPING` snapshot mode. A user may request a simulation only from a currently qualified low-timeframe plan with matching direction. The server snapshots the validated Bybit provider identity, timestamps, 1M/3M/5M state, entry-zone evidence, structural invalidation, real technical targets, R:R, and reasons. It **does not** replace the canonical Paper Trading 4H-ATR/2R entry terms, authorization, server ledger, manual-close mechanics, or real-trading prohibition.

Current Trade Health is separately derived from live validated price plus execution/confirmation analyses. It reports **HEALTHY**, **CAUTION**, **REVERSAL RISK**, **INVALIDATED**, or **HEALTH UNKNOWN** with reasons, target-path explanation, and direction-correct target distance. **HEALTH UNKNOWN** is shown for unavailable or stale current validated data rather than inferring a state. The manual **Refresh Trade Health** action may deduplicate and persist only material target-reached, reversal-warning, or invalidated events in `paperTradeMonitoringEvents`; it never closes, reverses, trails, or modifies a simulated trade and creates no scheduled alert.

The Phase 6 snapshot has a separate manual-only **Refresh 1M / 3M / 5M Health** action. It returns **HEALTHY**, **WARNING**, **DANGER**, **INVALIDATED**, or **HEALTH UNKNOWN** from a new complete Bybit bundle. It records no monitoring event and changes no paper position, target, stop, alert, or entry economics. Invalid, stale, missing, partial, or incoherent current data pauses the low-timeframe health result at **HEALTH UNKNOWN**.

## Phase 6 — Verified Low-Timeframe Scalping Data Layer

`LOW_TIMEFRAME_SCALPING_V1` is intentionally independent of the shared `Timeframe` union and therefore cannot flow into Opportunity scoring, Regime scoring, settings, historical/research schemas, Swing, alerts, or the established provider fallback path. It requests Bybit V5 **Spot** Kline records at native `1`, `3`, and `5` minute intervals; no interval is resampled or derived from another bar size.[1]

Before a plan may be built, the server checks the approved `<ASSET>USDT` mapping, Bybit success code, returned category and symbol, finite timestamp/OHLC/volume values, interval alignment, completed-candle continuity, duplicate/gap prevention, positive volume, minimum indicator depth, the three-interval freshness allowance, and one-provider provenance. The response exposes the exact bundle state below and clears all analytical series whenever the complete bundle is not usable.

| Bundle state | Meaning | Planning consequence |
|---|---|---|
| `VALID` | Complete, fresh, coherent Bybit Spot 1M/3M/5M bundle passed every gate. | Eligible for isolated Scalping Intelligence only. |
| `PARTIAL` | One or two intervals passed but the full bundle did not. | **NO TRADE — DATA UNAVAILABLE**; partial series are discarded. |
| `STALE` | No current complete bundle passed the three-interval freshness allowance. | **NO TRADE**; new-entry and health inference are paused. |
| `MISSING` | No valid current provider response or required depth exists. | **NO TRADE — DATA UNAVAILABLE**. |
| `INCOHERENT` | Complete series disagree on provider or symbol provenance. | **NO TRADE**; mixed-provider data is never retained. |

The low-timeframe engine shows each 1M/3M/5M bias, EMA state, RSI, momentum, volume comparison, and short structure. It classifies alignment as `STRONG`, `PARTIAL`, `CONFLICTED`, `NEUTRAL`, or `UNAVAILABLE`. A qualified plan requires a strong all-three-direction agreement, a current non-chasing entry zone based on 1M/3M EMA timing, a real 5M structural pivot invalidation buffered by 0.25 ATR, and a first forward-looking technical target that satisfies the unchanged 1:1 minimum R:R. Technical targets behind the current price are excluded; TP2 and TP3 remain absent unless further validated pivot/ATR evidence exists.

> **Scalping Setup Quality** is a separate explanatory ranking based on validated low-timeframe data quality, alignment, structure, momentum, volume, volatility, entry quality, R:R, and invalidation clarity. It is not an Opportunity Score, Regime Score, forecast, or input to either score.

Bybit publishes the V5 Kline interval contract, Spot instrument information, and public rate-limit documentation. The implementation uses a bounded 20-second server-side cache plus in-flight request deduplication and a conservative **one-asset outer request concurrency cap** (each asset still obtains only the three independently native intervals); no secret or provider request is exposed to the browser/PWA. Operators must review Bybit’s live terms directly; the application does not interpret them.[1] [2] [3] [4]

## Provenance and Current Limitations

Each setup displays provider, retrieval timestamp, timeframe configuration, market context, and current minimum timeframe. The visual verification on 2026-08-25 showed the live Scalping workspace ranking all 12 supported assets but correctly presenting **NO TRADE** for neutral/unsupported directions or unavailable technical levels. No Paper Trade was opened during validation.

The same visual verification opened the Swing workspace using the explicit **1H / 4H / 1D** profile. The workspace entered a loading state while validating provider data and did not pre-populate a level, target, or setup before the server response arrived.

Once the Swing response completed, it showed the same data-bound behavior: neutral existing directions were rendered as **NO TRADE**, while assets lacking a structurally valid stop and positive first target were rendered as **UNAVAILABLE**. The UI displayed the validated Binance Futures provenance and 1H/4H/1D profile for every row. No confirmation or Paper Trading action was selected during this check.

## NO TRADE diagnostics

The current diagnostic layer is read-only. It presents the unchanged setup branches as per-condition **Passed**, **Failed**, **Unavailable**, or **Stale** states, including the actual input, the existing requirement, and a short explanation. It does not alter the Opportunity/Regime scores, setup minimum R:R, provider validation, Paper Trading, alerts, or provider policy.

During the 2026-08-25 live Scalping verification, **12 assets were evaluated and 12 returned NO TRADE**. All 12 were classified as missing required current inputs. The leading diagnostic counts were 12 unavailable each for 15M execution analysis, 1H confirmation analysis, 4H context analysis, execution ATR, and first technical target. This was an input-availability result; no price level, stop, target, probability, or trade action was fabricated.

The paired Swing verification evaluated **12 assets and returned 12 NO TRADE** results. All 12 were likewise classified as missing required current inputs. The leading counts were 12 unavailable each for 1H execution analysis, 4H confirmation analysis, 1D context analysis, execution ATR, and first technical target. Both views explicitly reported zero stale-data and zero existing-R:R-requirement rejections in that live response.

Tauri remains **BLOCKED — AUTH HANDOFF DESIGN REQUIRED**. Phase 6 does not begin Tauri, OIDC, schedulers, automated monitoring, automatic Paper Trading, automatic close/reversal/trailing-stop behavior, alerts, Research Lab, or real trading. Published-production provider validation remains a required release gate; this document does not claim it before the controlled post-publication check completes.

## References

[1] [Bybit V5 Get Kline](https://bybit-exchange.github.io/docs/v5/market/kline)

[2] [Bybit V5 Instruments Information](https://bybit-exchange.github.io/docs/v5/market/instrument)

[3] [Bybit V5 API Rate Limit Rules](https://bybit-exchange.github.io/docs/v5/rate-limit)

[4] [Bybit Terms of Service](https://www.bybit.com/en/help-center/article/Terms-of-Service)
