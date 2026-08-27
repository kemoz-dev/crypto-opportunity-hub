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

### Phase 9 Published Evidence Record

After ordinary propagation, the public `crypto.tradeSetups({ mode: "SWING" })` response returned `OPPORTUNITY_DISCOVERY_V2` with all readiness and conditional-plan fields. Its current regime was `RISK OFF` at 31.2/100, with 0% tracked-asset breadth. The returned distribution was **12 evaluated, 0 Qualified, 10 Potential, 1 Watch, 0 No Trade, and 1 Data Unavailable**; 11 available observations were `RESTRICTED` by the existing regime gate. No conditional entry, target, or invalidation was shown for the sampled assets because the unchanged level engine did not derive every prerequisite under those current restricted signals.

| Asset | Provider / timeframes | Data state | Status / readiness | Missing confirmation or data reason | Conditional plan |
|---|---|---|---|---|---|
| BTC | Kraken Spot; 1H / 4H / 1D | `LIVE`, `VALID` | `POTENTIAL`, `NEAR_READY` 11.7/100 | Exit RISK OFF; confirm existing direction; confirm 4H and 1D bearish bias. | Unavailable; no derived candidate. |
| ETH | Kraken Spot; 1H / 4H / 1D | `LIVE`, `VALID` | `POTENTIAL`, `NEAR_READY` 11.7/100 | Exit RISK OFF; confirm existing direction; confirm 4H and 1D bearish bias. | Unavailable; no derived candidate. |
| SOL | Kraken Spot; 1H / 4H / 1D | `LIVE`, `VALID` | `WATCH`, `WATCH` 0/100 | Exit RISK OFF; confirm existing direction; confirm 1H and 1D bearish bias. | Unavailable; early evidence only. |
| AAVE | No coherent provider bundle | `UNAVAILABLE`, `INVALID` | `DATA_UNAVAILABLE`, score unavailable | Required validated bundle was unavailable, stale, invalid, or incoherent. | Unavailable; no technical evaluation. |
| DOT | Kraken Spot; 1H / 4H / 1D | `LIVE`, `VALID` | `POTENTIAL`, `NEAR_READY` 23.3/100 | Exit RISK OFF; confirm existing direction; confirm 1D bearish bias. | Unavailable; no derived candidate. |

Each sampled production item included the existing provider, UTC-derived response timestamp, timeframe profile, freshness, and validation state. A separate unauthenticated read-only `crypto.paperPortfolio` request returned **HTTP 401**. The public browser shell was still limited by the pre-existing hosting/billing condition and displayed `RECONNECTING` with a loading Discovery query; it did not render fabricated rows. The direct public V2 API response is the authoritative Phase 9 production evidence.

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


## Phase 10B — Authorized Persistence and Setup Monitor

Phase 10B adds an authenticated, owner-scoped **Setup Monitor** for the existing Opportunity Discovery `POTENTIAL`, `QUALIFIED`, and `WATCH` observations. It is a persistence and re-evaluation layer only. It does not alter Opportunity Score, Regime Score, setup thresholds, provider policy, indicator formulas, alerts, scheduled ingestion, Research Lab, Paper Trading economics, or the real-trading prohibition.

| Boundary | Phase 10B behavior |
|---|---|
| Authorization | Every Setup Monitor procedure is protected by authenticated tRPC access and filters by the authenticated owner/user identifier. Unauthenticated requests are rejected by the existing auth middleware. |
| Save eligibility | Only existing `POTENTIAL`, `QUALIFIED`, or `WATCH` discovery results can be saved. `NO TRADE`, `DATA UNAVAILABLE`, and unsupported setup contexts are rejected. |
| Original snapshot | The save operation stores the original discovery/readiness evidence as an immutable JSON snapshot, including setup identity, scores, regime, technical evidence, provenance, timestamps, and conditional-plan fields. It is never overwritten by refresh. |
| Current state | Refresh performs a new server-side evaluation through the authoritative Phase 9 engine and writes only the current state, current evidence, validation timestamp, and current snapshot. The original snapshot remains unchanged. |
| Monitoring scope | Re-evaluation is read-only evidence collection. It does not create alerts, execute Paper Trading, close or mutate trades, or perform any real-trading action. |
| PWA/offline | The workspace is readable only from server-derived query data. Save, refresh, and archive mutations are disabled while offline; the service worker remains static-shell-only and does not cache API/provider responses. |

