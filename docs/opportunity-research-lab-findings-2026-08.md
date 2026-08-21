# Opportunity Research Lab Findings

**Prepared:** 21 August 2026 (GMT+3)  
**Protocol:** `OPPORTUNITY_RESEARCH_LAB_V1`  
**Coverage:** 12 configured assets; 1-hour completed candles from 20 June 2026 08:00 UTC through 21 August 2026 20:00 UTC; the first 70% of selected observations are in-sample and the later 30% are out-of-sample.

> **Conclusion:** The available data does **not** demonstrate a robust, repeatable historical edge for the current Opportunity Engine. No production scoring weight, threshold, alert, paper-trading state, or real-trading boundary was changed.

## Basis and Reproducibility

Every result is persisted as a user-owned experiment with its full configuration, SHA-256 fingerprint, UTC timing, source provenance, selected signal snapshots, data range, metric rows, and exportable CSV/JSON representation. The five completed runs are IDs `30001`, `30002`, `30003`, `30005`, and `30006`; two interrupted attempts (`1` and `30004`) remain transparently stored as failed records and were not used as evidence.

The technical-core study uses the existing RSI, MACD, EMA, and volume evidence rules. Experiments D and E add same-time BTC-relative strength and completed higher-timeframe confirmation as **separate research variables**; they are not silently added to production scoring. Direct Binance Futures retrieval was regionally intermittent, so each persisted run records whether individual data pulls used the existing API or Binance’s public completed-candle archive. No paid source, sentiment, on-chain, whale, machine-learning, or fabricated series was used.[1] [2]

| Combination | Variables | Signals at selected 60/60 filter | Aggregate average return | Win rate | Profit factor | Maximum drawdown | Evidence label |
|---|---|---:|---:|---:|---:|---:|---|
| A | RSI + MACD | 973 | 0.04% | 38.34% | 1.08 | 66.58% | Weak Evidence |
| B | A + EMA | 444 | -0.08% | 33.56% | 0.88 | 69.13% | Unsupported |
| C | B + Volume | 293 | 0.00% | 36.52% | 1.00 | 48.54% | Unsupported |
| D | C + relative strength | 129 | 0.00% | 34.11% | 1.00 | 39.50% | Unsupported |
| E | D + completed higher timeframe | 80 | 0.08% | 36.25% | 1.12 | 21.46% | Weak Evidence |

The **highest observed aggregate average return** was E at 0.08%, but its median was -1.00%, win rate was 36.25%, and in-sample performance was negative. The **worst** was B at -0.08%. Neither result is a production candidate.

## Out-of-Sample Robustness

| Combination | In-sample: signals / average return / status | Out-of-sample: signals / average return / status | Interpretation |
|---|---|---|---|
| A | 681 / 0.06% / Weak Evidence | 292 / 0.00% / Unsupported | Small positive in-sample average did not persist meaningfully later. |
| B | 310 / -0.02% / Unsupported | 134 / -0.21% / Unsupported | Adverse on both sides of the chronological split. |
| C | 205 / 0.05% / Weak Evidence | 88 / -0.10% / Unsupported | Earlier positive average reversed later. |
| D | 90 / -0.30% / Unsupported | 39 / 0.69% / Supported | Split results conflict; the later positive subset cannot validate a negative earlier sample. |
| E | 56 / -0.16% / Unsupported | 24 / 0.63% / Insufficient Data | Later sample is too small, and the earlier result is adverse. |

The balanced candidate rule requires adequate sample, a non-negative later-period result, profit factor at least one, and controlled drawdown without contradictory earlier evidence. **No robust winner identified.** The one positive later D subset and the E later subset are observations, not selection evidence.

## Threshold and Calibration Findings

