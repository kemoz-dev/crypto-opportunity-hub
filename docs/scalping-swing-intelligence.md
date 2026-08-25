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

## Phase 6 Validation Record and Production Stop Decision

Local server validation on 2026-08-25 confirmed the complete contract. With the conservative cadence, the all-asset public query returned eight coherent `VALID` Bybit Spot bundles, eight `WATCH` results with neutral alignment, zero qualified plans, and four `PARTIAL` / **NO TRADE — DATA UNAVAILABLE** results caused by observed invalid 1M volume. The partial series were not analyzed. Deterministic coverage passed for valid and malformed provider responses, zero volume, symbol mapping, stale/future/duplicate/missing candles, alignment, qualified levels, forward target/R:R rules, health states, immutable snapshots, and PWA offline boundaries.

The published `crypto.lowTimeframeScalping` route propagated after the Phase 6 checkpoint, but the production runtime returned HTTP 403 from Bybit Spot for all native 1M, 3M, and 5M requests. The all-asset response therefore correctly returned **0 VALID, 0 QUALIFIED, 0 WATCH, and 12 NO TRADE / DATA UNAVAILABLE**; a separate BTC-only query produced the same three HTTP 403 provider failures. This is an exact production provider-reachability blocker, not an Opportunity/Regime, core provider, or setup-engine failure.

> **Production stop decision:** No current trustworthy low-timeframe provider bundle exists in the published runtime. The production layer must remain at **NO TRADE — DATA UNAVAILABLE**. No Binance/Kraken fallback, resampling, cache substitution, cross-provider combination, stale-data reuse, Paper Trade, scheduled task, alert, setting, or real-trading action was attempted. The implementation is retained because it fails closed with explicit provenance and diagnostics; enabling live Phase 6 plans requires future production-approved Bybit reachability or a newly authorized equivalent single-provider validation process.

## Phase 7 — Provider Qualification and Production Reachability

Phase 7 re-audited the Phase 6 boundary and investigated independently documented candidates. A candidate was not treated as qualified merely because it exposes labels for 1M, 3M, and 5M bars. Qualification requires technically valid native intervals, current complete volume-bearing candles, known symbol mapping, production reachability, one-provider coherence, and terms/jurisdiction suitability for the intended server-side use.

| Provider | Native intervals in official documentation | Public market-data posture | Terms/operational qualification | Phase 7 decision |
|---|---|---|---|---|
| Bybit Spot | 1M, 3M, 5M | Existing Phase 6 public Kline path | Current published runtime returns HTTP 403 for every required request. | `UNAVAILABLE` — no bypass, retry policy change, or fallback. |
| OKX | 1M, 3M, 5M | Official agreement says public Market Data can be accessed without a key. | Agreement also conditions API Services on verified-account/jurisdiction eligibility and limits the license to internal use unless separately authorized. This has not been established for Crypto Hub. | `REJECTED` — terms/access suitability unresolved; no production integration or probe. |
| KuCoin Spot | 1min, 3min, 5min | Official Klines endpoint is public, IP-counted, and documents OHLCV plus turnover. | Terms describe Platform services for registered users and list jurisdiction restrictions. A compliant account/jurisdiction/usage basis has not been established. | `REJECTED` — terms/access suitability unresolved; no production integration or probe. |
| Bitget Spot | 1m, 3m, 5m | Official public Candle endpoint documents OHLCV/turnover and 20 requests/sec/IP. | API terms prohibit availability/performance monitoring and repackaging/reselling API-related data, so Phase 7’s published qualification/presentation use cannot be cleared from the terms alone. | `REJECTED` — do not probe or integrate without written authorization. |

The Phase 7 production check was read-only and used the already published Bybit-only Scalping query for the required five assets. It produced HTTP 200 from Crypto Hub and 25 recorded upstream Bybit HTTP 403 errors (each required native data request failed), yielding five missing bundles and five **NO TRADE — DATA UNAVAILABLE** results. No candle, volume, freshness, or OHLC interpretation was performed from the failed responses.

