# Scalping and Swing Intelligence

## Scope and Boundary

This additive layer is a server-authoritative research and simulated-trading planning surface. It preserves the existing **Opportunity Score**, **Regime Score**, technical calculations, provider ordering, Paper Trading execution economics, alert logic, and real-trading prohibition. It uses no private exchange credentials, local trade ledger, or client-side market calculation.

| Workspace | Validated timeframes | Purpose | Lower-timeframe policy |
|---|---|---|---|
| Scalping | 15M execution, 1H confirmation, 4H context | Short-term technical setup research | 15M is the minimum validated timeframe; 1M/3M/5M remain disabled. |
| Swing | 1H execution, 4H confirmation, 1D context | Longer-horizon technical setup research | No lower-timeframe data is implied or synthesized. |

## Setup Plan Methodology

`TRADE_SETUP_ENGINE_V1` uses the existing live scanner's direction and validated multi-timeframe analyses. It derives a plan only when all required inputs exist. The entry zone is defined by the current price and execution-timeframe EMA20. The structural stop and invalidation are the most recent execution-timeframe pivot plus a 0.25 ATR volatility buffer. Targets use next validated swing structure followed, only when necessary, by ATR extensions. A target is never shown unless the first target produces a positive R:R of at least 1.0.

If direction is neutral, regime is risk-off, provider coherence fails, a required timeframe is unavailable, ATR is unavailable, or a structurally valid stop/target cannot be calculated, the result is **NO TRADE** or **UNAVAILABLE**. The workspace never manufactures an entry, target, probability, or lower-timeframe candle.

> Setup Quality is a transparent presentation ranking derived from directional alignment, volume, R:R, and existing regime context. It is not a replacement for, input to, or modification of the Opportunity or Regime engines.

## Paper Trading and Monitoring

Opening a Paper Trade from a setup passes the selected `SCALP` or `SWING` mode to the server. The server revalidates the setup, confirms the requested simulated direction, and writes the setup plan inside the immutable entry snapshot. Existing server-side Paper Trading position sizing, stop/target economics, and manual close behavior remain authoritative and unchanged.

Current Trade Health is separately derived from live validated price plus execution/confirmation analyses. It reports **HEALTHY**, **CAUTION**, **THREATENED**, **INVALIDATED**, or **DATA UNAVAILABLE** with reasons and target progress. The manual **Refresh Trade Health** action may deduplicate and persist only material target-reached, reversal-warning, or invalidated events in `paperTradeMonitoringEvents`; it never closes, reverses, trails, or modifies a simulated trade and creates no scheduled alert.

## Provenance and Current Limitations

Each setup displays provider, retrieval timestamp, timeframe configuration, market context, and current minimum timeframe. The visual verification on 2026-08-25 showed the live Scalping workspace ranking all 12 supported assets but correctly presenting **NO TRADE** for neutral/unsupported directions or unavailable technical levels. No Paper Trade was opened during validation.

The same visual verification opened the Swing workspace using the explicit **1H / 4H / 1D** profile. The workspace entered a loading state while validating provider data and did not pre-populate a level, target, or setup before the server response arrived.

Once the Swing response completed, it showed the same data-bound behavior: neutral existing directions were rendered as **NO TRADE**, while assets lacking a structurally valid stop and positive first target were rendered as **UNAVAILABLE**. The UI displayed the validated Binance Futures provenance and 1H/4H/1D profile for every row. No confirmation or Paper Trading action was selected during this check.

## NO TRADE diagnostics

The current diagnostic layer is read-only. It presents the unchanged setup branches as per-condition **Passed**, **Failed**, **Unavailable**, or **Stale** states, including the actual input, the existing requirement, and a short explanation. It does not alter the Opportunity/Regime scores, setup minimum R:R, provider validation, Paper Trading, alerts, or provider policy.

During the 2026-08-25 live Scalping verification, **12 assets were evaluated and 12 returned NO TRADE**. All 12 were classified as missing required current inputs. The leading diagnostic counts were 12 unavailable each for 15M execution analysis, 1H confirmation analysis, 4H context analysis, execution ATR, and first technical target. This was an input-availability result; no price level, stop, target, probability, or trade action was fabricated.

The paired Swing verification evaluated **12 assets and returned 12 NO TRADE** results. All 12 were likewise classified as missing required current inputs. The leading counts were 12 unavailable each for 1H execution analysis, 4H confirmation analysis, 1D context analysis, execution ATR, and first technical target. Both views explicitly reported zero stale-data and zero existing-R:R-requirement rejections in that live response.

Tauri remains **BLOCKED — AUTH HANDOFF DESIGN REQUIRED**. The separate lower-timeframe data phase remains required before 1M, 3M, or 5M can be introduced.
