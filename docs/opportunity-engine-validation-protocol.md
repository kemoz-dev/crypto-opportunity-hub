# Opportunity Engine Validation Protocol

**Reference date:** 21 August 2026 (GMT+3)  
**Scope:** Existing technical, market, sector, paper-trading, backtesting, and alert capabilities only. No sentiment, on-chain, whale-tracking, paid, or additional provider integrations are in scope.

## Objective and Evidence Standard

The validation tests whether the existing configured research signals behave consistently on data that was available at each decision time. It does not select a model solely for its highest realized return and does not imply that a historical pattern will recur.

> A result is reported only when it is reconstructable from stored or fetched market observations, a declared configuration, and an explicit cutoff time. Any unsupported horizon, missing regime classification, unavailable sector comparison, or too-small sample is reported as **Insufficient Data**, never estimated.

## Data Basis and Time Controls

| Element | Validation basis | Control |
|---|---|---|
| Live observations | Existing CoinGecko market context and Binance Futures OHLCV adapter | Provider status and timestamps are retained with each scan. |
| Historical decisions | Existing selected-timeframe OHLCV data through the decision candle close | The engine must receive only `candles[0..index]` at decision time. |
| Outcomes | Subsequent bars only, subject to the configured stop, target, or holding-bar exit rule | No outcome bar may contribute to pre-entry score components. |
| Configuration | Stored scoring and backtest configuration | Results retain the configuration used at run time. |
| Paper-trade observation | Exact live scanner row at entry time | Entry snapshot remains append-only after creation. |

CoinGecko documents the asset-market fields used in the current adapter, while Binance documents the futures market-data surfaces that supply the existing OHLCV adapter.[1] [2]

## Required Comparisons

| Research dimension | Comparison set | Reported status when data is limited |
|---|---|---|
| Signal combinations | RSI + MACD; add EMA; add volume; add relative strength; add multi-timeframe alignment | Insufficient Data if the required component cannot be derived point-in-time. |
| Score thresholds | Opportunity 60/70/80/90; Confidence 60/70/80; selected joint thresholds | Sample count is displayed with every metric. |
| Outcome horizons | 24H, 3D, 7D, and 30D when a timeframe and subsequent-candle coverage support the horizon | Unavailable if subsequent data has not elapsed or is not fetched. |
| Market regime | Existing regime bucket at the historical decision time | Insufficient Data until a point-in-time regime series exists. |
| Sector model | Generic baseline against the active sector hypothesis for each supported sector | Supported, Weak Evidence, Unsupported, or Insufficient Data. |

## Interpretation Rules

A sector or configuration is **Supported** only when its point-in-time comparison produces an adequate observation count and a consistently favorable result on the specified objective measure. **Weak Evidence** means a favorable direction but an insufficient or unstable sample. **Unsupported** means available evidence is unfavorable. **Insufficient Data** means the requisite point-in-time inputs or sample coverage is absent.

The deployed release is the only environment in which background alert schedules can be activated. The alert callback must remain cron-only, resolve records by its authenticated task identifier, and record any evaluation failure without returning secrets or raw credentials.

## References

[1] [CoinGecko, “Coins markets” API reference](https://docs.coingecko.com/reference/coins-markets)

[2] [Binance Developers, “USDⓈ-M Futures market data” documentation](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-futures/api/rest-api/market-data)
