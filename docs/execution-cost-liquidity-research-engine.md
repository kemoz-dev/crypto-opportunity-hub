# Execution Cost & Liquidity Research Engine

**Protocol version:** `EXECUTION_COST_LIQUIDITY_RESEARCH_V1`  
**Purpose:** Estimate the declared execution frictions for a **hypothetical historical trade** while keeping gross and net outcomes distinct. This protocol is research infrastructure only. It does not alter the Opportunity Engine, production scoring configuration, alerts, paper-trading behavior, real-trading prohibition, or existing Research Lab runs.

## Boundary Contract

The Execution Cost Lab accepts a selected sealed historical dataset, a hypothetical trade definition, and an explicit cost-model configuration. It creates its own immutable, user-owned cost-study record. It does **not** call `runResearchExperiment()`, mutate an existing experiment, create a paper trade, evaluate an alert, or save a scoring configuration.

| Area | Execution Cost Lab behavior | Explicitly excluded behavior |
| --- | --- | --- |
| Opportunity / Confidence / regime / sector scoring | Reads neither live nor historical scoring outputs for cost calculation | No score, weight, regime, or sector-model modification |
| Historical source basis | Uses only selected sealed-dataset OHLCV, preserved market-cap facts where present, and separately persisted funding facts | No replacement with current liquidity, market depth, or fees |
| Trade behavior | Calculates a hypothetical research outcome only | No paper-trade creation, order placement, exchange connection, or real trading |
| Research Lab | Provides a future callable `calculateNetOutcome(trade, historicalState, costModel)` boundary | No automatic experiment creation or experiment re-run |

## Instrument Separation

Every study has one `instrumentType`: `spot` or `perpetual`. Spot applies fees, slippage, and optional estimated liquidity impact only. Perpetual additionally supports funding. The engine rejects a funding charge on spot and never silently transfers a perpetual assumption to a spot study.

## Cost Model

Every calculation stores a canonical fingerprint and the exact versioned configuration below.

| Component | Configured fields | Treatment |
| --- | --- | --- |
| Fee | maker/taker selection, entry fee, exit fee, exchange/source label | The default research taker assumption is **0.10% per side**. It is a declared scenario default, not a claim about an exchange’s fee schedule. |
| Slippage | fixed entry/exit basis points, asset override, liquidity-tier override, trade-size applicability | Applied explicitly on both sides; no universal slippage assumption is hidden in production code. |
| Estimated liquidity impact | trade notional, participation coefficient, cap basis points, source OHLCV volume, tier | Labeled `ESTIMATED_LIQUIDITY_IMPACT`; it is not presented as observed historical fill quality. |
| Funding | `ACTUAL`, `ASSUMED`, `UNAVAILABLE`, or `EXCLUDED`; source and interval evidence | Applies only to perpetuals. A missing actual series leaves funding unavailable unless the user deliberately selects and records an assumption. |

For the optional volume approximation, the engine derives point-in-time quote notional from completed stored candles: `sum(close × baseVolume)` over the prior 24 hours available at entry. The participation rate is `tradeNotional / observed24hQuoteNotional`. The configured impact formula is:

> `impactBps = min(capBps, participationRate × participationCoefficient × 10,000)`

The calculation records the formula version, source window, observed volume, coefficient, cap, and the result for each side. If the sealed dataset does not have enough completed candles for the window, the impact component is `UNAVAILABLE`; it is not substituted with current volume.

## Liquidity and Order-Book Availability

Liquidity tier is a **research execution variable**, never an Opportunity Score input. Tiers A–E are classified from observable, point-in-time values. The initial protocol uses historical 24-hour OHLCV-derived quote volume and, when present in the selected dataset, historical market-cap and volume-to-market-cap context. Thresholds and tier logic are versioned within the study configuration.

Historical order-book snapshots, bid/ask spread, depth, and imbalance are not presently retained in the dataset. The initial release must show `HISTORICAL ORDER-BOOK DATA UNAVAILABLE` and use only the declared fixed-slippage or estimated-volume-impact paths. It must not fabricate spread, depth, or fills.

## Funding Availability

The public Binance USDⓈ-M market-data documentation describes a funding-rate-history endpoint with symbol, inclusive start/end timestamps, and responses containing the funding rate, funding time, mark price, and rate type.[1] The lab may persist returned records as immutable public-source funding evidence for a requested perpetual study. Funding interval is retained as source-provided where available; if derived from adjacent settlement timestamps, it is labeled derived rather than source asserted. If retrieval is unavailable, incomplete for the holding window, or unsupported for the selected asset, the study reports `FUNDING DATA UNAVAILABLE`.

## Point-in-Time and Immutability Rules

The selected dataset must be sealed. Entry liquidity uses candles with close timestamps at or before entry; exit liquidity uses candles at or before exit. Actual funding uses only settlement records whose funding timestamp falls within the simulated holding period. Each completed study stores dataset ID, version, content fingerprint, source identifiers, retrieval timestamp, configuration fingerprint, historical-state evidence, result breakdown, and limitations. Completed study rows are never edited.

## Transparent Result Contract

The result always reports gross outcome independently from net outcome and exposes every component:

| Entry | Exit | Holding | Summary |
| --- | --- | --- | --- |
| Gross entry price, fee, slippage, estimated liquidity impact | Gross exit price, fee, slippage, estimated liquidity impact | Funding amount/status for perpetuals only | Gross P/L, fees, slippage, estimated liquidity impact, funding, total trading costs, net P/L, gross return, net return |

When a required selected component is unavailable, its status and reason remain visible. The engine does not manufacture a net result from missing actual funding or historical liquidity information.

## Scenario Analysis

The lab offers explicit sensitivity grids for declared fees, fixed slippage, and trade sizes, plus four named stress scenarios: `IDEAL_EXECUTION`, `LOW_COST`, `BASE_COST`, `HIGH_COST`, and `SEVERE_SLIPPAGE`. Each scenario stores the exact input assumptions. The tool never selects the most favorable scenario automatically.

## Future Integration

The calculation module exports a pure `calculateNetOutcome(trade, historicalState, costModel)` function. Existing Research Lab code remains unchanged in this release. A later, explicitly authorized research experiment may pass its historical trade and dataset-backed state to this function; that future integration must persist the same cost-model fingerprint and study provenance.

## Reference

[1] [Binance USDⓈ-M Futures Market Data — Get Funding Rate History](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data#get-funding-rate-history)
