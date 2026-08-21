# Opportunity Engine Validation Report

**Prepared:** 21 August 2026 (GMT+3)  
**Data cutoff:** 21 August 2026, 15:36:13 UTC  
**Data basis:** Existing Binance Futures 1-hour OHLCV adapter across the 12 configured assets; up to 1,000 candles per asset. CoinGecko remains the existing live market-context source, while the historical validation uses the existing Binance OHLCV adapter.[1] [2]

> **Research scope.** This report evaluates the existing technical engine and its historical execution assumptions. It does not make a prediction, promise an investment outcome, or evaluate any newly added sentiment, on-chain, whale-tracking, or paid data source.

## Tested Scope

| Test | Basis | Result |
|---|---|---|
| Live paper-trade observation readiness | Existing paper-trade entry flow; database inspection | Snapshot was expanded and tested. No user-owned trade existed, so no live paper-trade result is claimed. |
| Historical signal scan | 12 configured assets, 1-hour candles, next-bar entry, 24 holding bars, 1% risk size | **793** historical signals were generated. |
| Score combinations | A–E requested combinations | A–C calculated; D–E marked Insufficient Data because relative-strength history is not retained point-in-time. |
| Thresholds | Opportunity 60/70/80/90; Confidence 60/70/80; joint 80/70 | Calculated and status-labeled using the declared 30-observation minimum. |
| Outcome windows | 24H, 3D, 7D, 30D post-entry returns | Shown only when the required post-entry candles existed. |
| Sector and regime evidence | Generic baseline versus sector hypothesis; historical regimes | **Insufficient Data**. Existing historical series does not retain the required point-in-time inputs. |
| Anti-look-ahead control | Code and test audit | Next-bar entry and post-entry exits/outcomes are enforced. |
| Scheduled-alert boundary | Unauthenticated local callback check | HTTP 403 `cron-only`; no evaluator call, stack trace, configuration, or secret returned. |

## Combination Evidence

All return figures below are **risk-sized average account returns** under the declared test configuration. They are historical measurements, not a basis for optimization or a future-return guarantee.

| Combination | Observations | Win rate | Average return | Average R | Profit factor | 24H / 3D / 7D / 30D average outcome | Evidence status |
|---|---:|---:|---:|---:|---:|---|---|
| A — RSI + MACD | 576 | 31.25% | 0.37% | 0.37 | 1.57 | 0.49% / 0.69% / 0.08% / 1.69% | Weak Evidence |
| B — RSI + MACD + EMA | 87 | 35.63% | 1.12% | 1.12 | 2.81 | 0.95% / -0.68% / -2.63% / 5.97% | Weak Evidence |
| C — RSI + MACD + EMA + Volume | 51 | 35.29% | 1.24% | 1.24 | 2.92 | 1.14% / -0.20% / -1.32% / 2.52% | Weak Evidence |
| D — C + Relative Strength | 0 | — | — | — | — | — | Insufficient Data |
| E — D + Multi-Timeframe | 0 | — | — | — | — | — | Insufficient Data |

The highest observed combination average was **C**, but it remains **Weak Evidence**: the sample is only 51 signals, the win rate is below 50%, and the 3D and 7D post-entry averages were negative. The lowest observed measured combination was **A** at 0.37% with 576 observations. No combination is classified as Supported.

## Threshold Evidence

| Filter | Observations | Win rate | Average return | Profit factor | Maximum drawdown | Evidence status |
|---|---:|---:|---:|---:|---:|---|
| Opportunity ≥60 | 793 | 32.16% | 0.47% | 1.73 | 33.41% | Weak Evidence |
| Opportunity ≥70 | 411 | 31.14% | 0.53% | 1.82 | 28.86% | Weak Evidence |
| Opportunity ≥80 | 75 | 34.67% | 1.05% | 2.64 | 18.21% | Weak Evidence |
| Opportunity ≥90 | 4 | 50.00% | 4.22% | 9.45 | 1.99% | Insufficient Data |
| Confidence ≥60 | 476 | 34.87% | 0.65% | 2.05 | 26.97% | Weak Evidence |
| Confidence ≥70 | 167 | 31.14% | 0.72% | 2.08 | 18.22% | Weak Evidence |
| Confidence ≥80 | 4 | 50.00% | 4.22% | 9.45 | 1.99% | Insufficient Data |
| Opportunity ≥80 and Confidence ≥70 | 66 | 37.88% | 1.04% | 2.68 | 13.99% | Weak Evidence |

**Best observed Opportunity threshold:** 80+ (75 observations; 1.05% average return), but it remains Weak Evidence. **Best observed Confidence threshold with at least 30 observations:** 70+ (167 observations; 0.72% average return), also Weak Evidence. The high-90 and high-80 confidence figures have four observations and are correctly classified as insufficient rather than selected.

## Sector, Regime, and Paper-Trade Evidence

| Area | Result | Why |
|---|---|---|
| Large Cap | Insufficient Data | 133 historical signals exist, but no point-in-time generic baseline and sector-series comparison is retained. |
| L1 | Insufficient Data | 327 historical signals exist, but the required historical sector inputs are absent. |
| Oracles | Insufficient Data | 71 signals; no parallel baseline evidence. |
| DeFi | Insufficient Data | 132 signals; no parallel baseline evidence. |
| Meme | Insufficient Data | 66 signals; no parallel baseline evidence. |
| Infrastructure | Insufficient Data | 64 signals; no parallel baseline evidence. |
| Market regimes | Insufficient Data | Current regime values cannot be applied to past decisions without leakage. |
| Real paper-trade observations | Not yet available | The database contained zero user-created paper trades; none were fabricated. |

## Anti-Look-Ahead Audit Result

The audit result is **controlled, with explicit remaining data limitations**. Technical indicators and volume use only the decision-time candle history. The entry is the following bar’s open. Stop, target, holding, and 24H/3D/7D/30D outcome evaluation use later bars only; a bar that touches both target and stop resolves to the stop conservatively. Paper-trade evidence and alert matches retain immutable snapshot context. Scheduled alert requests require a cron identity and task UID; unauthenticated requests received HTTP 403.

The historical backtest deliberately does not claim point-in-time market-cap, relative strength, sector-model uplift, or regime effects because those series are not retained. This is a current **coverage limitation**, not evidence that the effects are absent.

## Weaknesses and Recommendations

The observed results are sensitive to a limited one-hour data window, a 1,000-candle cap, no fees or slippage, and no funding or liquidity-impact treatment. Median returns were negative in the reported combinations despite positive average returns, which argues against selecting a threshold or combination for future use now.

The recommended next changes are to retain **point-in-time** market context, sector-relative-strength, and regime records with each historical decision; run generic and sector-specific configurations in parallel on identical historical data; add fees, slippage, funding, and realistic fill assumptions; and gather a real user-owned paper-trade observation set before changing weights. These changes should be evaluated in a subsequent validation checkpoint, not silently added to the current score.

## References

[1] [CoinGecko, “Coins markets” API reference](https://docs.coingecko.com/reference/coins-markets)

[2] [Binance Developers, “USDⓈ-M Futures market data” documentation](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-futures/api/rest-api/market-data)

*This is research and analysis only, not personalized financial advice.*
