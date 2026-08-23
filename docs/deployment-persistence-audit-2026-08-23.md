# Deployment-Persistence Audit — Crypto Opportunity Hub

**Audit time:** 2026-08-23, after the first ordinary expanded-ingestion executions.  
**Method:** Read-only source, database-catalog, platform-schedule, workspace, and official-policy inspection.  
**Changes made:** None. This audit did not run Research Lab, execute a migration, create a backup, export data, or alter scoring, alerts, trading, providers, or schedules.

> **Bottom line:** The production historical system is persisted in the project's managed **MySQL/InnoDB database**, not in the application container or sandbox filesystem. That database and the platform-owned schedules survive normal redeployments and process suspension, but the project presently has **no verified application-level automated backup and no complete portable historical-dataset export**. A Manus Task Data Backup, if created by the account owner, is a point-in-time restoration package for Manus—not a proven external database migration mechanism. [1] [2]

## 1. Physical persistence map

| Requested record class | Physical production location | Principal tables / persisted provenance | Current catalog evidence |
| --- | --- | --- | --- |
| OHLCV datasets | Managed MySQL/InnoDB database connected through `DATABASE_URL` | `historicalDatasets`, `historicalCandles`, `historicalIngestionRuns`, `historicalDataQuality`, `historicalIngestionIssues`, `historicalIngestionIssueEvents` | 14 dataset rows; 304,006 candle rows; 71 ingestion-run rows; 21 issue rows; 21 issue-event rows |
| Market Universe registry and immutable snapshots | Same managed MySQL/InnoDB database | `marketUniverseAssets`, `historicalUniverseSnapshots`, `historicalUniverseMembers`; snapshot is linked to `historicalDatasets.datasetId` | 20 registry rows; 6 snapshot rows; 120 member rows |
| Historical Market Cap and Regime context | Same managed MySQL/InnoDB database | `historicalMarketCaps`, `historicalRegimeSnapshots`; both link to dataset ID and persist timestamp/source/input provenance | 11,808 market-cap rows; 278,130 regime rows |
| Historical sector and availability evidence | Same managed MySQL/InnoDB database | `historicalSectorSnapshots`, `historicalAssetAvailability` | 104 sector rows and 104 availability rows; sector state remains explicitly unavailable |
| Research Lab | Same managed MySQL/InnoDB database | `researchExperiments`, `researchExperimentResults`, including selected dataset/version/fingerprint, configuration, provenance, and results | 7 experiment rows; 165 result rows |
| Execution Cost Lab | Same managed MySQL/InnoDB database | `executionCostModels`, `historicalFundingRates`, `historicalLiquidityObservations`, `executionCostStudies`, linked to dataset/version/fingerprint and source provenance | Tables exist; all four currently contain zero rows |

The application uses Drizzle's MySQL driver, and its migration configuration declares the `mysql` dialect. The historical modules contain no object-storage calls; the project’s S3-backed helper is for uploaded files, not for historical-market records. Therefore the complete relational history currently resides in the managed database rather than S3, local disk, or the ephemeral runtime container.

## 2. Deployment and runtime dependency assessment

| Event | Historical database records | Market-universe / research / cost records | Scheduled ingestion consequence | Audit conclusion |
| --- | --- | --- | --- | --- |
| Application redeployment or a new published release | Expected to survive because code deployment is separate from the managed MySQL database | Expected to survive | Jobs retain platform registration and call the deployed callback | **Survives**, unless a future destructive migration or explicit database deletion occurs |
| Server/container restart | Expected to survive; no primary market data is stored in process memory | Expected to survive | Platform scheduler remains registered; the restarted service must become reachable to process a callback | **Survives** |
| Application suspension / scale-to-zero | Expected to survive | Expected to survive | Platform scheduler remains registered, but an unavailable callback cannot ingest; the next call may cold-start and remains subject to the HTTP timeout | **Records survive; ingestion availability does not** |
| Manus project shutdown, deletion, or an affected-account deletion event | Not independently recoverable from the project after its managed database is removed | Same | Platform callbacks cannot persist data when the project is gone | **Do not assume survival**; recovery depends on a valid Task Data Backup and applicable account restoration path |