| Asset | 1M | 3M | 5M | Volume | Fresh | Coherent | Result |
|---|---|---|---|---|---|---|---|
| BTC | `UNAVAILABLE — HTTP 403` | `UNAVAILABLE — HTTP 403` | `UNAVAILABLE — HTTP 403` | Unavailable | Not evaluable | No | **NO TRADE — DATA UNAVAILABLE** |
| ETH | `UNAVAILABLE — HTTP 403` | `UNAVAILABLE — HTTP 403` | `UNAVAILABLE — HTTP 403` | Unavailable | Not evaluable | No | **NO TRADE — DATA UNAVAILABLE** |
| SOL | `UNAVAILABLE — HTTP 403` | `UNAVAILABLE — HTTP 403` | `UNAVAILABLE — HTTP 403` | Unavailable | Not evaluable | No | **NO TRADE — DATA UNAVAILABLE** |
| AAVE | `UNAVAILABLE — HTTP 403` | `UNAVAILABLE — HTTP 403` | `UNAVAILABLE — HTTP 403` | Unavailable | Not evaluable | No | **NO TRADE — DATA UNAVAILABLE** |
| DOT | `UNAVAILABLE — HTTP 403` | `UNAVAILABLE — HTTP 403` | `UNAVAILABLE — HTTP 403` | Unavailable | Not evaluable | No | **NO TRADE — DATA UNAVAILABLE** |

> **Phase 7 decision:** No provider is qualified for production 1M/3M/5M Scalping use. The stop condition is met: **PROVIDER BLOCKED — HTTP 403** for the only previously documented production data path, while alternative candidates lack a confirmed compliant-use basis. The existing UI remains truthful: no entry, stop, target, R:R, or health recommendation appears without a valid complete bundle. The existing Paper Trading confirmation remains protected and can only consume a qualified plan; no Paper Trade was created. PWA caching remains static-shell-only and does not cache provider/API responses.

## Phase 8 — Opportunity Discovery and Setup Maturity

Phase 8 adds `OPPORTUNITY_DISCOVERY_V1`, a separate server-authoritative **interpretation** of the existing Swing `1H / 4H / 1D` setup response. It does not calculate a score, indicator, provider response, candle, entry rule, target, stop, probability, or Paper Trading economic term. It consumes only already validated scanner/setup diagnostics, technical states, provenance, the existing market regime, and existing Opportunity Score for within-state ordering.

| Discovery state | Meaning | Entry and Paper Trading treatment |
|---|---|---|
| `QUALIFIED` | Every existing validated setup condition, level, target, and unchanged minimum R:R test passed. | Existing plan levels may be displayed; manual Paper Trading is available only after the server revalidates the matching setup/direction. |
| `POTENTIAL` | Valid technical evidence is developing, but a listed existing condition remains unmet, including a constrained R:R or a `RISK OFF` market restriction. | No entry is displayed as an instruction. The interface shows only conditional, completed-candle upgrade requirements. |
| `WATCH` | Early or incomplete validated technical evidence exists without a completed directional thesis. | No entry, level, target, or Paper Trading action is available. |
| `NO TRADE` | Valid data was present but a structural stop/target or directional thesis failed the existing method. | No plan is constructed or recovered by changing thresholds. |
| `DATA UNAVAILABLE` | Required bundle, freshness, price, analysis, or provider coherence failed. | No technical evaluation or opportunity claim is inferred from the missing/stale/incoherent input. |

`EARLY`, `DEVELOPING`, `QUALIFIED`, `INVALIDATED`, and `UNAVAILABLE` are maturity labels, not forecasts or numerical scores. Under **RISK OFF**, technically interesting `POTENTIAL` and `WATCH` observations remain visible but explicitly `RESTRICTED`; they cannot be qualified or initiate Paper Trading. Potential and Watch cards show deterministic **What would change?** conditions. They do not show a forced entry zone, target, stop, or trade probability.

