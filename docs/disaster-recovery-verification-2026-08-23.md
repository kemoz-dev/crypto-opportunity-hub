# Disaster-Recovery Verification Report — 2026-08-23

## 1. Archive format

The implemented recovery format is **`zip-json`**, version **`crypto-opportunity-hub-dr-v2`**. It is a single portable ZIP package with normalized table data, captured MySQL DDL, a machine-readable manifest, per-component SHA-256 checksums, logical archive checksum, record counts, timestamps, dataset identifiers, and portability metadata.

## 2. Verified archive identifiers and status

Two owner-scoped archives were retained during the authorized first-run validation. The first successful application request produced **`dr-20260823-90332f9772c045ba`** at database ID `1`; the second, used for direct downloaded-file validation, is **`dr-20260823-c0df3a744ffd49bd`** at database ID `2`. Both have durable status **`verified`**. There were no archive rows before this work; the duplicate is an additional verified recovery point, not a failed or overwritten backup.

## 3. Archive timestamps

The primary downloaded archive (`dr-20260823-c0df3a744ffd49bd`) was created at **2026-08-23 08:24:49 UTC**, verified at **08:24:52 UTC**, and retains its managed-storage eligibility until **2026-09-22 08:24:47 UTC**.

## 4. Archive size and physical ZIP validation

The primary archive is **56,950,333 bytes** (reported as **56.95 MB**). The authenticated download was saved as `dr-20260823-c0df3a744ffd49bd_6c9fb680.zip`; ZIP integrity testing returned **“No errors detected in compressed data.”** Its whole-file SHA-256 is `a980e69523ba90d59fffe4710d65fbb7433f01e5b3483f3102d9db4dd3b0fa8e`.

## 5. Durable storage location

The archive is stored through the configured managed object-storage helper under the owner-scoped key `disaster-recovery/330001/dr-20260823-c0df3a744ffd49bd_6c9fb680.zip`. The archive metadata and storage key are durable database records; raw file bytes are not stored in MySQL.

## 6. Schema and archive-version metadata

The manifest identifies the archive format/version, application version, `drizzle/0014_absurd_groot.sql` schema version, snapshot start/completion timestamps, and captured `SHOW CREATE TABLE` DDL. The active canonical schema reports **38 tables**, including the additive `disasterRecoveryArchives` metadata table; Drizzle reported **no schema diff** after validation.

## 7. Included data scope

The archive preserves shared historical research state: OHLCV, datasets, ingestion schedules/runs/executions, quality, missing intervals, ingestion issues/events, market caps, regimes, sector/availability provenance, market-universe registry and snapshots, market/technical/score snapshots, Research Lab reports, and source records. It also includes only the authenticated owner’s private user record, settings, paper portfolio/trades, backtests, Research Lab experiments/results, Execution Cost models/studies, alerts, and alert executions.

## 8. Partition and component coverage

The primary manifest contains **329 verified components**. Ordinary entities are serialized as `data/*.json`; high-volume `historicalCandles` and `historicalRegimeSnapshots` are compressed `data/<table>/*.ndjson.gz` partitions. This v2 partitioning avoids the previously observed full-memory export failure while preserving each partition’s independent count and checksum evidence.

## 9. Dataset identity and immutable lineage

The manifest contains **14 historical dataset versions** together with version/fingerprint fields and exported lineage/context tables. It preserves immutable dataset branching references, OHLCV ingestion-run linkage, quality/gap records, universe snapshots/members, and configured historical context rather than reconstructing them from current data.

## 10. Key source-versus-restored record counts

All **37 exported entity counts** matched in the isolated reconstruction. Key matched values were **304,006 historical candles**, **278,130 regime snapshots**, **11,808 market-cap snapshots**, **286 quality rows**, **71 ingestion runs**, **14 datasets**, **6 universe snapshots**, **120 universe members**, **7 Research Lab experiments**, and **165 Research Lab experiment results**.

## 11. Checksums

Every component has a SHA-256 checksum in the manifest. The primary archive’s logical component checksum is **`cf0ac834dfb93dd862db70bc765bdd69505a0f98b1b514e4751d0c8245be06df`**. Archive validation reported **0 component checksum mismatches** and the ZIP download’s physical integrity test succeeded.