### Additive persistence model

The `setupMonitorInstances` table stores one user-owned monitoring instance per saved setup identity. It contains the immutable original status/snapshot, the current status/snapshot, setup type, symbol, timeframe, direction, original/current Opportunity and Regime evidence, lifecycle timestamps, and archive state. The `setupMonitorEvents` table stores deduplicated lifecycle history linked to the instance. Both tables are additive and preserve all existing records and schemas.

The event uniqueness boundary is `(instanceId, eventKey)`. A repeated refresh that produces the same material event key does not create a second row. Event keys cover state changes, target progress, health changes, invalidation, data unavailability, and archive transitions. The service records event evidence and reason text without treating an event as an instruction or an action.

### Lifecycle state machine

| Transition | Meaning |
|---|---|
| `POTENTIAL → POTENTIAL` | Evidence remains conditional; no duplicate unchanged event is emitted. |
| `POTENTIAL → QUALIFIED` | The current server-authoritative re-evaluation satisfies the existing qualification contract; a state-change event is recorded once. |
| `POTENTIAL → WATCH` | Current evidence falls back to an early/incomplete watch state; the original snapshot remains Potential. |
| `QUALIFIED → QUALIFIED` | Qualified evidence remains valid; target/health events are emitted only when their deduplicated key changes. |
| `QUALIFIED → WATCH/POTENTIAL/NO_TRADE/DATA_UNAVAILABLE` | Current qualification is lost or unavailable; the current state changes and the reason is persisted, without rewriting original evidence. |
| Any active state → `ARCHIVED` | The owner explicitly archives monitoring. Archived instances are excluded from active results and cannot be refreshed. |
| `ARCHIVED` | Terminal for this instance; no automatic resume, alert, or trade mutation exists. |

A refresh never silently promotes a setup from a historical snapshot. It evaluates current server-side evidence, persists current state separately, and exposes the exact reason for a transition or unavailable result. Repeated refreshes are therefore safe and auditable.

### Phase 10B validation record

Focused deterministic validation passed with **61 tests** across Setup Monitor lifecycle tests, PWA contract assertions, and Paper Trading regressions. The complete repository regression suite passed with **242 tests across 43 files**. TypeScript validation passed with `tsc --noEmit`, and the production Vite/esbuild build completed successfully. The production bundle emitted only the existing non-blocking chunk-size advisory.

The PWA contract explicitly confirms that Setup Monitor uses the tRPC server route, enables reads only when online, disables refresh/archive/event writes offline, contains no browser provider endpoint or direct provider fetch, remains reachable from the mobile secondary navigation, and preserves authenticated server ownership filtering. No score, provider, alert, schedule, Paper Trading, Research Lab, or real-trading behavior was modified by Phase 10B.

No Paper Trade, alert, automatic notification, real order, or background monitoring action is created by Setup Monitor. Persistence begins only after an authenticated user explicitly saves an eligible existing discovery setup, and all later refreshes remain manual and read-only.


## Phase 11 — Live Setup Monitoring & Trade Health Intelligence

Phase 11 extends the existing Phase 9/10C interpretation and Phase 10B persistence layers without changing the Opportunity Score, Regime Score, scoring weights, indicator formulas, provider policy, alert thresholds, Paper Trading authorization/economics, real-trading prohibition, or scheduler behavior. No new database table or provider was required.

### Conditional plan evidence

Entry zones remain server-derived from the validated execution-timeframe current price and EMA20. Preferred Entry is the EMA20 value only when the existing engine has reached level derivation. Confirmation remains the existing multi-timeframe requirement and is displayed as a condition to wait for; it is not converted into a user-entered order instruction.

Targets remain the existing nearest validated forward swing structure or ATR extensions. The UI shows only targets the engine actually derives; it does not fill T1/T2/T3 or invent levels. Stops and invalidation remain the recent structural pivot with the existing 0.25 ATR buffer, and are shown only when valid relative to the entry zone. R:R remains descriptive and calculated from the actual preferred entry, stop, and each available target; it never changes Opportunity Score, Regime Score, or eligibility thresholds.

