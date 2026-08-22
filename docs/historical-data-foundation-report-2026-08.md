# Historical Data Foundation: Coverage and Integrity Report

## Scope and status

This report describes the first **sealed point-in-time historical dataset** created for Crypto Opportunity Hub. The implementation is research infrastructure only. It does not alter the production Opportunity Engine formula, user scoring settings, paper-trade rules, real-trading prohibition, or the existing hourly **Test Alert — High Opportunity 4H**.

| Item | Recorded status |
| --- | --- |
| Latest sealed dataset | `DATASET-2026-08-22-001` (ID `210001`) |
| Dataset fingerprint | `51c384bbd174cb283b7b884d9b8fda4405519f5271875e1244ffa256fab5f4f3` |
| Ingestion cutoff | 2026-08-22 02:14:55 UTC |
| Total source-timestamped candles at cutoff | 74,460 |
| Historical market-cap observations | 2,201 available; 13 explicitly unavailable |
| Historical sector snapshots | 12 explicitly unavailable; current taxonomy is never substituted |
| Project ingestion schedule | Enabled, daily at 02:12 UTC; first observed execution succeeded at 2026-08-22 02:14:59 UTC and sealed dataset `210001` |

## Actual public-data coverage

The public Binance archive supplied a complete August 2025 through July 2026 window for the loaded scopes. August 2026 is explicitly absent because its monthly public archive was not completed at materialization time. This yields `STALE` rather than a fabricated current candle. Binance’s archive is the OHLCV source; CoinGecko’s historical market-chart endpoint is the source for the retained daily market-cap observations.[1] [2]

| Instrument | Timeframe | Asset coverage | Valid source candles | Integrity result |
| --- | --- | --- | ---: | --- |
| Perpetual | 1D | 12 supported assets | 4,380 | No internal gaps in loaded range; current archive month unavailable |
| Perpetual | 4H | 12 supported assets | 26,280 | No internal gaps in loaded range; Solana retry persisted as a corrective version |
| Perpetual | 1H | BTC | 8,760 | No internal gaps in loaded range |
| Perpetual | 15M | BTC | 35,040 | No internal gaps in loaded range |

> **Coverage interpretation.** The platform supports 15M, 1H, 4H, and 1D storage. It does not claim that every asset currently has every sub-daily historical series. The quality view displays scope-specific status, expected versus actual count, gaps, duplicates, malformed records, and source timestamps.

The successful scheduled version `210001` branched from sealed dataset `180001`. It retained 2,214 historical market-cap rows, 46,355 historical regime rows, 12 explicitly unavailable sector rows, and 12 survivorship-limitation records. The copied rows carry `inheritedFromDatasetId: 180001` provenance; no current market or taxonomy value was used to fill a historical field.

## Point-in-time verification

The deterministic reconstruction check used BTC perpetual 1H at a requested timestamp of 2026-07-31 20:00:00 UTC. It admitted candles only through the most recent closed bar at `2026-07-31T19:59:59.999Z`, selected the sealed dataset cutoff, retained stored historical market-cap and regime context, and returned `PARTIAL_RECONSTRUCTION` rather than inventing missing facts.

| Field | Stored result |
| --- | --- |
| Opportunity / confidence / technical | 49.9 / 61.9 / 15.0 |
| Historical market cap | Available |
| Historical regime | Risk Off |
| Historical sector snapshot | Unavailable |
| Liquidity proxy | Unavailable; no historical 24-hour volume-to-market-cap substitution |
| Result label | `PARTIAL_RECONSTRUCTION` |

## Cost treatment

Research-cost calculations preserve **gross return** and **net return** as distinct values. Fees and slippage are entered per side. Spot funding is always excluded. Perpetual funding must be actual, explicitly assumed, explicitly excluded, or marked unavailable; when it is unavailable, net return is also unavailable rather than inferred.

## Remaining limitations

The retained sector history is unavailable because no reliable point-in-time sector source is configured. Listing and delisting metadata is unavailable, so the dataset carries an explicit survivorship-bias limitation. Market-cap availability is partial across the tracked universe, and recent candles may remain stale until completed public archive files are published. The initial scheduled job has been configured, authenticated, and observed completing one successful bounded run; ongoing executions remain subject to the two-minute callback timeout and public archive availability.

## References

[1] [Binance Public Data archive](https://data.binance.vision/)

[2] [CoinGecko historical market-chart endpoint](https://docs.coingecko.com/reference/coins-id-market-chart)