## 12. Restore-validation environment

Mandatory restore validation completed in the application’s **isolated in-memory archive reconstruction**. The validator re-opened the ZIP, read every component, validated checksums/manifest, reconstructed normal JSON entities, decompressed high-volume NDJSON/GZIP partitions in batches, and compared source-to-restored counts.

## 13. Source-to-restored comparison result

The primary archive’s validation recorded **37 count comparisons**, all matching. It specifically confirmed parity for the high-volume candle and regime partitions as well as owner-scoped research and alert records. No source row was silently dropped or added by the archive process.

## 14. Relationship-integrity checks

The validator recorded **54 relationship checks**, all valid with **0 missing references**. Checks cover dataset/run/issue/candle provenance, asset references, universe composition, context records, Research Lab result linkage, Cost Lab model/study linkage, portfolio/trade relationships, owner references, and alert/execution relationships.

## 15. Mismatches and errors

The primary archive’s validation recorded **0 validation errors** and **0 checksum mismatches**. No relationship mismatch was reported. An earlier unbuffered diagnostic export was killed by the sandbox’s memory limit before metadata creation; it created no archive row and was replaced by the v2 partitioned path. This is recorded as an implementation remediation, not as a successful backup.

## 16. Authentication, ownership isolation, and retrieval

Archive create/list/detail/download procedures require authentication. List and retrieval are constrained to `userId`, and tests prove unauthenticated requests are rejected and cross-user archive retrieval returns not found. The newest verified archive’s protected **Download** control issued a signed retrieval and completed an authenticated browser download.

## 17. Cadence

The implemented cadence is on-demand verified full archive creation. The documented operational target is **one full archive daily after ingestion completes**, plus an archive before a significant release or risky migration. **No automatic backup schedule was deployed** in this checkpoint, so the existing ingestion jobs remain untouched and backup status stays independent from ingestion health.

## 18. Retention

Each archive records a **30-day managed retention** deadline. Managed object storage is not a substitute for owner-controlled off-platform retention: the verified archive should be downloaded and preserved by the owner in independent storage before project removal or retention expiry.

## 19. Portability and remaining single points of failure

| Classification | Result |
| --- | --- |
| **Portable** | Exported relational records, DDL, manifest/checksum evidence, historical lineage/provenance, immutable snapshots, and owner-scoped research/cost history. |
| **Partially portable** | User identity record, schedule/task-UID configuration, and managed archive object; these require manual reattachment, recreation, or download. |
| **Not portable** | Manus OAuth sessions, secrets, platform account/deployment/domain state, existing platform cron registrations, and future external-provider availability. |

The remaining recovery dependencies are an owner-held copy of the ZIP, compatible MySQL/InnoDB, compatible application code, newly configured secrets/OAuth, and manual platform-schedule recovery.

## 20. Recovery time, final validation, and protected boundaries

No end-to-end external MySQL import drill was possible in the attached environment, so a definitive **RTO is not measured**. The deterministic recovery procedure is documented in [the protocol](./disaster-recovery-protocol.md); it requires compatible MySQL provisioning, DDL application, dependency-ordered JSON/NDJSON import, count/checksum comparison, code/secret configuration, and schedule recreation. Final automated validation passed **96 Vitest tests**, **TypeScript**, **production build**, and **Drizzle schema sync**. Current count checks show archive creation added only two `disasterRecoveryArchives` rows; candles, regimes, ingestion runs, Research Lab, alerts/executions, paper trading, and settings matched the verified snapshot counts. Opportunity/Confidence scoring, alert rules, Paper Trading, real-trading prohibition, Research Lab execution, providers, and ingestion schedules were not modified.

## References

[1]: https://help.manus.im/en/articles/16147892-service-change-overview-how-to-back-up-your-data "Manus Help Center — How to Back Up Your Data"

[2]: https://help.manus.im/en/articles/16147895-service-change-overview-how-to-restore-your-data "Manus Help Center — How to Restore Your Data"
