# Expanded Historical Market Universe Coverage Report

**Author:** Manus AI  
**As of:** 2026-08-22 UTC  
**Primary immutable dataset:** `300001` / `DATASET-2026-08-22-004`  
**Purpose:** Historical market-universe infrastructure expansion only. This report does not present a trading recommendation or a model-optimization result.

## Executive Summary

The historical data foundation has been expanded from the earlier narrow baseline into a persistent **20-asset**, **12-registry-sector** representative market universe. The registry is a fixed, source-supported catalog with tier and inclusion-reason provenance; it is not a historical market-cap ranking or a reconstructed historical constituent list. The immutable snapshot for dataset `300001` contains all 20 catalog assets and is explicitly labeled **CURRENT SURVIVOR UNIVERSE**.

The stored 15-minute universe now contains BTC, ETH, and SOL, each with 35,040 observed perpetual candles across the requested 2025-08-01 to 2026-08-01 UTC window. The 1-hour universe contains 20 selected scopes: 19 source-available assets have 8,760 observed candles each with no stored gaps, while PEPE is explicitly retained as **MISSING** rather than filled or substituted. The database contains **302,220** raw historical candles across all retained scopes, from 2025-08-01 00:00:00 UTC through 2026-07-31 23:59:59.999 UTC.

> **Boundary statement:** The Opportunity Engine formula, Confidence formula, technical indicators, regime logic, sector scoring, alert thresholds, alert schedule, paper trading, real-trading prohibition, and Research Lab conclusions were not changed. No Research Lab experiment was rerun.

## Universe Composition

The registry persists identity, exchange and CoinGecko identifiers, tier, inclusion reason, registry taxonomy, observed-date status, source provenance, and data-quality status. The 20 assets cover the following registry taxonomy. These labels are catalog metadata only and must not be read as point-in-time historical sector membership.

| Registry taxonomy | Asset count | Representative assets |
| --- | ---: | --- |
| Large Cap | 2 | BTC, ETH |
| L1 | 4 | BNB, SOL, ADA, AVAX |
| Payments | 1 | XRP |
| Oracle | 1 | LINK |
| Infrastructure | 2 | DOT, FIL |
| L2 | 2 | ARB, OP |
| DeFi | 2 | AAVE, UNI |
| AI | 1 | RENDER |
| RWA | 1 | ONDO |
| DePIN | 1 | GRT |
| Gaming | 1 | AXS |
| Meme | 2 | DOGE, PEPE |

| Tier | Role | Included assets |
| --- | --- | --- |
| Tier 1 | Liquid reference | BTC, ETH |
| Tier 2 | Liquid majors | BNB, SOL, XRP, ADA, AVAX, LINK, DOT |
| Tier 3 | Representative sectors | ARB, OP, AAVE, UNI, RENDER, ONDO, GRT, AXS, FIL |
| Tier 4 | Higher-volatility comparison | DOGE, PEPE |

## Immutable Dataset and Coverage Lineage

Dataset `300001` now has one immutable universe snapshot (`60001`) with 20 member records. Quality values were recomputed from persisted candle and gap evidence before the registry was refreshed and the snapshot was written. This sequence ensures that the snapshot reflects retained data evidence rather than a current provider response.

| Evidence item | Persisted result |
| --- | ---: |
| Registry assets | 20 |
| Snapshot members for dataset `300001` | 20 |
| Assets with observed OHLCV | 19 |
| Explicitly missing OHLCV asset | 1 (PEPE) |
| Registry assets with available historical market-cap observations | 5 |
| Registry assets with missing historical market-cap observations | 15 |
| Dataset quality scopes rated High | 33 |
| Dataset quality scopes rated Medium | 1 |
| Dataset quality scopes rated Unavailable | 1 |

## 15-Minute and 1-Hour OHLCV Coverage

All values below are persisted perpetual OHLCV counts from the selected dataset’s quality records. The requested archive window is **2025-08-01 00:00:00 UTC** to **2026-08-01 00:00:00 UTC**. The latest completed candle is therefore 2026-07-31 23:59:59.999 UTC. The bounded end date intentionally avoids representing unavailable ongoing-month source data as complete.

| Timeframe | Selected scopes | Expected candles | Observed candles | Weighted coverage | Largest stored gap | UTC coverage |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| 15M | 3 | 105,120 | 105,120 | 100.0000% | 0 ms | 2025-08-01 to 2026-08-01 |
| 1H | 20 | 166,440 | 166,440 | 100.0000% across positive-expectation scopes | 0 ms | 2025-08-01 to 2026-08-01 |

| Coverage group | Assets | Per-asset observed / expected | Stored gap result | Quality note |
| --- | --- | --- | --- | --- |
| 15M completed coverage | BTC, ETH, SOL | 35,040 / 35,040 each | 0 ms | BTC is stale relative to the current ingestion timestamp; ETH and SOL are High quality. |
| 1H completed coverage | BTC, ETH, BNB, SOL, XRP, ADA, AVAX, LINK, DOT, AAVE, ARB, AXS, DOGE, FIL, ONDO, OP, RENDER, GRT, UNI | 8,760 / 8,760 each | 0 ms | High quality for source-available completed scopes. |
| 1H explicit missing coverage | PEPE | 0 / 0 in the persisted source-return basis | Not interpolated | Unavailable quality; retained as explicit source absence. |

