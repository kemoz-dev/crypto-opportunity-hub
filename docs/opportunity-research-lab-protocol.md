# Opportunity Research Lab Protocol

## Research Question and Boundary

This lab asks a strictly historical question: **when the existing technical opportunity logic produced a qualifying decision using only information available at time T, what were the measured outcomes after entry?** A research run is an observation workflow, not a production-model optimizer. It cannot alter the active scoring configuration, alert thresholds, alert schedule, paper-trading state, or real-trading boundary.

The current production formula remains unchanged: technical 40%, momentum 20%, sector 15%, catalyst 10% (disabled), and risk/liquidity 15%. Historical OHLCV covers the technical core but does not retain every point-in-time production input, particularly historical market-cap snapshots, full market regime inputs, and production sector-model state. Consequently, the lab labels its results **technical-core historical research**, not a retrospective claim that every production component was reconstructible.

## Controlled Experiment Definitions

| Experiment | Required decision-time evidence | Interpretation |
|---|---|---|
| A | Positive RSI and MACD evidence | Existing technical indicator subset. |
| B | A plus positive EMA evidence | Existing technical trend confirmation subset. |
| C | B plus positive volume evidence | Existing technical and volume confirmation subset. |
| D | C plus cross-sectional relative strength against BTC, calculated only from same-time OHLCV history | Separate experimental feature; not silently added to production scoring. |
| E | D plus aligned higher-timeframe confirmation whose completed close is at or before T | Separate multi-timeframe experimental feature; not silently added to production scoring. |

The selected experiment, opportunity threshold (60/70/80/90), confidence threshold (60/70/80), asset universe, timeframe, date range, sector filter, regime filter, entry/exit rules, time split, scoring-configuration fingerprint, and provider provenance are persisted with every run. The only predefined joint threshold pairs are 70/70, 80/70, 80/80, and 90/80; the interface does not brute-force arbitrary grids.

## Chronological and Anti-Look-Ahead Controls

At decision time **T**, indicators use candles with a completed close at or before T. The trade entry is the next available bar open, never the signal bar close. Stop, target, holding exit, and 24H/3D/7D/30D outcome windows begin after entry. When a future bar reaches both stop and target, the stop is applied first as the conservative result.

Relative strength uses only trailing returns ending at T. Higher-timeframe confirmation uses only fully completed higher-timeframe candles with close time at or before T; incomplete higher-timeframe bars are excluded. Market regime and sector segmentation are calculated only when their relevant point-in-time series is retained or derived from same-time OHLCV. Historical market-cap, live CoinGecko context, future classifications, and present-day market conditions are never injected into a historical decision.

## Measured Output and Evidence Labels

For each eligible result set, the lab stores signal count, win rate, average and median return, positive-return percentage, average R, expectancy, profit factor, maximum drawdown, best and worst outcome, and Sharpe/Sortino only when sample variance and the sample-size guard permit them. The outcome horizons report only observations with enough subsequent candles.

| Evidence label | Rule |
|---|---|
| **SUPPORTED** | At least 30 observations, positive average return, at least 50% win rate, and non-negative out-of-sample result when the time split has sufficient observations. |
| **WEAK EVIDENCE** | At least 30 observations with a directional positive result, but inconsistent performance, weak out-of-sample support, or limited segment coverage. |
| **UNSUPPORTED** | At least 30 observations but no positive-return and win-rate support under the declared rule. |
| **INSUFFICIENT DATA** | Fewer than 30 observations, unavailable point-in-time inputs, or no usable forward outcome window. |

Score and confidence calibration use fixed buckets (60–69, 70–79, 80–89, 90–100). The lab reports monotonicity as measured; it never adjusts thresholds to manufacture it. Regime and sector summaries use the same evidence labels and show `INSUFFICIENT DATA` when coverage cannot support a non-leaky result.

## Robustness and Reproducibility

Runs use an ordered, time-based training/validation split; time-series observations are never shuffled. The earlier segment is marked **in-sample** and the later segment **out-of-sample**. A current best candidate must satisfy the balanced selection rule: sufficient sample, non-negative out-of-sample performance, controlled drawdown, positive expectancy/profit factor, and non-contradictory available segment results. Otherwise, the lab reports **No robust winner identified**.

Every persisted run includes its experiment ID, UTC timestamps, source/date coverage, exact configuration and indicator parameters, component membership, entry/exit definition, time split, provenance, full result snapshot, and explicit data limitations. CSV and JSON export contain the same configuration and measured result snapshot. Results are research evidence only and do not cause automatic model changes.
