# Crypto Opportunity Hub — Phase 1 Architecture

## Current Stack

The platform uses **React 19**, **TypeScript**, **Tailwind CSS 4**, **Express**, **tRPC 11**, **Drizzle ORM**, and managed **MySQL**, with authenticated user sessions available through the supplied application framework. The initial milestone is intentionally request-driven rather than continuously polling: a user-requested scan retrieves and evaluates current public data in the server process, while stale and unavailable sources remain visible instead of being replaced with placeholder values.

## Recommended Architecture

The application is organized as a strict, one-way pipeline:

> **Provider adapters → normalizers → analytical engine → explainable score engine → tRPC queries → dashboard and scanner.**

CoinGecko supplies asset-level market context, including price, volume, market capitalization, percentage changes, and freshness timestamps. Its market endpoint documents these fields and supports batched asset-ID retrieval.[1] Binance Futures supplies OHLCV candles for indicator calculations and will supply derivatives context when its public endpoint returns it.[2] Normalized output uses one canonical candle, asset, and data-status shape. The analytical engine only accepts normalized structures, which keeps later provider swaps isolated from score logic.

The Phase 1 opportunity score maintains the requested configurable component weights. **Catalyst / sentiment is explicitly disabled until a verified source is integrated**, and the enabled components are normalized over their active weights rather than silently treating missing data as zero. Multi-timeframe agreement is applied as a bounded consistency adjustment to the weighted technical score, rather than being added as a second copy of the same indicator signals.

## Initial Provider Coverage

| Data class | Initial source | Phase 1 treatment |
|---|---|---|
| Price, market cap, volume, 1h/24h/7d returns | CoinGecko | Fetched in one batched market request and normalized with source timestamps. |
| OHLCV, 15m/1h/4h/1d | Binance Futures | Retrieved per supported symbol and timeframe, then normalized to canonical candles. |
| Funding rate and open interest | Binance Futures | Requested opportunistically and presented as unavailable if the public endpoint fails or restricts access. |
| Sector classification | Versioned application configuration | Used as a transparent classification hypothesis, not an asserted market fact. |
| Sentiment and catalysts | Not enabled in Phase 1 | Omitted transparently; no synthetic narrative or score is created. |

## Data Model

The durable model distinguishes raw and derived observations. Assets and source-status records identify the basis and freshness of incoming data. Market data stores normalized observations. Technical snapshots and score snapshots preserve their inputs, reasons, and outputs at a given timestamp. The data model also reserves immutable paper-trade records, portfolio states, backtest runs and results, alerts, and user settings for the staged capabilities that follow this milestone.

## Phase 1 Delivery Boundary

This milestone implements **Market Data → Technical Engine → Opportunity Score → Scanner** with real values or explicit unavailable states. Paper trading, historical backtesting, scheduled alerts, and richer derivative data remain planned product phases; their data structures and configuration boundary are established now, but they are not represented as working functionality until their integrity constraints are implemented and tested.

## Research and Safety Notes

All scores are explainable research signals, not profit forecasts. The application records source status and timestamp alongside each live scan. Any later backtest will step chronologically and evaluate only data available at each decision point; signals missing a verifiable data cutoff must be rejected rather than backfilled.

## References

[1] [CoinGecko, “Coins markets” API reference](https://docs.coingecko.com/reference/coins-markets)

[2] [Binance Developers, “USDⓈ-M Futures market data” documentation](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-futures/api/rest-api/market-data)