The three ingestion jobs are not in-process timers. They are active platform-managed HTTP cron records, each owned by the project owner and calling `/api/scheduled/ingest-historical-data` by task UID. Their cron registrations persist independently of a particular container process, but they are still operationally dependent on the Manus-hosted application and its managed database being reachable. If the application disappears, the cron may still be registered but cannot successfully ingest or write history.

## 3. Backup posture and worst-case recovery

### Confirmed current posture

No database dump, backup artifact, or full historical-data export was found in the project workspace. No source code implements scheduled database backup, snapshot replication, or a complete dataset dump. The authenticated backup-page check did not expose a completed-backup record that can be audited from this session.

Accordingly, the **latest backup location is not known or verified**. The correct status is **no confirmed application-level backup**. This is not evidence that the managed database provider has no internal disaster-recovery process; rather, no provider-level backup has been exposed, tested, or made available as a project recovery artifact, so it must not be relied upon for this application’s recovery plan.

Official Manus policy states that Task Data Backup is manual, fixed point in time, and includes website code, files, database content, secrets, and integration settings. It is not an ongoing sync. [1] [2] Account-specific eligibility and deletion scope are determined by the owner’s in-app notice and email; this audit does not infer the account’s classification. [3]

### Recovery answers

| Question | Precise answer |
| --- | --- |
| Can the complete historical dataset and database be restored elsewhere if the Manus-hosted application disappears? | **Not with a proven, already-existing external recovery package.** The current project has no complete portable database dump. A Manus Task Data Backup—if the owner created one—supports restoration inside Manus according to the official workflow, not a documented complete migration to an arbitrary external host. [1] [2] |
| Is there an automated database/dataset backup? | **No verified application-level automated backup.** No automated dump, replication, or export job exists in project code; official policy says Task Data backup is manual, not automatic. [1] |
| Where is the latest backup stored? | **Unknown / not confirmed.** No workspace artifact or accessible backup-history record was found. It could only be identified by the account owner from a completed manual backup package or the official backup interface. |
| Can the complete historical dataset—including all provenance/version metadata—be exported portably now? | **Not completely.** Research experiments and individual Execution Cost studies have JSON/CSV exports containing configuration and provenance. There is no implemented export covering all historical datasets, candles, ingestion runs, quality records, issues/events, market-cap/regime/sector context, universe snapshots/members, and registry metadata as one portable bundle. |

### Worst-case recovery scenario

If the Manus project and its database disappeared tomorrow and no valid Task Data Backup existed, the deployed source can be recovered from the project/version history only while Manus retains it, but the full 304,006-row OHLCV corpus, immutable dataset lineage, coverage/gap evidence, market-cap/regime context, universe snapshots, research records, and future schedule configuration would **not be recoverable as a verified point-in-time dataset**. Public-provider data could be re-downloaded, but it would not reproduce the exact retained source payloads, ingestion timestamps, gaps, failures, dataset IDs/fingerprints, or prior research provenance.

If a valid current Task Data Backup exists and the account is eligible for restoration, the official path is to restore the snapshot inside Manus. It recreates the database and website state captured at export time, but it does not contain activity written after that snapshot. [1] [2]

## 4. Non-mutation confirmation

No deployment, schema, data, schedule, provider, score, alert, paper-trading, or real-trading setting was altered. No Research Lab experiment was started. The audit produced documentation only.

## References

[1]: https://help.manus.im/en/articles/16147892-service-change-overview-how-to-back-up-your-data "Manus Help Center — How to Back Up Your Data"

[2]: https://help.manus.im/en/articles/16147895-service-change-overview-how-to-restore-your-data "Manus Help Center — How to Restore Your Data"

[3]: https://help.manus.im/en/articles/16147831-service-change-overview-what-s-happening-and-am-i-affected "Manus Help Center — What’s Happening and Am I Affected?"
