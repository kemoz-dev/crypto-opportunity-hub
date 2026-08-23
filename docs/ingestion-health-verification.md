# Ingestion Health Verification

The first development-browser inspection after the observability update confirmed that the Historical Data dialog remains available and retains its explicit protected-data unavailable state while a restarted development session settles its authenticated queries. This is not recorded as an ingestion failure or a successful schedule run. A subsequent authenticated check is required to verify the populated Ingestion Health and Research Dataset Readiness sections.

The three expanded production schedules were inspected before implementation. They are enabled, target `/api/scheduled/ingest-historical-data`, and have no execution logs yet because they were created after their daily UTC windows. Their first ordinary production cadence remains pending; no run was fabricated or triggered through an unauthenticated route.

The protected health API returned HTTP 200 with zero persisted expanded-schedule executions, zero unresolved issues, and the stored historical coverage basis. Readiness was adjusted so this state is **ACCUMULATING**, not ready for review: an actual successful or partial scheduled incremental execution is now required in addition to coverage, continuity, and regime evidence. This remains informational only and cannot start Research Lab.

The checkpointed production domain served the Historical Data shell immediately after publication. A direct authenticated request for the newly added `historicalIngestionHealth` procedure initially returned HTTP 404 during deployment propagation. A subsequent cache-busted request returned HTTP 200 and the protected schedule payload, including the three expanded schedule records. This is not a failed ingestion execution; no expanded schedule task has yet run through the new callback.

After the pre-first-run enhancement, the published `historicalIngestionHealth` procedure again returned HTTP 200. A manual coverage request without the required selected-dataset object returned the expected request-validation error and is not evidence of missing production coverage. The protected user interface must select its sealed dataset before querying that endpoint.

A subsequent authenticated selected-dataset request for dataset `300001` returned HTTP 200, immutable snapshot `60001`, and 20 Matrix rows. The release therefore retains the full persisted Market Universe evidence alongside the new Ingestion Health surface.

## One-time first-run follow-up

The user authorized a single post-run inspection task. It is active with task UID `eAkdJChwe3SmSWZ1QY1MZf`, one-time execution mode, and expiry at 2026-08-23 04:00:00 UTC. On 2026-08-22, its platform timezone was verified as `Asia/Riyadh`; the original local-time cron would have fired at 2026-08-23 00:20 UTC, before the authorized window. The existing task was therefore updated in place—without creating a duplicate—to six-field cron `0 25 6 23 8 *`, which resolves to 2026-08-23 03:25 UTC (06:25 Asia/Riyadh), after the required 03:20 UTC threshold and before expiry. Its mandate is restricted to inspecting the three ordinary production executions and reporting their persisted evidence; it explicitly prohibits Research Lab, scoring, alert, paper-trading, real-trading, provider, sentiment, on-chain, and ML changes.

| Schedule | Task UID | Callback | Next UTC execution | Platform runs at baseline |
| --- | --- | --- | --- | --- |
| ETH/SOL 15M | `joNJFMck3fFT77bTCLbSby` | `/api/scheduled/ingest-historical-data` | 2026-08-23 02:32 | 0 |
| Liquid-major 1H | `K8bZtgkDqZt2QYVLeb4H7N` | `/api/scheduled/ingest-historical-data` | 2026-08-23 02:52 | 0 |
| Representative-sector 1H | `cPdv4RbsdgA32H7oLGgRVq` | `/api/scheduled/ingest-historical-data` | 2026-08-23 03:12 | 0 |

On 2026-08-22, platform inspection confirmed that all three rows above were enabled, retained their expected cron-only callback and next UTC execution, and each had an empty execution-log result (`total: 0`). This is retained as the pre-run baseline only; it is neither a successful ingestion result nor a platform failure.

The published application was also reached successfully after the documentation-only checkpoint. This read-only check did not authenticate, invoke an ingestion callback, modify a setting, or constitute evidence of a schedule run.

The older BTC 15M ingestion task remains enabled and separate. Its existing 2026-08-22 02:14:53 UTC execution succeeded with HTTP 200 in 6,075 ms; that historical predecessor is not counted as one of the three new expanded-universe first runs.

## First ordinary production executions — 2026-08-23

The authorized post-cadence inspection occurred after 03:20 UTC on 2026-08-23. No job was manually invoked. All three persisted `historicalScheduleExecutions` are `SUCCESS`, even though the platform callback log for each reports a 30-second StartToClose timeout. The distinction is material: the platform stopped waiting for the HTTP response, while the deployed handler continued and durably finalized its own execution row, ingestion-run rows, quality records, and issue evidence.