### Live health and target path

Setup Monitor re-evaluates the current item server-side on explicit authenticated refresh. Target progress is direction-aware and records `progressPercent`, `distanceFromEntryPercent`, and `distanceToInvalidationPercent` in the current technical snapshot. Progress is bounded to 0–100%; a target passed by the validated current price is `REACHED`, while missing entry or current price yields unavailable progress.

The monitor health state remains evidence-based: `HEALTHY` for supported qualified/target-progress states, `CAUTION` for a Potential setup under observation, `REVERSAL_RISK` when Watch/confirmation deterioration is present, `INVALIDATED` after the existing invalidation gate, and `DATA_UNAVAILABLE` when required validated inputs fail closed. Reversal risk is described as increased risk with reasons; it is never presented as a certainty or a prediction.

### Original versus current state

The existing immutable creation snapshot remains untouched. It preserves the original status, setup readiness, Opportunity context, direction, entry zone, preferred entry, targets, stop/invalidation, provider, timeframe, timestamp, freshness, validation state, and evidence. The current snapshot is stored separately and now includes the complete server-derived current evidence snapshot at creation and refresh, including current price, health, target progress, current explanation, provider provenance, freshness, and validation timestamp.

### Monitoring history and authorization

Meaningful transitions only are written to the existing event history. `CREATED`, state transitions, target reaches, caution, reversal risk, invalidation, unavailable data, and archive remain deduplicated by the existing `(instanceId, eventKey)` uniqueness rule. Refresh does not create trades, alerts, notifications, automatic closes, or reversals. All reads and mutations remain owner-scoped through protected procedures.

### UI surfaces

Setup Monitor now presents immutable Original Plan and server-derived Current Plan sections with direction, entry zone, preferred entry, current price, stop/invalidation, distance to invalidation, target progress bars, R:R, confirmation, provider, timeframe, timestamp, freshness, validation status, health reason, and event provenance. Health, direction, and trade-plan filters are display-only and do not change server calculations.

Discovery adds display-only health, direction, and plan filters. Established Scalping and Swing cards expose the current server-status-derived health label alongside their existing Opportunity, conditional plan, diagnostic, provider, and Paper Trading presentation. Discovery Watch remains a waiting/caution state; active `REVERSAL RISK` is reserved for monitored deterioration.

### PWA and safety boundaries

The Service Worker remains static-shell-only. Protected API responses, Setup Monitor records, authentication tokens, Paper Trading data, and research data are not cached. Offline remains read-only, and Setup Monitor refresh/archive plus Paper Trading mutations remain disabled without an online server connection. No provider credential or endpoint is exposed to the browser.

All values are classified as **SERVER-DERIVED** (levels, health, target progress, state, provenance, timestamps), **DISPLAY-ONLY** (filters, labels, progress bars, formatting), or **USER-INPUT** (none added in Phase 11). When provider data is stale, incoherent, insufficient, or unavailable, live plan and health calculations fail closed and the interface shows `DATA STALE`, `DATA UNAVAILABLE`, or an equivalent unavailable explanation rather than manufacturing a setup.

## Phase 15A — Adaptive Trading Intelligence and Auto Paper

Phase 15A adds a server-authoritative interpretation layer named Adaptive Qualification. It reads the existing validated setup plan, multi-timeframe evidence, provider coherence, market regime, risk/reward, and data freshness; it does not recalculate or replace Opportunity Score, Regime Score, indicator values, setup thresholds, or provider policy. The adaptive state vocabulary is **STRONG SETUP**, **QUALIFIED**, **POTENTIAL**, **WATCH**, **CAUTION**, **LOW CONFIDENCE**, **NO TRADE**, and **DATA UNAVAILABLE**. Adaptive quality includes a bounded quality score when supported, a confidence label, component-level evidence, confirmation gaps, and warnings. Discovery and established Scalping/Swing surfaces expose these fields as additive badges and filters.

