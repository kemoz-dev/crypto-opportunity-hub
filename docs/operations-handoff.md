# Crypto Opportunity Hub — Phase 1 Operations Handoff

## Delivered Milestone

Phase 1 delivers the first verified product path:

> **Public market data → normalized observations → technical analysis → explainable opportunity score → ranked scanner.**

The application is an analytical research tool. Opportunity and confidence scores describe the configured signals and quality of the available inputs; they are **not** forecasts, investment recommendations, or automated-trading instructions.

## Development and Verification

Run the following commands from the project root when developing or validating the service.

| Objective | Command | Expected outcome |
|---|---|---|
| Start the development service | `pnpm dev` | Runs the React, Express, and tRPC application. |
| Validate TypeScript | `pnpm check` | Finishes without type errors. |
| Run unit tests | `pnpm test` | Verifies the technical and scoring engines, along with the supplied authentication test. |
| Generate schema migration after a model change | `pnpm drizzle-kit generate` | Creates a migration that must be reviewed before applying. |
| Build the deployable bundle | `pnpm build` | Produces the frontend and server bundle. |

The current automated suite covers deterministic indicator behavior, explainable scoring output, missing-timeframe handling, and session logout. Before implementing paper trades and historical backtests, add tests for immutable trade entry snapshots and chronological data-cutoff enforcement; those protections must be present before those features can be marked complete.

## Live-Data Operation

Each scanner query requests the configured asset universe from CoinGecko and retrieves Binance Futures candles for the active 15m, 1h, 4h, and 1d timeframes. CoinGecko's markets endpoint exposes the market price, market-cap, volume, return, and update-time fields used in the scanner.[1] Binance's USDⓈ-M Futures market-data documentation is the basis for the OHLCV and derivatives adapter layer.[2]

Public sources can rate-limit, fail, change coverage, or be unavailable in a given deployment region. The system deliberately surfaces an **Unavailable** status for a failed provider, missing candles, or unavailable derivative input. It does not fill a missing provider response with a synthetic price, score, funding rate, open-interest value, or market-regime classification. A completed scan is cached in process for 60 seconds only; the database remains the durable snapshot record.

## Snapshot and Persistence Checks

The `assets`, `marketData`, `technicalSnapshots`, `scoreSnapshots`, and `dataSources` tables provide the audit trail for each successful scan. `marketData` stores normalized source-level observations, while `technicalSnapshots` and `scoreSnapshots` store the derived analysis, score reasons, data status, and timestamp. This separation permits users to inspect why a score was produced rather than relying on a derived number alone.

After opening the scanner and waiting for the live query, the following query should return non-zero counts for the active record types:

```sql
SELECT
  (SELECT COUNT(*) FROM assets) AS asset_count,
  (SELECT COUNT(*) FROM marketData) AS market_observation_count,
  (SELECT COUNT(*) FROM technicalSnapshots) AS technical_snapshot_count,
  (SELECT COUNT(*) FROM scoreSnapshots) AS score_snapshot_count,
  (SELECT COUNT(*) FROM dataSources) AS source_status_count;
```

If a provider has failed, verify the related row in `dataSources` and the visible scanner status before changing scoring behavior. A missing data point should remain missing, not be inferred from the prior snapshot.

## Score Interpretation

The default configuration preserves the requested initial component weights: technical analysis (40), market momentum (20), sector relative strength (15), catalyst/sentiment (10), and liquidity/risk (15). Phase 1 does **not** activate the catalyst/sentiment component, because it does not yet have a verified source. The engine re-normalizes the active components instead of treating absent sentiment as a negative input.

The multi-timeframe engine gives every enabled timeframe one bounded contribution and uses agreement only as a bounded adjustment. This avoids awarding the same RSI, MACD, or EMA condition repeatedly merely because it appears in several timeframes. The detail card displays its individual score reasons, per-timeframe results, current data basis, and missing conditions.

## Phase 2+ Boundary

| Capability | Current state | Required integrity condition before release |
|---|---|---|
| Centralized settings editor | Planned; defaults are versioned and persisted with score snapshots. | Per-user authenticated configuration validation and audit versioning. |
| Paper trading lab and portfolio analytics | Planned; schema is in place. | Trade-entry snapshot must be immutable, and P/L must use recorded trade data rather than re-scored signals. |
| Historical backtesting and score research | Planned; schema is in place. | Step through chronological candles only, reject data without a verifiable cut-off, and prohibit future data from any historical signal. |
| Alerts | Planned; schema is in place. | Threshold evaluation must carry the exact signal snapshot, source status, score reasons, and timestamp into every alert. |
| Sentiment, on-chain, and advanced derivatives | Deferred. | Add a provider adapter, normalizer, documented coverage, and explicit data-quality status before affecting scores. |

Scheduled alerting is not enabled in this milestone. When it is introduced, it should run as deterministic background work with a user-managed configuration; the service must not rely on a browser tab or a fabricated in-memory portfolio state.

## Release Checklist

Before saving a release checkpoint, run the TypeScript check and test suite, open the scanner at desktop and mobile widths, and confirm that a completed live scan has real timestamps, source-status records, and no placeholder market values. Review the task tracker to ensure only completed work is marked complete. Once a checkpoint is created, publish from the project interface when the user is ready.

## References

[1] [CoinGecko, “Coins markets” API reference](https://docs.coingecko.com/reference/coins-markets)

[2] [Binance Developers, “USDⓈ-M Futures market data” documentation](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-futures/api/rest-api/market-data)
