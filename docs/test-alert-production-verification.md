# Test Alert — High Opportunity 4H: Production Verification

**Test purpose:** Authenticated integration test only. The rule does not create paper trades or real trades, and it does not modify the scoring model.

## Authorized Rule Persisted

The account selection and rule submission were completed only after the user explicitly confirmed in this task that the recognized account could be selected and that the assistant could proceed. The resulting alert is persisted under that authenticated user’s application account and was created through the normal production form and user-scoped schedule mutation.

| Attribute | Persisted value |
|---|---|
| Name | Test Alert — High Opportunity 4H |
| Opportunity threshold | ≥80 |
| Confidence threshold | ≥70 |
| Technical threshold | ≥30/40 |
| Regime condition | Not Risk Off |
| Asset and sector scope | All supported assets; no sector filter |
| Timeframe condition | Bullish 4H contribution required |
| Setup condition | Bullish setup required |
| Schedule | `0 0 * * * *` — hourly, UTC |
| Notifications | Enabled; owner-facing only if a match occurs |
| Paper / real trading | Not supported by the alert action; no trade action exists |

The rule persisted enabled at **2026-08-21 17:15:33 UTC** with a platform-managed schedule identity. The project Heartbeat registry confirmed an enabled `POST /api/scheduled/evaluate-alert` job with the same hourly expression.

## Failure-Log Boundary

No production failure was intentionally induced for this integration test. Doing so would require deliberately breaking the active user-owned alert flow or forcing a malformed scheduled callback, neither of which was necessary to prove the requested success path and neither was authorized as part of this no-trade test.

The deployed callback's failure behavior was code-audited: unauthenticated calls return only the generic `cron-only` 403 response, while unexpected evaluator failures are logged server-side and return a sanitized 500 response with the stable `ALERT_EVALUATION_FAILED` code, task identity, and timestamp—without a stack trace, source payload, scoring configuration, or secret. The successful execution log and the post-execution HTTP 403 check provide production evidence for the success and unauthorized-access paths; the failed-run path is **code-audited, not production-exercised**.

## First Scheduled Execution

| Check | Observed result |
|---|---|
| Platform schedule status | Success (HTTP 200) |
| Platform scheduled timestamp | 2026-08-21 18:05:26 UTC |
| Application execution window | 2026-08-21 18:05:29–18:05:30 UTC |
| Callback duration | 3,346 ms |
| Recorded execution status | Completed |
| Outcome | `threshold-not-met` |
| Matched assets / signals | None; zero qualifying rows, therefore no match snapshot was created |
| Notification delivery | Not dispatched because no asset qualified |
| Paper-trade creation | Zero user paper trades before and after execution |
| Real-trade action | None; the alert workflow has no real-trade action |
| User settings change | None; no user-settings row was created or updated |
| Unauthenticated callback | Rejected after execution with HTTP 403 |

The execution snapshot stored the exact scoring configuration used at the decision time. Its SHA-256 fingerprint was `397a9c77cd5162908138a3b4a476a2b6986a6fb8d947ff8f20c9dc599914eb22`, providing an auditable reference without exposing settings content in the report.

## Interpretation

> The first hourly run was successful as an integration test. It correctly evaluated the published score configuration and live data, found no qualifying opportunity under the deliberately strict 80/70/30 + Risk-On + bullish-4H + bullish-setup rule, recorded the non-match execution, and left trades and settings untouched.

The absence of a match is a valid test outcome. It does not imply that the schedule, notification path, or evidence recording failed; notifications are intentionally contingent on a qualifying match. Future hourly executions remain enabled and will record the same immutable condition/configuration context for every run.