Trading modes are exposed as Conservative, Balanced, Aggressive/Opportunity, and Discovery controls in Auto Paper. The mode changes only the visibility/qualification interpretation used for simulation trials; it never weakens mandatory data-quality gates or creates a trade from missing, stale, incoherent, mixed-provider, or fabricated input. The established 15M Fast Scalp remains the validated fallback strategy when the isolated native 1M/3M/5M path is unavailable. No resampling, provider mixing, relabeling, or synthetic candle construction is performed.

Auto Paper is a separate, authenticated, owner-scoped simulation layer. It is **OFF by default**, requires an explicit online enable action, accepts no frontend-supplied prices, scores, stops, or targets, and can create only server-revalidated simulation records with source `AUTO_PAPER`. The existing Manual Paper workspace remains a separate source and accounting path; Auto Paper trials are presented in Auto Paper Lab and are not silently merged into manual positions. There is no broker, exchange-order, real-balance, withdrawal, or real-trading path.

Each trial stores an immutable plan and entry snapshot, current server-derived observation, provider/provenance and freshness metadata, bounded risk settings, and a unique owner/setup identity. Duplicate active setup prevention and unique `(trial, eventKey)` event persistence make trial creation and monitoring idempotent. Target reach, warning, reversal risk, invalidation, and data-unavailable observations are recorded as deduplicated events. `DATA_UNAVAILABLE` is resumable: it pauses current observation while retaining the trial and can return to a live state after a later validated provider response; it is not treated as a fabricated price or forced close.

The additive migration creates `autoPaperSettings`, `autoPaperTrials`, and `autoPaperEvents`; it does not modify existing Paper Trading tables or scoring data. Protected tRPC procedures provide settings, server-side evaluation, active/history/performance views, refresh, and event history. A cron-only `/api/scheduled/auto-paper-refresh` callback is available for a separately authorized WebDev Heartbeat schedule; this release does not create or alter a recurring schedule. The callback authenticates the platform task identity, ignores request-body ownership, refreshes only enabled owner-scoped settings, and returns sanitized errors.

Phase 15A release boundaries remain unchanged: no real trading, no automatic manual-Paper closes, no alert threshold changes, no Research Lab execution, no new provider, no scoring-weight changes, no PWA API/mutation caching, and no offline Auto Paper mutation. Offline PWA mode remains read-only and the static Service Worker caches only the existing shell/immutable assets.


## Phase 16 — Auto Paper Trading Lab & Adaptive Trade Lifecycle

Phase 16 introduces an independent, authenticated Auto Paper accounting environment. Auto Paper is not a second view of Manual Paper: it owns its own starting capital, available cash, reserved exposure, equity, realized P/L, unrealized P/L, trials, and immutable event history. The default account is created only through an explicit authenticated Auto Paper settings enable path and starts disabled; passive dashboard or Lab rendering never creates an account, trial, position, or balance movement. The established project paper-capital configuration is used as the starting-capital source.

The additive migration creates `autoPaperAccounts`, makes the legacy `paperTradeId` compatibility link nullable, adds `accountId`, persists the selected mode and simulation accounting fields, and expands lifecycle statuses without dropping Manual Paper tables or copying Manual Paper balances. Existing Auto Paper trials are preserved and backfilled to an owner-scoped independent account when present. Because the migration is additive and no existing Auto Paper trials were present at migration time, the deployed account and trial tables currently contain zero rows; the two existing Manual Paper portfolios and two Manual Paper trades remain separate and unchanged.

For an entry, the server validates live/coherent/provider-consistent evidence, adaptive qualification, direction, strategy, entry zone, stop, target path, reward/risk, quality, configured mode, position limit, and independent available cash. It computes simulated position size from the existing risk-percent setting, reserves entry notional against the Auto Paper account, persists an immutable plan and entry snapshot, and records a `SIMULATED_ENTRY` event. No Manual Paper mutation, exchange request, broker request, real balance, deposit, withdrawal, or real-order path exists.

For an open trial, reserved capital is `entryPrice × positionSize`; unrealized P/L is `(validatedPrice − entryPrice) × positionSize × directionSign`. A validated stop releases exposure and moves the simulated P/L to realized P/L. Target milestones, warnings, reversal risk, and data-unavailable observations remain persisted as event-deduplicated lifecycle evidence. When data is missing, stale, incoherent, or provider provenance is invalid, the trial remains resumable as `DATA_UNAVAILABLE`; the system does not invent a price, P/L, entry, target, or stop. Account equity is `startingCapital + realizedPnl + unrealizedPnl`, while available cash is starting capital plus realized P/L less currently reserved exposure.

