# Historical Data Foundation Protocol

**Protocol version:** `HISTORICAL_DATA_FOUNDATION_V1`  
**Purpose:** Reconstruct the analytical state available at a historical timestamp without consulting data after that timestamp or silently changing the basis of a completed research run.

> The historical foundation is **research infrastructure only**. It does not alter production Opportunity or Confidence weights, thresholds, indicator parameters, paper trading, real trading, or the existing hourly alert.

## Dataset Identity and Immutability

The platform uses an append-only candle store and immutable, user-selectable dataset versions. A dataset version has an identifier such as `DATASET-2026-08-21-001`, a UTC sealing timestamp, a provider manifest, a coverage summary, and a content fingerprint. A completed research run stores the selected dataset version ID and fingerprint. New backfills, late-arriving candles, or provider corrections create a new version rather than rewriting the basis of a prior run.

| Object | Role | Mutability rule |
|---|---|---|
| Historical candle revision | Exact provider-sourced OHLCV observation with source timestamp, source hash, and ingestion batch | Append-only; never overwritten. |
| Ingestion batch | One backfill or incremental provider attempt, including errors and validation counts | Immutable after completion. |
| Dataset version | A sealed data cutoff and manifest of batches/revisions eligible for research | Immutable after sealing. |
| Quality record | Computed coverage, gap, duplicate, malformed, and freshness state per dataset/asset/instrument/timeframe | Recomputed for a new version; never substitutes an earlier result. |
| Research run | Stores dataset version and the exact configuration, cost policy, model configuration, and result snapshot | Immutable after completion. |

## Candle Contract

All timestamps are UTC. Each record preserves the provider open/close timestamps in milliseconds where the source supplies them; database timestamps are normalized UTC values. Candle identity is `dataset lineage + asset + exchange + instrument + timeframe + provider open time + source hash`, so duplicate source revisions are detectable and cannot silently overwrite one another.

Only valid, completed candles are eligible for default reconstruction. A candle is malformed if timestamps are invalid, close time is not after open time, OHLCV values are non-finite or non-positive, high is below either open or close, or low is above either open or close. The expected interval is 15 minutes, 1 hour, 4 hours, or 1 day. Missing intervals are computed from the expected interval and recorded as explicit gaps.

| Quality state | Meaning |
|---|---|
| `COMPLETE` | No detected gaps in the assessed coverage and the latest expected completed candle is present. |
| `PARTIAL` | Usable candles exist but gaps, malformed observations, or incomplete requested coverage exist. |
| `MISSING` | No eligible candles exist for the requested asset, instrument, and timeframe. |
| `STALE` | Candles exist, but the latest completed source candle is older than the freshness window. |
| `ERROR` | The latest ingestion attempt failed; prior valid coverage is retained and reported separately. |

## Source and Instrument Boundaries

Public Binance completed-candle archives and the Binance Futures endpoint supply OHLCV. The archive publishes daily/monthly public files and documents 15m, 1h, 4h, and 1d kline support.[1] CoinGecko market-chart data can provide historical market cap, price, and volume; its documented automatic grain is hourly only through recent history and daily for older history, so unavailable timestamps remain unavailable rather than interpolated.[2]

Spot and perpetual records are separate datasets. Funding applies only to perpetual research. When verified historical funding is unavailable, perpetual runs must label it `UNAVAILABLE`, `ASSUMED`, or `EXCLUDED`; it must never be invented. Spot runs never apply funding.

## Point-in-Time Reconstruction Rules

`reconstructState(asset, timeframe, timestamp, datasetVersion)` returns only dataset records eligible in the selected version with a source close time at or before `timestamp`. The current default is a closed-candle strategy: an analysis bar may contribute only after its close. A 1H decision at 14:00 UTC therefore uses the most recent completed 4H candle, not a candle closing at 16:00 UTC.

The reconstruction output must disclose the OHLCV cutoff, missing intervals, technical inputs, historical market-cap availability, regime snapshot availability, sector snapshot availability, score configuration fingerprint, model version, and research-cost configuration. It must not fill any missing historical field using current market data.

## Historical Context and Survivorship

Historical market-cap, regime, and sector records carry source, retrieval timestamp, freshness, definition version, and availability status. The initial sector history is explicitly unavailable unless source-supported snapshots exist; the current configured taxonomy is not treated as historical evidence. The initial regime history is produced from stored historical OHLCV inputs with its own regime definition version and never reconstructed from the live scanner’s current context.

Asset availability tracks listing and delisting dates when a reliable source supplies them. Until an archival universe is available, research outputs disclose survivorship bias because the configured universe consists of current supported assets.

## Research Cost Protocol

Every dataset-backed research configuration explicitly stores `instrumentType`, fee rate, slippage rate, funding mode, funding source or assumption, and a cost-model version. Gross return is calculated before these costs; net return is calculated after only applicable, declared costs. The two values remain separate in all output and exports.

## References

[1] [Binance Public Data, Kline archive documentation](https://github.com/binance/binance-public-data)  
[2] [CoinGecko, Coin Historical Chart Data](https://docs.coingecko.com/reference/coins-id-market-chart)
