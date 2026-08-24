# Provider Health Monitor

## Purpose and boundaries

The Provider Health Monitor is a deterministic, **read-only** infrastructure check. It records health evidence for the live OHLCV acquisition path; it does not invoke the market scanner, generate Opportunity or Confidence scores, create signals, create trades, evaluate user alerts, start Research Lab, alter historical data, or change any scoring configuration.

The platform calls the cron-only endpoint `/api/scheduled/provider-health-monitor`. The handler authenticates the platform task identity, finds the monitor only by the authenticated task UID, rejects non-cron requests, and stores an idempotent immutable execution record. The four-hour UTC schedule is `0 32 */4 * * *`; it is deliberately offset from the current scheduled ingestion window.

## What each run tests

The monitor validates the current mapping registry for all 12 scored symbols, then tests a representative `BTC` window at 15m, 1h, 4h, and 1d. Each test requires a complete 202-candle normalized window, UTC timestamp alignment and spacing, finite OHLC values, valid OHLC bounds, non-zero volume, and freshness within three requested candle intervals.

Each run records normal Binance primary checks and two clearly labelled controlled safety checks. The first forces the already-classified Binance 451 branch and requests real Kraken data; success is recorded only when the adapter accepts a real normalized Kraken series. The second forces the 451 branch and a Kraken-unavailable condition, then records the safe final `UNAVAILABLE` result. Neither controlled check creates or estimates candle data.

## Persisted evidence

`providerMonitors` stores the stable monitor configuration, schedule task UID, cadence, last run, and current summary state. `providerMonitorExecutions` is append-only in normal operation and includes an idempotency key to prevent duplicate evidence on platform retries. `providerMonitorChecks` preserves the provider, capability, status, HTTP status when present, classification, latency, timeframe, symbols checked, fallback usage, data quality, control case, freshness result, candle count, normalization version, and expected-unavailable marker.

The dashboard displays the current scanner's source state separately from the scheduled monitor. It identifies Binance as the primary provider, Kraken as the fallback, reports whether the successful controlled 451 check actually used Kraken, and does not present the deliberately unavailable safety branch as an operational failure.

## Current verified Kraken constraints

| Item | Verified state |
| --- | --- |
| Public endpoint | `GET /0/public/OHLC` is documented by Kraken for OHLC market data. [1] |
| Supported scanner intervals | 15m, 1h, 4h, and 1d were read-only checked and are mapped to 15, 60, 240, and 1440 minutes. [1] |
| Current asset mapping | BTC, ETH, SOL, LINK, AVAX, SUI, UNI, AAVE, DOGE, ADA, XRP, and DOT map to approved USD pairs. |
| Historical/freshness scope | The adapter treats Kraken as a recent live fallback only; the documented endpoint returns up to 720 recent entries, and the monitor rejects stale or incomplete series. [1] [2] |
| Request-rate limit | **UNKNOWN at runtime.** The application does not assume a permanent quota; the four-hour monitor uses a small bounded representative request set. |
| Historical replacement | Not supported. Kraken fallback never changes the immutable historical dataset pipeline. |

## Failure behavior

If Binance is healthy, Binance remains the sole provider for a scored multi-timeframe series. If Binance returns 451, Kraken may supply the entire validated series. If Kraken is invalid or unavailable, or if a valid window would mix providers, the outcome is explicitly unavailable. No values are fabricated, forward-filled, or reconstructed.

## References

[1]: https://docs.kraken.com/api-reference/market-data/get-ohlc-data "Kraken Developers — Get OHLC Data"

[2]: https://docs.kraken.com/exchange/guides/general/historical-data "Kraken Developers — Historical Data"