The four user-facing modes are Conservative, Balanced, Aggressive, and Experimental. Conservative applies stronger quality and reward/risk requirements. Balanced uses configured thresholds. Aggressive and Experimental may admit explicitly permitted Potential setups but never bypass data-quality gates, ownership, or server-side validation. `CUSTOM` remains readable as a legacy value and is interpreted as Experimental for new policy evaluation. Performance views are filterable by strategy, timeframe, direction, mode, asset, and date range; win rate, average R, profit factor, and related metrics remain marked insufficient until at least five completed simulations exist.

The protected Lab shows independent balance, account state, active trials, original immutable plan versus current server observation, event feed, target/stop health, Scalp-versus-Swing comparison, and simulation controls. The Dashboard summary is read-only and never initializes the account. The cron-only refresh boundary is available for an explicitly configured scheduler, but Phase 16 does not create or alter a recurring schedule. Auto Paper remains OFF by default and remains separate from Manual Paper.

Validation requirements for this phase include database schema and foreign-key inspection, existing Manual Paper row-count preservation, authenticated owner isolation, unauthenticated rejection, deterministic accounting and lifecycle tests, full regression tests, TypeScript, production build, real-action and client-secret scans, PWA API-cache exclusion, restart verification, and safe authenticated production reads only. No production Auto Paper trial is created merely to demonstrate the feature.

## Phase 17 — Auto Paper Live Validation & Performance Intelligence

Phase 17 extends the independent Auto Paper simulation layer as a measurement system, not a trade-generation system. The existing cron-only refresh path remains the only execution authority; the browser only reads results and requests explicit user-facing exports. Auto Paper stays OFF by default, owner-authenticated, server-validated, duplicate-safe, and disconnected from exchanges, brokers, execution credentials, and Manual Paper accounting.

Performance is calculated from persisted Auto Paper trials only. Completed trials are terminal `STOPPED`, `CLOSED`, `COMPLETED`, or `EXPIRED` records; open and data-unavailable observations are excluded from wins and losses. Wins and losses are determined from realized P/L, gross profit and gross loss are sums of positive and negative realized P/L, profit factor is gross profit divided by absolute gross loss only when the completed sample has at least five trials, and win rate, loss rate, average R, and total R remain unavailable below that same minimum sample. `R multiple` uses realized P/L divided by the recorded risk amount, never an invented risk value. Maximum drawdown is the largest peak-to-trough decline of the reconstructed persisted equity sequence. The sample label is `LIMITED SAMPLE` below 50 completed trials, `EARLY EVIDENCE` from 50 through 499, and `LARGER SAMPLE` at 500 or more; these labels are descriptive and do not imply profitability.

The Lab now provides a responsive server-derived Equity Curve, drawdown values, completed-trial cards, server-side filters for strategy, timeframe, direction, mode, asset, regime, qualification, status, and date range, plus authenticated JSON and CSV exports. Reports include account and performance metadata, trial provenance, provider, freshness, setup quality, targets, stop, timestamps, and no secrets or authentication tokens. Empty and low-data states explicitly show `NO COMPLETED TRIALS YET`, `LIMITED SAMPLE`, or `DATA UNAVAILABLE` rather than fake performance.

Target progression remains direction-aware and evidence-backed. A verified third target closes a simulation as `COMPLETED` and realizes its server-derived P/L; stop crossing realizes the independent account result as `STOPPED`. Intermediate milestones remain persisted in the current snapshot and event feed. No target, entry, stop, price, indicator, provider response, or explanation is fabricated. Manual Paper data and balances remain independently queryable and untouched.

The Service Worker continues to bypass `/api/*`, tRPC, account, trial, event, and performance responses. Auto Paper mutations and account initialization remain disabled offline. Production validation must use authenticated read-only checks; a simulation may only be created when a legitimate server-derived setup satisfies every existing data-quality, provenance, freshness, entry, stop, target, direction, cash, mode, and duplicate gate.
