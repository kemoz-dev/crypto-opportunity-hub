# Opportunity Engine Integrity and Security Audit

**Audit date:** 21 August 2026 (GMT+3)  
**Scope:** Existing live scanner, paper-trade capture, historical backtest, alert evaluator, and Research Summary record.

## Result

The reviewed historical decision path now computes indicators only from bars through the completed decision candle, enters at the **next** candle open, and evaluates stop, target, holding, and outcome windows only afterward. This removes the previous same-bar decision/entry ambiguity. The paper-trade entry record retains a deep-cloned live observation with the timestamp, asset, enabled timeframes, opportunity/confidence/technical scores, regime, sector, setup, entry, stop, target, exact positive and negative scoring context, and configuration.

| Area | Audit finding | Status |
|---|---|---|
| Indicators and volume | Input is `candles[0..index]`; no later candle is passed into technical analysis. | **Controlled** |
| Entry price | Entry is the next bar open after the decision bar closes. | **Controlled** |
| Stops, targets, and exits | Evaluated only from the entry bar onward. If one bar crosses both stop and target, the stop is selected conservatively. | **Controlled** |
| Risk sizing and P&L | Equity and Sharpe calculations use risk-sized position return; average R uses the recorded R multiple. | **Controlled** |
| Outcome windows | 24H, 3D, 7D, and 30D returns exist only when subsequent bars are available after entry. | **Controlled** |
| Paper-trade signal record | Entry snapshot is cloned at creation and is not included in the close-trade update. | **Controlled** |
| Alert authorization | Scheduled endpoint accepts only an authenticated cron identity and resolves the alert using its authenticated task UID, not request body data. | **Controlled** |
| Alert configuration basis | Evaluation loads the user’s stored configuration and stores that exact configuration with a triggered snapshot. | **Controlled** |
| Scheduled failure response | Full detail is logged server-side; the callback returns a sanitized code and timestamp rather than its raw exception. | **Controlled** |

## Deliberate Non-Claims

The current historical series does **not** retain point-in-time market-cap, sector-relative-strength, or market-regime inputs. The backtest therefore does not calculate historical relative-strength, regime, or generic-versus-sector-hypothesis evidence. It marks those comparisons **Insufficient Data** rather than reusing present-day values, which would introduce leakage.

The existing public sources are used only through the current CoinGecko market and Binance Futures OHLCV adapters. CoinGecko documents the asset-market field surface used by the platform and Binance documents the futures market-data basis for the OHLCV adapter.[1] [2]

## Production Alert Activation Check

The production site is reachable at the configured project domain. Scheduled alerts cannot be truthfully reported as active until an authenticated user creates an alert after the release containing the callback handler is published. No user-owned alert existed during this audit, so no schedule, schedule execution, or alert trigger was created or fabricated. After publication, a user-created alert will store its schedule task UID; its execution history can then be inspected from the project’s schedule management interface.

## Remaining Limitations and Recommendations

The 1-hour validation used the existing 1,000-candle per-asset limit. The data supports a historical screen but does not provide enough independent history to validate high thresholds, 30-day outcomes for all combinations, regime variation, or sector-hypothesis uplift. The current model should retain historical point-in-time market context and run parallel generic/sector baseline analyses before altering sector weights. Slippage, fees, funding, and liquidity-impact assumptions are also not modeled and should be added before treating risk-sized historical returns as implementation-ready.

## References

[1] [CoinGecko, “Coins markets” API reference](https://docs.coingecko.com/reference/coins-markets)

[2] [Binance Developers, “USDⓈ-M Futures market data” documentation](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-futures/api/rest-api/market-data)