The quality score is a data-governance measure only: coverage contributes up to 45 points, continuity up to 25, freshness up to 15, integrity up to 10, and provider outcome up to 5. It is not an input to Opportunity Score, Confidence Score, alerts, or trading behavior.

## Provider and Historical-Context Limitations

Binance’s public archive documents daily and monthly kline files for Spot and USD-M Futures, including 15M, 1H, 4H, and 1D intervals. Monthly files can lag the active month; the ingestion provider now retries recently missing monthly coverage through the corresponding bounded daily archive path and retains explicit unavailable-day evidence when neither source file exists. Spot archive timestamps from 2025 may use microseconds and are normalized before persistence. [1]

CoinGecko historical coin data is used only when it returns dated market-cap observations. It documents dated price, market-cap, and volume snapshots, but no point-in-time sector classification history. [2] The current categories endpoint is unsuitable for reconstructing dated asset membership because it is current-state oriented, refreshes on a short cadence, and does not document historical composition. [3]

> **HISTORICAL SECTOR DATA UNAVAILABLE:** The registry’s taxonomy is retained to explain universe design and coverage. It is never substituted for historical sector membership, historical sector rank, or historical sector momentum.

> **CURRENT SURVIVOR UNIVERSE:** The 20-asset catalog is intentionally selected from presently source-supported candidates. It does not establish that these were all market constituents in the historical window, and it does not represent delisted or inactive assets that are unavailable through the selected public-source process.

## Scheduled Incremental Ingestion

Four durable, project-level ingestion records exist. All use the deployed cron-only callback route, resolve schedule ownership by platform task UID, persist status and lineage, and use a four-day bounded lookback. The existing hourly opportunity-alert task remains separate and unchanged.

| Schedule | Task UID | UTC cron | Current status | Notes |
| --- | --- | --- | --- | --- |
| BTC 15M | `husmdYLAyPNF9BEygYHsGx` | `0 12 2 * * *` | SUCCESS at 2026-08-22 02:14:59 | Dataset `210001`; original observed execution. |
| ETH + SOL 15M | `joNJFMck3fFT77bTCLbSby` | `0 32 2 * * *` | Not yet executed | Bound to the deployed ingestion callback. |
| Liquid majors 1H | `K8bZtgkDqZt2QYVLeb4H7N` | `0 52 2 * * *` | Not yet executed | ETH, BNB, SOL, XRP, ADA, AVAX, LINK, DOT. |
| Representative sectors 1H | `cPdv4RbsdgA32H7oLGgRVq` | `0 12 3 * * *` | Not yet executed | ARB, OP, AAVE, UNI, RENDER, ONDO, GRT, AXS, FIL, DOGE, PEPE. |

Each asset/timeframe is isolated inside its batch. A provider error or unavailable symbol produces a recorded partial result for that scope and does not discard independently completed assets.

## Protected Coverage Interface

The authenticated Historical Data workspace now exposes a **Market Coverage Matrix**. It displays asset and inclusion reason; tier and registry taxonomy; availability for 15M, 1H, 4H, 1D, market cap, regime, and historical sector; observed/expected candles; coverage percentage; longest gap; quality score/rating; and latest observed timestamp. The interface prominently repeats the current-survivor and historical-sector-unavailable disclosures.

The dialog itself rendered in the browser. The browser session did not hold an authenticated project session at the time of the populated-matrix verification attempt, and therefore correctly displayed the sign-in guard rather than protected data. This is recorded in `docs/market-coverage-matrix-visual-verification.md`; a signed-in visual check remains the final manual verification step.

## Validation and Non-Mutation Evidence

| Validation | Result |
| --- | --- |
| Provider daily fallback tests | Passed: 5 tests, including futures daily fallback, old-range bound, unavailable-day reporting, and Spot microsecond normalization. |
| Market-universe service tests | Passed: 6 tests, including registry upsert, inclusion filtering, quality scoring, registry refresh, PEPE missing evidence, and snapshot immutability. |
| Tiered schedule tests | Passed: 2 tests, including exact task UID configuration and four-day lookback propagation. |
| Multi-asset partial-failure test | Passed: 1 test. |
| Protected route and no-mutation tests | Passed: 3 tests, including unauthenticated rejection and no alert/settings/paper-trade mutation. |
| Full test suite | **73 / 73 passed**. |
| TypeScript | `pnpm check` passed. |
| Production build | `pnpm build` passed. |

The test suite demonstrates that coverage retrieval is read-only and does not create alerts, change scoring settings, create or close paper trades, or introduce real trading.

## Stop Condition

This checkpoint stops after data-universe expansion, auditable coverage exposure, and validation. It does not automatically initiate a new Research Lab run, score optimization, alert change, paper-trade action, or real-trading action.

## References

[1] [Binance Public Data archive documentation](https://github.com/binance/binance-public-data)

[2] [CoinGecko historical coin data by ID documentation](https://docs.coingecko.com/reference/coins-id-history)

[3] [CoinGecko categories-list documentation](https://docs.coingecko.com/reference/categories-list)
