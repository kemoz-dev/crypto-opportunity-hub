# Ingestion Health Verification

The first development-browser inspection after the observability update confirmed that the Historical Data dialog remains available and retains its explicit protected-data unavailable state while a restarted development session settles its authenticated queries. This is not recorded as an ingestion failure or a successful schedule run. A subsequent authenticated check is required to verify the populated Ingestion Health and Research Dataset Readiness sections.

The three expanded production schedules were inspected before implementation. They are enabled, target `/api/scheduled/ingest-historical-data`, and have no execution logs yet because they were created after their daily UTC windows. Their first ordinary production cadence remains pending; no run was fabricated or triggered through an unauthenticated route.

The protected health API returned HTTP 200 with zero persisted expanded-schedule executions, zero unresolved issues, and the stored historical coverage basis. Readiness was adjusted so this state is **ACCUMULATING**, not ready for review: an actual successful or partial scheduled incremental execution is now required in addition to coverage, continuity, and regime evidence. This remains informational only and cannot start Research Lab.

The checkpointed production domain served the Historical Data shell immediately after publication. A direct authenticated request for the newly added `historicalIngestionHealth` procedure initially returned HTTP 404 during deployment propagation. A subsequent cache-busted request returned HTTP 200 and the protected schedule payload, including the three expanded schedule records. This is not a failed ingestion execution; no expanded schedule task has yet run through the new callback.

| Schedule | Task UID | Callback | Next UTC execution | Platform runs at baseline |
| --- | --- | --- | --- | --- |
| ETH/SOL 15M | `joNJFMck3fFT77bTCLbSby` | `/api/scheduled/ingest-historical-data` | 2026-08-23 02:32 | 0 |
| Liquid-major 1H | `K8bZtgkDqZt2QYVLeb4H7N` | `/api/scheduled/ingest-historical-data` | 2026-08-23 02:52 | 0 |
| Representative-sector 1H | `cPdv4RbsdgA32H7oLGgRVq` | `/api/scheduled/ingest-historical-data` | 2026-08-23 03:12 | 0 |

The older BTC 15M ingestion task remains enabled and separate. Its existing 2026-08-22 02:14:53 UTC execution succeeded with HTTP 200 in 6,075 ms; that historical predecessor is not counted as one of the three new expanded-universe first runs.