The four opportunity thresholds and three confidence thresholds were fixed before the run. The data do not show the required monotonic relationship that higher score or higher confidence produces uniformly better, more consistent outcomes. For example, in combination A, Opportunity 60+ measured 0.04% average return across 1,400 signals, while 70+ and 80+ measured -0.02% and -0.01%; 90+ had only 20 observations and is insufficient. The selected A confidence 70+ and joint Opportunity 70+/Confidence 70+ rows had the highest adequate-sample observed average return, 0.09% across 483 observations, but had a -1.00% median, 40.17% win rate, 1.16 profit factor, 40.65% maximum drawdown, and a **Weak Evidence** label.

The highest observed adequate-sample opportunity-threshold row was E at 60+ (80 signals, 0.08% average return, 36.25% win rate, 1.12 profit factor), also **Weak Evidence**. It is not valid to call Confidence a probability from these measurements: calibration and monotonicity were not established.

## Segmentation

The lab exposes segmentation but treats it as conditional evidence. For the richest E experiment, the same-time BTC 24-hour proxy labeled 33 Risk On observations as Supported (0.57% average return; 54.55% win rate) and 42 Selective observations as Unsupported (-0.47%; 16.67% win rate). Risk Off had five observations and is insufficient. These are **not** reconstructions of the production market-regime model.

| E-sector segment | Signals | Average return | Evidence label | Interpretation |
|---|---:|---:|---|---|
| L1 | 32 | 0.50% | Supported | Mechanical segment label only; aggregate E remains weak and later E data are insufficient. |
| Oracles | 21 | 0.04% | Insufficient Data | Below the 30-observation rule. |
| DeFi | 18 | -0.93% | Insufficient Data | Below the 30-observation rule. |
| Large Cap | 6 | 1.00% | Insufficient Data | Below the 30-observation rule. |
| Meme | 2 | -1.00% | Insufficient Data | Below the 30-observation rule. |
| Infrastructure | 1 | 2.00% | Insufficient Data | Below the 30-observation rule. |

RWA, DePIN, Gaming, L2, and additional requested sector classes have no represented configured asset history in this study. They are **unavailable**, not negative evidence. Static configured sector names also are not asserted to be point-in-time historical classifications.

## Anti-Look-Ahead Audit

| Input or rule | Control | Result |
|---|---|---|
| OHLCV and indicators | Technical analysis receives candles ending at the decision close only. | Controlled. |
| Entry | The next available bar open is used; the decision-close price is not an entry. | Controlled. |
| Stops, targets, and horizons | Evaluated only from the entry bar onward; stop wins a same-bar stop/target collision. | Controlled and conservative. |
| Relative strength | Asset and BTC trailing 24-hour returns end at the same decision timestamp. | Controlled research feature. |
| Multi-timeframe | Only higher-timeframe candles with close at or before the lower-timeframe decision are used. | Controlled. |
| Market regime | Same-time BTC OHLCV proxy is labeled separately; present-day production regime is not applied retrospectively. | Controlled but not a production-regime reconstruction. |
| Sector and market-cap | Static taxonomy only; no later market cap, live CoinGecko context, or classification revision is injected. | Explicit coverage limitation. |
| Split | Ordered 70/30 time split; no random shuffling. | Controlled. |

## Data and Survivorship Limitations

The roughly two-month OHLCV coverage is short and contains no fees, slippage, funding, liquidity impact, delisted assets, or historical market-cap series. The configured 12-asset universe may carry survivorship bias because it is based on assets currently configured by the product. Maximum drawdown is a chronological equal-risk observation series rather than a capital-constrained portfolio simulation. These constraints, together with contradictory time-split results and low median outcomes, prevent a claim of predictive power.

## Decision

**No V2 scoring change is justified by this checkpoint.** The appropriate next research step is longer retained point-in-time data with fees, slippage, funding, historical sector/regime snapshots, and a predeclared validation horizon. The current engine remains unchanged and the lab remains research-only.

## References

[1] [Binance Developers, “USDⓈ-M Futures market data”](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-futures/api/rest-api/market-data)  
[2] [Binance, “Public Data Archive”](https://data.binance.vision/)

*This is research and analysis only, not personalized financial advice.*
