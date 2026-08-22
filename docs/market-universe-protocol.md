# Historical Market Universe Protocol

## Purpose and non-model boundary

This protocol expands the **historical data universe**, not the Opportunity Engine. It does not alter scoring weights, confidence weights, technical indicators, regime logic, alert thresholds, paper trading, or the real-trading prohibition. It does not run or optimize a Research Lab study.

## Persistent registry

`marketUniverseAssets` is the durable catalog. Each record retains the stable asset ID, symbol, name, provider/exchange identifiers, priority tier, registry classification, first/last observed timestamps, reliably known listing/delisting fields, and availability status. Registry taxonomy is explicitly a catalog label, not a claim of historical sector membership.

| Field group | Treatment |
| --- | --- |
| Identity | Stable asset ID, symbol, name, CoinGecko ID, and exchange symbols are stored with source provenance. |
| Representation | Tier and inclusion reason record why a source-supported asset was selected for breadth, liquidity, or volatility representation. |
| Time | First and last observed timestamps come from persisted OHLCV, never inferred from today’s listing. |
| Classification | `REGISTRY_ONLY` is allowed; point-in-time sector data remains unavailable unless a separately assessed source qualifies. |
| Survivorship | `CURRENT_SURVIVOR_UNIVERSE` is the default warning where historical delisted membership is unavailable. |

## Immutable universe snapshots

Every sealed dataset receives a `historicalUniverseSnapshots` record and one `historicalUniverseMembers` record per included asset. A member records tier, inclusion reason, available date range, status, quality evidence, and the **universe basis**.

> A current registry is never represented as a historical market-constituent list. Dataset composition means only “assets intentionally included in this stored dataset,” not “all assets that existed at that time.”

## Coverage and data quality

Per asset/instrument/timeframe coverage is computed as `actualCandles / expectedCandles × 100` only when expected candles are positive. The longest gap uses persisted missing-interval boundaries. No gaps are filled or interpolated.

| Component | Maximum points | Basis |
| --- | ---: | --- |
| Coverage | 45 | Persisted expected versus observed candles. |
| Continuity | 25 | Missing count and longest retained gap. |
| Freshness | 15 | Latest source candle relative to timeframe freshness threshold. |
| Integrity | 10 | Duplicate and malformed record rates. |
| Provider outcome | 5 | Latest persisted successful, partial, or failed ingestion state. |

The result is a **data-quality score only**. It is not supplied to Opportunity Score, Confidence Score, technical signals, alerts, or trading.

## Tiered source-supported universe

The registry uses fixed intent tiers, not current market-cap rankings. Candidate inclusion is contingent on public archive availability and is recorded per asset.

| Tier | Inclusion role | Initial intended representation |
| --- | --- | --- |
| 1 | Stable/liquid reference | BTC, ETH |
| 2 | Long-history liquid majors | Liquid public-archive assets with sustained source availability |
| 3 | Representative sectors | At least one source-supported L1, L2, DeFi, AI, RWA, DePIN, gaming, infrastructure, oracle, and meme candidate where available |
| 4 | Higher-volatility comparison | Source-supported meme or similarly volatile candidate; absence is recorded rather than substituted |

## Historical sector result

No assessed free source presently qualifies as a timestamped historical sector-classification provider. Dataset context therefore records **HISTORICAL SECTOR DATA UNAVAILABLE**. Registry taxonomy is retained as clearly labeled catalog metadata with source and method fields, never backfilled as point-in-time sector truth.

## Ingestion and schedules

Backfills and incrementals create new datasets; prior sealed versions are not overwritten. Each bounded scope has its own ingestion run, so a provider error or unavailable asset produces a partial dataset rather than cancelling other assets. Schedule execution retains task UID, configuration, status, assets processed, inserted candle count, gaps, provider errors, and predecessor dataset lineage.

## Source basis

Public Binance archive OHLCV and public CoinGecko market-cap observations are used only when returned with source timestamps. Binance documents archive support for 15M, 1H, 4H, and 1D data across Spot and Futures, and CoinGecko documents dated 00:00 UTC price/market-cap/volume snapshots. [1] [2]

## References

[1] [Binance Public Data archive documentation](https://github.com/binance/binance-public-data)

[2] [CoinGecko historical coin data by ID documentation](https://docs.coingecko.com/reference/coins-id-history)
