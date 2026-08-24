# Live OHLCV Provider Resilience

## Scope

This change alters only **live OHLCV acquisition**. The Opportunity Score formula, weights, technical indicators, Confidence formula, thresholds, market-regime logic, alerts, paper trading, real-trading prohibition, Research Lab, historical ingestion schedules, and provider choices for historical ingestion are unchanged.

## Provider order

The scanner requests normalized Binance Futures candles first. If and only if Binance returns HTTP 451, the request is classified as `PROVIDER_UNAVAILABLE_REGION_RESTRICTION`, persisted as unavailable provenance, and falls back to Kraken Spot `GET /0/public/OHLC` for that asset/timeframe. Other Binance failures remain unavailable rather than being silently masked.

Kraken was selected after a read-only verification of its documented public OHLC endpoint and live availability for all 12 current USD-pair mappings. It supplies 15m, 1h, 4h, and 1d intervals, UTC epoch timestamps, OHLC, volume, and recent historical/current candles. Its 720-candle limit makes it appropriate as a live scanner fallback, not as a replacement for immutable deep historical datasets. [1] [2]

## Validation and provider consistency

The adapter maps a provider response into the existing `Candle` contract before analysis. It rejects missing or mismatched symbols, unsupported intervals, non-finite values, invalid OHLC bounds, non-positive volume, incomplete/insufficient windows, corrupt timestamps, gaps, and duplicate or incorrect spacing. It removes the in-progress candle and requires the same 202-candle minimum used by the configured EMA/MACD analysis.

Each timeframe is an all-or-nothing single-provider series. If valid timeframes for an asset would come from both Binance and Kraken, the scanner returns `MIXED_PROVIDER_PREVENTED` and produces no score for that asset; it never stitches providers.

## Provenance and health visibility

Each OHLCV status retains provider, symbol, timeframe, retrieval time, provider status, normalization version `live-ohlcv-normalization-v1`, data-quality state, and error classification. Existing `dataSources.metadata` persists those fields for both valid and unavailable outcomes. The dashboard aggregates these records into a Live OHLCV Provider Health section with source, validity/unavailability, affected timeframes, last successful request, last error, error class, and OHLCV capability.

## Operational result

The implementation does not generate, estimate, forward-fill, or manufacture OHLCV. If neither validated Binance nor validated Kraken data is available, the result is explicitly unavailable and the existing scoring engine receives no candles. When a coherent validated series is available, the unchanged technical analysis and Opportunity Engine run normally.

## References

[1]: https://docs.kraken.com/api-reference/market-data/get-ohlc-data "Kraken Developers — Get OHLC Data"

[2]: https://docs.kraken.com/exchange/guides/general/historical-data "Kraken Developers — Historical Data"