The Paper Trading server now requires an explicit `SCALP`, `SWING`, or `LOW_TIMEFRAME_SCALPING` qualified setup context before it opens a simulated position. The original server-side revalidation, matching-side check, ownership enforcement, 4H-ATR/2R accounting, immutable snapshot, manual close, Trade Health, and real-trading prohibition remain unchanged. Generic dashboard and Asset Intelligence entry surfaces now direct the user to a current Qualified setup instead of presenting a generic simulated-entry form.

The Opportunity Discovery workspace is available as a desktop navigation destination, dashboard card, and secondary mobile PWA destination. It makes no browser-side provider call and has no cache write path. Asset Intelligence adds a **Current Setup · Swing discovery** section with the same state, maturity, exact reason, provenance-linked conditions, and qualified-only Paper Trading action. The existing score, technical matrix, chart, risk/context, and source-evidence panels remain read-only and separate.

### Local Evidence Record

On 2026-08-25, a bounded read-only local `crypto.tradeSetups({ mode: "SWING" })` query returned a valid current `RISK OFF` regime and 12 complete Swing discovery interpretations. The response contained **0 QUALIFIED**, **11 POTENTIAL**, **1 WATCH**, **0 NO TRADE**, and **0 DATA UNAVAILABLE**. All 12 were marked `RESTRICTED` by the current RISK OFF regime; no Paper Trade, alert, schedule, setting, data write, provider-policy change, or real-trading action occurred. The observed providers remained the existing core Binance Futures and controlled Kraken Spot fallback paths; Phase 8 did not alter their resolver policy.

### Published Evidence Record

After publication propagation on 2026-08-25, the bounded read-only published Swing query returned the new Discovery contract for all 12 assets. Its current `marketRegime` input was unavailable, so no RISK OFF restriction was asserted. The exact published classification was **0 QUALIFIED**, **5 POTENTIAL**, **4 WATCH**, **2 NO TRADE**, and **1 DATA UNAVAILABLE**. The five Potential observations—LINK, ADA, AVAX, DOT, and SUI—each preserved the existing first-target minimum-R:R failure; the four Watch observations—SOL, UNI, BTC, and ETH—had only early/insufficient directional agreement. XRP and DOGE were No Trade because their already derived stops were invalid relative to their entry zones. AAVE was Data Unavailable because Binance Futures was regionally unavailable and Kraken Spot could not supply every required validated timeframe; no cross-provider series was built.

All available published Swing bundles in that response retained **Kraken Spot** provenance under the existing controlled Binance HTTP 451 fallback policy. There was no qualified plan, therefore no Paper Trade action was exposed or attempted. A separate unauthenticated, read-only `crypto.paperPortfolio` production request returned **HTTP 401**, preserving the protected account boundary. The published browser shell showed the existing billing/limitation banner and `RECONNECTING` state, so the visual client did not receive a server-validated response during the browser observation; it retained its loading state rather than creating rows. The direct public server query above is the authoritative production verification record.

## Phase 9 — Potential Trade Intelligence and Setup Readiness

Phase 9 upgrades `OPPORTUNITY_DISCOVERY_V2` with a separate deterministic `SETUP_READINESS_V1` interpretation. It does **not** replace Opportunity Score, Regime Score, setup quality, the existing level engine, or any eligibility decision. It receives only the existing validated Swing plan, diagnostics, multi-timeframe analyses, provider bundle metadata, market-regime classification, and retained technical candidate when the unchanged setup engine actually derived one.

| Readiness component | Maximum | Deterministic source and rule |
|---|---:|---|
| Timeframe alignment | 35 | `35 × aligned directional Swing timeframes / 3`; no alignment is inferred. |
| Positive evidence | 20 | 5 points per recorded positive analysis reason, capped at four reasons. |
| Technical candidate | 20 | 20 for an existing supported entry/target/invalidation candidate; 12 for a partial candidate; 0 otherwise. |
| Existing first-target R:R | 15 | 15 when the existing first target is at least 1:1; 5 when a derived candidate remains below 1:1; 0 when absent. |
| Regime compatibility | 10 | 10 for `RISK ON`, 5 for `SELECTIVE`, and 0 for `RISK OFF` or unavailable. |

