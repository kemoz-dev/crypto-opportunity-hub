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

The older BTC 15M ingestion task remains enabled and separate. Its existing 2026-08-22 02:14:53 UTC execution succeeded with HTTP 200 in 6,075 ms; that historical predecessor is not counted as one of the three new expanded-universe first runs.
