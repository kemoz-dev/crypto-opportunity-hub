# Market Universe Source Assessment

## Verified public-source capabilities

| Capability | Source | Verified basis | Implementation decision |
| --- | --- | --- | --- |
| Historical OHLCV | Binance Public Data archive | Public market data is published in daily and monthly files. The archive supports Spot and Futures market types, including USD-M Futures; it documents 15M, 1H, 4H, and 1D klines. New daily data is available the following day and monthly data on the first Monday of a month. | Use source-open/source-close timestamps, archive provenance, and quality states. Do not claim current-month monthly data before publication. |
| Spot timestamp encoding | Binance Public Data archive | From 1 January 2025, Spot archive timestamps are in microseconds. | Preserve raw source units and normalize before persistence; do not mix them with millisecond futures timestamps. |
| Historical daily coin facts | CoinGecko historical coin data by ID | The endpoint returns price, market cap, and 24-hour volume as a 00:00:00 UTC snapshot for a requested date. Its documentation does not provide historical sector-classification provenance. | Retain market-cap observations when returned; do not use this endpoint as a historical sector source. |

## Sector-source result

No historical sector provider is approved in this checkpoint. The reviewed CoinGecko historical endpoint documents price/market-cap/volume snapshots but no timestamped sector-classification history or methodology. The documented CoinGecko category endpoint is a current GeckoTerminal list, advertises a 60-second refresh cadence, requires a paid plan, and does not document dated asset-membership history. It is therefore unsuitable for point-in-time sector classification. The registry will store current catalog taxonomy as a **registry classification**, retain provenance, and mark point-in-time sector classification as **HISTORICAL SECTOR DATA UNAVAILABLE**.

## References

[1] [Binance Public Data archive documentation](https://github.com/binance/binance-public-data)

[2] [CoinGecko historical coin data by ID documentation](https://docs.coingecko.com/reference/coins-id-history)

[3] [CoinGecko categories-list documentation](https://docs.coingecko.com/reference/categories-list)
