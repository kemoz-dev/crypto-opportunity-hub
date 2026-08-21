# Project TODO

- [x] Validate the React, Express, tRPC, Drizzle, and MySQL foundation and document the Phase 1 architecture.
- [x] Create configurable database entities for assets, normalized market snapshots, technical snapshots, score snapshots, sector classifications, data-source status, user preferences, immutable paper trades, portfolios, backtest runs, backtest results, and alerts.
- [x] Implement a provider-neutral market-data layer with CoinGecko and Binance adapters, normalization, timestamps, source status, and graceful unavailable-data handling.
- [x] Implement technical calculations for RSI, MACD, EMA 20/50/200, Bollinger Bands, ATR, volume expansion, and price-structure signals across 15m, 1H, 4H, and 1D.
- [x] Implement explainable multi-timeframe, market-regime, liquidity/risk, sector-relative-strength, opportunity, and confidence scoring with configurable weights.
- [x] Build the Phase 1 dashboard and scanner with real-data states, filters, explainable ranked results, per-timeframe contributions, and an opportunity-detail view.
- [ ] Build centralized settings for score weights, indicator inputs, active timeframes, risk limits, paper capital, and sector-model configuration.
- [ ] Build the paper-trading lab and portfolio metrics with immutable entry snapshots.
- [ ] Build the anti-look-ahead historical backtesting engine and score-research analytics.
- [ ] Build explainable threshold alerts with monitored-score conditions and timestamped signal context.
- [ ] Add Vitest coverage for data normalization, technical calculations, score explanations, immutable trades, and anti-look-ahead backtesting constraints.
- [x] Verify data integrity, type safety, and responsive dashboard rendering with no fabricated market values.
- [x] Document the implementation, remaining staged features, data-source limitations, and deployment handoff.
- [x] Complete missing technical detections: RSI recovery/divergence, MACD divergence/context, EMA crossover, Bollinger squeeze/rejection, and the specified price-action structures.
- [x] Add a deployment and operations handoff covering development commands, live-data behavior, persistence checks, verification steps, and Phase 2+ boundaries.
