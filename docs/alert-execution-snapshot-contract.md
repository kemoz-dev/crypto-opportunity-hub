# Alert Execution Snapshot Contract

## Purpose

Every alert evaluation now produces an **immutable point-in-time record**. The record answers one historical-research question only:

> What data, configuration, and analytical state did the engine have when this alert execution ran?

Historical inspection reads the stored execution fields and JSON snapshot directly. It does not invoke the scanner, fetch current market data, recompute indicators, or apply a later scoring configuration.

## Execution Status Semantics

| Outcome | Meaning | Error? | Trade action |
|---|---|---:|---|
| `SUCCESS` | One or more opportunities qualified. | No | None |
| `NO_MATCH` | Evaluation completed but no opportunity met every alert condition. | No | None |
| `SKIPPED` | The alert was disabled or in its cooldown window. | No | None |
| `FAILED` | The evaluator could not complete and stored a sanitized error record. | Yes | None |

`NO_MATCH` is an expected successful research outcome, not a failure. All alert evaluations remain observation-only: they do not create, amend, or close paper trades and have no real-trading action.

## Persisted Point-in-Time Evidence

| Snapshot group | Stored evidence |
|---|---|
| Execution metadata | Execution ID, alert ID/name, manual or scheduled origin, start/completion timestamps, duration, HTTP/result status, scanned asset count, qualifying count, notification state, and sanitized error detail where applicable. |
| Configuration | Full scoring configuration, deterministic SHA-256 fingerprint, and derived configuration version. |
| Market regime | Final score/classification, BTC trend and momentum inputs, dominance, total-market and breadth reasons, source status, freshness, and explicit unavailable values. |
| Sector state | Asset sector/category, sector momentum and rank where calculable, relative strength versus sector and BTC, source/freshness, and explicit unavailable values. |
| Qualifying signals | Asset identity, price and market fields, every score component, setup/direction/risk state, RSI, MACD, EMA 20/50/200, Bollinger values, ATR, volume expansion, price structure, multi-timeframe analyses, regime, sector, derivatives, conditions, configuration, and provider provenance. |

Market-wide volume and volatility regimes are not modeled by the current normalization layer. They are stored as **unavailable** in new execution records rather than estimated from later data. Pre-observability executions are labeled as legacy records, retain only fields that were stored originally, and explicitly mark their unavailable sector and scan-count evidence.

## Observability Schema and Product Surface

The `alertExecutions` table retains its prior execution identity, timing, configuration, matched-opportunity, and error evidence. The observability upgrade adds the following **13 immutable columns**: `outcomeStatus`, `executionKind`, `httpStatus`, `durationMs`, `assetsScanned`, `qualifyingOpportunities`, `configurationVersion`, `configurationFingerprint`, `notificationStatus`, `marketRegimeSnapshot`, `sectorSnapshots`, `signalSnapshots`, and `dataProvenance`.

`AlertExecutionHistory.tsx` renders a per-alert history table and the `ExecutionInspector` detail dialog. `AlertsPanel.tsx` has been rebuilt to embed that history while preserving existing alert-creation and scheduling controls. The protected `crypto.alertExecution` route provides authenticated retrieval of a single stored execution; `crypto.alertExecutions` remains the authenticated list route. Both history routes pass the current user identity to the service, so one user cannot request another user's alert history.

## Recorded Unchanged Alert Boundary

On **2026-08-21**, the active integration-test alert was re-queried after the schema upgrade. Alert ID `1`, **Test Alert — High Opportunity 4H**, remains enabled with the same `80` opportunity, `70` confidence, and `30` technical thresholds; `4h` required timeframe; `requireNotRiskOff=true`; `requireBullishSetup=true`; `notificationEnabled=true`; all-assets scope; and Heartbeat task UID `XAjLtJyHpiUYc2Qd8QFjCU`.

The observability upgrade did not change scoring weights, signal thresholds, cadence, notification behavior, paper-trading behavior, or real-trading behavior. Every alert outcome remains observation-only: no alert execution can create a paper trade or send a real trade. The unchanged hourly schedule therefore remains the same research boundary, while the new records add historical evidence only.

## Historical Inspection Boundary

The execution-history detail dialog is labeled **POINT-IN-TIME SNAPSHOT**. It displays the persisted record only. The product intentionally does not add a current-market comparison panel in this checkpoint, preventing a current price, current regime, or current indicator value from being confused with historical evidence.
