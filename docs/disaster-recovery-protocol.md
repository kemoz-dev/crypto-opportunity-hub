# Disaster-Recovery Export and Recovery Protocol

**Protocol version:** `crypto-opportunity-hub-dr-v1`  
**Scope:** Historical research data, immutable lineage/context, market-universe history, owner-scoped research and execution-cost records, and ingestion-operational evidence.  
**Protected boundaries:** This protocol does not run Research Lab, alter Opportunity or Confidence scoring, modify alerts, change paper trading, enable real trading, or modify existing ingestion schedules.

## Archive contract

Each authenticated archive is a versioned `ZIP` package, generated from a single transactional database-read snapshot. It contains normalized JSON rows by table, captured MySQL DDL, and a `manifest.json`. The table ordering and foreign-key references are retained so the archive is a relationship-preserving recovery package rather than disconnected CSV files.

| Archive component | Content | Integrity evidence |
| --- | --- | --- |
| `data/*.json` | Historical OHLCV, datasets, runs, quality, gaps, issues/events, market-universe history, context, owner-scoped Research Lab and Cost Lab records, and operational records | Per-component SHA-256 checksum and record count |
| `schema/mysql-ddl.json` | Captured `SHOW CREATE TABLE` DDL for every exported entity | Per-component SHA-256 checksum |
| `manifest.json` | Export ID/time, archive/application/schema versions, dataset versions/fingerprints, entity counts, checksums, source-provenance and portability classification | Logical archive checksum calculated from every component path, count, and checksum |

The archive keeps shared historical tables plus **only the authenticated owner’s** private settings, portfolios/trades, backtests, Research Lab experiments/results, Execution Cost models/studies, alerts, and alert executions. A user can never enumerate or download another user’s private recovery data through the protected API.

## Verification and restore validation

After ZIP construction, the application reopens the archive in an **isolated in-memory archive reconstruction**. It verifies every component checksum, manifest checksum, source-versus-restored record count, and declared foreign-key relationship. A checksum, count, or relationship mismatch marks the archive invalid; discrepancies are reported rather than repaired silently.

This is a logical restore-validation environment, not a separate MySQL service. The current managed platform does not provide an attached isolated MySQL restore target for the application. A full external database import drill therefore remains a manual post-download step and is explicitly not represented as complete until it is performed on a compatible MySQL/InnoDB instance.

## Cadence, retention, and storage status

| Policy item | Implemented policy | Limitation |
| --- | --- | --- |
| Full backup cadence | On-demand verified full archive after material historical-data changes; operational target is **one full archive daily after ingestion completes** and one before a significant release | No automatic backup schedule is enabled in this checkpoint; the existing ingestion schedules are unchanged |
| Incremental/delta | Not implemented; every archive is full and self-contained | Deltas would make recovery more complex and are deferred until a verified full-backup baseline is established |
| Managed retention | 30 days from archive creation, recorded per archive | Managed object storage is still platform-managed; download the verified ZIP to storage you control for off-platform resilience |
| Verification | Automatically performed at archive creation | Does not validate an external MySQL import until an external compatible restore environment is supplied |
| Failure isolation | Archive records are stored separately from ingestion executions | Backup failure is never represented as an ingestion success or retry result |

Official Manus Task Data Backup is also a manual point-in-time snapshot; it is not an automatic sync. Account-specific availability and restoration eligibility must be determined from the owner’s notice and the official workflow. [1] [2]

## Recovery procedure

If the hosted project is unavailable, obtain the newest archive whose status is `verified`, whose retention has not expired, and whose manifest validation reports no mismatch. Then:

1. Download and preserve the ZIP without modifying archive contents.
2. Provision compatible MySQL/InnoDB and apply `schema/mysql-ddl.json` in dependency order.
3. Import `data/*.json` in the manifest’s dependency order, preserving IDs and JSON payloads.
4. Compare imported counts with `manifest.entityCounts` and recompute every listed SHA-256 checksum.
5. Verify dataset IDs, versions, content fingerprints, universe snapshots/members, candles, gaps, issue events, and historical context.
6. Verify owner-scoped Research Lab/Cost Lab records, configuration fingerprints, and provenance.
7. Deploy compatible application code, configure new secrets/OAuth, and reconnect storage.
8. Recreate or reattach platform cron jobs from exported schedule/task-UID configuration; verify ingestion callbacks separately.
9. Verify Research Lab and Execution Cost Lab read-only history before enabling any future research operation.

## Portability classification

| Classification | Items |
| --- | --- |
| **PORTABLE** | Exported relational records, historical source/provenance payloads, lineage/version metadata, schema DDL, manifest/count/checksum evidence, owner-scoped research/cost records |
| **PARTIALLY PORTABLE** | Schedule configuration/task UID, user identity record, archive stored in managed object storage; all need manual recreation, reattachment, or external download |
| **NOT PORTABLE** | Manus OAuth sessions, platform secret values, current deployment/account state, existing platform cron registrations, external provider availability at recovery time |

## References

[1]: https://help.manus.im/en/articles/16147892-service-change-overview-how-to-back-up-your-data "Manus Help Center — How to Back Up Your Data"

[2]: https://help.manus.im/en/articles/16147895-service-change-overview-how-to-restore-your-data "Manus Help Center — How to Restore Your Data"