The readiness score is the displayed component sum, capped at 100. It is deliberately a **ranking and explanation aid only**. Mandatory data/coherence failures override it to `DATA_UNAVAILABLE`; invalid structure overrides it to `INVALID`; and no readiness value can create a trade, bypass a risk-off restriction, override Opportunity Score, or change the minimum 1:1 R:R rule.

| Discovery status | Readiness state | Interpretation and action boundary |
|---|---|---|
| `DATA_UNAVAILABLE` | `DATA_UNAVAILABLE` | Required current coherent input failed. Dependent plan values are unavailable. |
| `NO TRADE` | `INVALID` | Existing direction, stop, or forward-target structure failed. No candidate is recovered by loosening conditions. |
| `WATCH` | `EARLY` or `WATCH` | Early evidence only. No entry or Paper Trading eligibility. |
| `POTENTIAL` | `NEAR_READY` | Positive evidence and missing completed-candle confirmations are shown; it remains non-actionable. |
| `QUALIFIED` | `READY` | Every existing qualification condition passed. Existing server revalidation and explicit Paper Trading confirmation still apply. |

When the existing level engine derives a real candidate before the existing first-target R:R gate passes, Phase 9 may show the same execution-EMA entry zone, structural pivot plus 0.25 ATR invalidation, and one to three existing structure/ATR targets. It labels the information **Conditional technical plan — not a trade instruction**, retains its provider, `1H / 4H / 1D` timeframes, timestamp, freshness, and validation state, and shows target distance and R multiple. It shows no level when that original engine did not derive one and never forces three targets. Current Trade Health remains manual and compares live validated inputs only against an immutable **qualified Paper Trade** snapshot; prospective plans display `WAITING` or `UNAVAILABLE`, not a fabricated health result.

Potential alerts expose only `potentialAlertEligible: false`; no alert, notification, poll, scheduler, automatic Paper Trade, close, reversal, or real-trading behavior was added. The dedicated low-timeframe Scalping layer remains separate: until a complete native provider bundle validates, it stays **NO TRADE — DATA UNAVAILABLE** and is never represented as `15M / 1H / 4H` data.

### Phase 9 Local Evidence Record

On 2026-08-25, a bounded read-only local Swing query returned **12 evaluated assets, 0 Qualified, 11 Potential, 1 Watch, 0 No Trade, and 0 Data Unavailable**. The existing provider was Binance Futures with valid coherent `1H / 4H / 1D` bundles. The current regime was `RISK OFF`, therefore every observation remained restricted and no Paper Trade, alert, setting, schedule, provider-policy change, or data write occurred. For BTC, ETH, SOL, AAVE, and DOT, Phase 9 exposed their exact readiness score, missing completed-candle confirmation, and unavailable conditional-plan fields rather than inventing entries, targets, or invalidations.

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

[5] [OKX API Guide — Market Candlesticks](https://www.okx.com/docs-v5/en/#rest-api-market-data-get-candlesticks)

[6] [OKX API Agreement](https://www.okx.com/help/okx-api-agreement)

[7] [KuCoin API — Get Klines](https://www.kucoin.com/docs-new/rest/spot-trading/market-data/get-klines)

[8] [KuCoin API — Rate Limits](https://www.kucoin.com/docs-new/rate-limit)

[9] [KuCoin Terms of Use](https://www.kucoin.com/legal/terms-of-use)

[10] [Bitget API — Get Kline/Candlestick](https://www.bitget.com/api-doc/uta/public/Get-Candle-Data)

[11] [Bitget API Key Terms of Use](https://www.bitget.com/support/articles/12560603797947)

[12] [Bitget Terms of Use](https://www.bitget.com/support/articles/360014944032-terms-of-use)