| Schedule | Schedule / execution ID | Persisted timing (UTC) | Durable result | Asset result | Inserts / duplicates / gaps | Provider / retry result |
| --- | --- | --- | --- | --- | --- | --- |
| ETH/SOL 15M | `30001` / `1` | 02:35:11–02:36:02; 51,128 ms | `SUCCESS` | 2 attempted; 2 succeeded; 0 failed | 554 / 0 / 3,478 | No provider errors; 0 retries |
| Liquid-major 1H | `30002` / `30001` | 02:55:13–02:56:30; 76,852 ms | `SUCCESS` | 8 attempted; 8 succeeded; 0 failed | 552 / 0 / 3,480 | No provider errors; 0 retries |
| Representative-sector 1H | `30003` / `60001` | 03:15:17–03:16:37; 80,400 ms | `SUCCESS` | 11 attempted; 11 completed; 0 failed | 680 / 0 / 4,360 | No provider errors; 0 retries |

The platform log records corresponding non-manual callback timeouts at 02:35:08–02:35:38, 02:55:11–02:55:41, and 03:15:11–03:15:41 UTC, each with `http_status: 0` and zero platform-level retry attempts. They are retained as transport-observability evidence, not substituted for the durable application result above. The application persisted the successful execution after those 30-second callback windows; no hidden retry or manual run occurred.

| Scope | Per-asset persisted evidence | Missing-range / availability evidence |
| --- | --- | --- |
| ETH/SOL 15M | `ethereum` and `solana`: each `partial`, 277 inserted, 0 duplicates, 1,739 continuity gaps | 2 `MISSING_RANGE` rows; both retry status `PENDING` |
| Liquid-major 1H | `avalanche-2`, `binancecoin`, `cardano`, `chainlink`, `ethereum`, `polkadot`, `ripple`, and `solana`: each `partial`, 69 inserted, 0 duplicates, 435 gaps | 8 `MISSING_RANGE` rows; each retry status `PENDING` |
| Representative-sector 1H | `aave`, `arbitrum`, `axie-infinity`, `dogecoin`, `filecoin`, `ondo-finance`, `optimism`, `render-token`, `the-graph`, and `uniswap`: each `partial`, 68 inserted, 0 duplicates, 436 gaps. `pepe`: `completed`, 0 inserted, 0 duplicates, 0 gaps. | 10 `MISSING_RANGE` rows remain `PENDING`; `pepe` has one `NO_NEW_CANDLES` row stating that no new public-archive candles were available. This is not a provider error and PEPE was not substituted. |

The first-run issue-event trail contains only `DETECTED` events at retry attempt 0: 2 for the 15M execution, 8 for the liquid-major 1H execution, and 11 for the representative-sector 1H execution. No `RETRY_STARTED`, `RETRY_SUCCEEDED`, or `RETRY_FAILED` event exists yet. The unresolved gaps are therefore explicitly pending future ordinary cadence, rather than being reported as recovered or as provider failure.

### Retained coverage, readiness, and sector status

The newly sealed dataset lineages retain 15M coverage of 105,674 / 109,152 candles (96.8136%) for dataset `330001`; 1H coverage of 166,992 / 170,472 candles (97.9586%) for dataset `360001`; and 1H coverage of 167,672 / 175,512 candles (95.5331%) for dataset `390001`. Across the protected health calculation's retained evidence, 21 represented assets, three populated timeframe scopes, three available regime classifications, three successful/partial scheduled incremental executions, 20 unresolved missing-range rows, 53.3205% average continuity, and 1,827,716 / 1,849,470 observed-versus-expected candles (98.8237%) produce **`ACCUMULATING`** readiness. It is not `READY_FOR_REVIEW`, because unresolved missing ranges remain. This informational state cannot start Research Lab.

Historical sector data remains explicitly unavailable: all 20 registry assets retain `HISTORICAL_UNAVAILABLE`, and all 104 historical sector snapshots retain `UNAVAILABLE`. No timestamp-aware sector classification was introduced or substituted.

### Validation and protected boundaries

The final post-execution validation passed: 28 Vitest files / 91 tests, TypeScript `pnpm check`, and production `pnpm build`. No source or configuration change was made during the audit. A database check found zero Research Lab experiments created during the 02:35–03:35 UTC audit window. Opportunity Score, Confidence Score, scoring weights, alerts, thresholds, paper trading, real trading, providers, sentiment, on-chain data, ML, APIs, and existing Research Lab behavior were not changed.
