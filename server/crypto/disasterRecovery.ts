import { createHash, randomUUID } from "node:crypto";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import {
  alertExecutions,
  alerts,
  assets,
  backtestResults,
  backtestRuns,
  dataSources,
  disasterRecoveryArchives,
  executionCostModels,
  executionCostStudies,
  historicalAssetAvailability,
  historicalCandles,
  historicalDataQuality,
  historicalDatasets,
  historicalFundingRates,
  historicalIngestionIssueEvents,
  historicalIngestionIssues,
  historicalIngestionRuns,
  historicalIngestionSchedules,
  historicalLiquidityObservations,
  historicalMarketCaps,
  historicalMissingIntervals,
  historicalRegimeSnapshots,
  historicalScheduleExecutions,
  historicalSectorSnapshots,
  historicalUniverseMembers,
  historicalUniverseSnapshots,
  marketData,
  marketUniverseAssets,
  paperPortfolios,
  paperTrades,
  researchExperimentResults,
  researchExperiments,
  researchReports,
  scoreSnapshots,
  sectors,
  technicalSnapshots,
  userSettings,
  users,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { storageGetSignedUrl, storagePut } from "../storage";

export const DISASTER_RECOVERY_ARCHIVE_VERSION = "crypto-opportunity-hub-dr-v1";
export const DISASTER_RECOVERY_ARCHIVE_FORMAT = "zip-json";
export const DISASTER_RECOVERY_RETENTION_DAYS = 30;
const APPLICATION_VERSION = "crypto-opportunity-hub@1.0.0";

const TABLE_ORDER = [
  "users", "assets", "dataSources", "marketData", "technicalSnapshots", "scoreSnapshots", "sectors", "userSettings",
  "paperPortfolios", "paperTrades", "backtestRuns", "backtestResults", "researchExperiments", "researchExperimentResults",
  "historicalDatasets", "historicalIngestionSchedules", "historicalScheduleExecutions", "historicalIngestionRuns", "historicalIngestionIssues", "historicalIngestionIssueEvents",
  "historicalCandles", "historicalDataQuality", "historicalMissingIntervals", "historicalMarketCaps", "historicalRegimeSnapshots", "historicalSectorSnapshots", "historicalAssetAvailability",
  "marketUniverseAssets", "historicalUniverseSnapshots", "historicalUniverseMembers", "executionCostModels", "historicalFundingRates", "historicalLiquidityObservations", "executionCostStudies",
  "alerts", "alertExecutions", "researchReports",
] as const;

const archivePath = (table: string) => `data/${table}.json`;

type Row = Record<string, unknown>;
type Snapshot = { tables: Record<string, Row[]>; schema: Record<string, string>; startedAt: string; completedAt: string };
type ArchiveComponent = { path: string; recordCount: number; checksum: string; bytes: number };
export type RestoreValidation = {
  environment: "isolated-in-memory-archive-reconstruction";
  valid: boolean;
  archiveChecksum: string;
  sourceVsRestoredCounts: Array<{ table: string; source: number; restored: number; matches: boolean }>;
  relationshipChecks: Array<{ relationship: string; valid: boolean; missingReferences: number }>;
  checksumMismatches: string[];
  errors: string[];
};
export type DisasterRecoveryManifest = {
  exportId: string;
  exportTimestamp: string;
  archiveFormat: typeof DISASTER_RECOVERY_ARCHIVE_FORMAT;
  archiveVersion: typeof DISASTER_RECOVERY_ARCHIVE_VERSION;
  applicationVersion: string;
  schemaVersion: string;
  snapshotStartedAt: string;
  snapshotCompletedAt: string;
  datasetVersions: Array<{ id: number; version: string; contentFingerprint: string | null; status: string }>;
  components: ArchiveComponent[];
  entityCounts: Record<string, number>;
  sourceProvenance: { providerEvidencePreserved: true; ingestionEvidencePreserved: true; privateRecordsScope: "owner-only"; scheduleState: "configuration-only" };
  portability: {
    portable: string[];
    partiallyPortable: string[];
    notPortable: string[];
  };
  archiveChecksum: string;
};

const sha256 = (value: Uint8Array | string) => createHash("sha256").update(value).digest("hex");

function normalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return { $type: "bigint", value: value.toString() };
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Row).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, normalize(item)]));
  return value;
}

function stableJson(value: unknown) {
  return JSON.stringify(normalize(value));
}

function rows(value: unknown[]): Row[] {
  return value.map(item => normalize(item) as Row);
}

function ids(records: Row[]) {
  return records.map(record => record.id).filter((id): id is number => typeof id === "number");
}

function tableRows(snapshot: Snapshot, table: string) {
  return snapshot.tables[table] ?? [];
}

function tableIdSet(snapshot: Snapshot, table: string) {
  return new Set(tableRows(snapshot, table).map(row => row.id ?? row.assetId));
}

function relationshipValidation(snapshot: Snapshot) {
  const checks: Array<{ child: string; field: string; parent: string; parentField?: string; optional?: boolean }> = [
    { child: "marketData", field: "assetId", parent: "assets", parentField: "id" },
    { child: "technicalSnapshots", field: "assetId", parent: "assets", parentField: "id" },
    { child: "scoreSnapshots", field: "assetId", parent: "assets", parentField: "id" },
    { child: "userSettings", field: "userId", parent: "users" },
    { child: "paperPortfolios", field: "userId", parent: "users" },
    { child: "paperTrades", field: "portfolioId", parent: "paperPortfolios" },
    { child: "paperTrades", field: "assetId", parent: "assets", parentField: "id" },
    { child: "backtestRuns", field: "userId", parent: "users" },
    { child: "backtestResults", field: "runId", parent: "backtestRuns" },
    { child: "researchExperiments", field: "userId", parent: "users" },
    { child: "researchExperiments", field: "datasetId", parent: "historicalDatasets", optional: true },
    { child: "researchExperimentResults", field: "experimentId", parent: "researchExperiments" },
    { child: "historicalDatasets", field: "basedOnDatasetId", parent: "historicalDatasets", optional: true },
    { child: "historicalIngestionSchedules", field: "lastDatasetId", parent: "historicalDatasets", optional: true },
    { child: "historicalScheduleExecutions", field: "scheduleId", parent: "historicalIngestionSchedules" },
    { child: "historicalScheduleExecutions", field: "datasetId", parent: "historicalDatasets", optional: true },
    { child: "historicalIngestionRuns", field: "datasetId", parent: "historicalDatasets", optional: true },
    { child: "historicalIngestionRuns", field: "scheduleExecutionId", parent: "historicalScheduleExecutions", optional: true },
    { child: "historicalIngestionRuns", field: "assetId", parent: "assets", parentField: "id", optional: true },
    { child: "historicalIngestionIssues", field: "datasetId", parent: "historicalDatasets", optional: true },
    { child: "historicalIngestionIssues", field: "scheduleExecutionId", parent: "historicalScheduleExecutions", optional: true },
    { child: "historicalIngestionIssues", field: "ingestionRunId", parent: "historicalIngestionRuns", optional: true },
    { child: "historicalIngestionIssues", field: "assetId", parent: "assets", parentField: "id" },
    { child: "historicalIngestionIssueEvents", field: "issueId", parent: "historicalIngestionIssues" },
    { child: "historicalIngestionIssueEvents", field: "scheduleExecutionId", parent: "historicalScheduleExecutions", optional: true },
    { child: "historicalIngestionIssueEvents", field: "ingestionRunId", parent: "historicalIngestionRuns", optional: true },
    { child: "historicalCandles", field: "ingestionRunId", parent: "historicalIngestionRuns" },
    { child: "historicalCandles", field: "assetId", parent: "assets", parentField: "id" },
    { child: "historicalDataQuality", field: "datasetId", parent: "historicalDatasets" },
    { child: "historicalDataQuality", field: "assetId", parent: "assets", parentField: "id" },
    { child: "historicalMissingIntervals", field: "datasetId", parent: "historicalDatasets" },
    { child: "historicalMissingIntervals", field: "assetId", parent: "assets", parentField: "id" },
    { child: "historicalMarketCaps", field: "datasetId", parent: "historicalDatasets" },
    { child: "historicalMarketCaps", field: "assetId", parent: "assets", parentField: "id" },
    { child: "historicalRegimeSnapshots", field: "datasetId", parent: "historicalDatasets" },
    { child: "historicalSectorSnapshots", field: "datasetId", parent: "historicalDatasets" },
    { child: "historicalSectorSnapshots", field: "assetId", parent: "assets", parentField: "id" },
    { child: "historicalAssetAvailability", field: "datasetId", parent: "historicalDatasets" },
    { child: "historicalAssetAvailability", field: "assetId", parent: "assets", parentField: "id" },
    { child: "marketUniverseAssets", field: "assetId", parent: "assets", parentField: "id" },
    { child: "historicalUniverseSnapshots", field: "datasetId", parent: "historicalDatasets" },
    { child: "historicalUniverseMembers", field: "universeSnapshotId", parent: "historicalUniverseSnapshots" },
    { child: "historicalUniverseMembers", field: "assetId", parent: "assets", parentField: "id" },
    { child: "executionCostModels", field: "userId", parent: "users" },
    { child: "historicalFundingRates", field: "datasetId", parent: "historicalDatasets" },
    { child: "historicalFundingRates", field: "assetId", parent: "assets", parentField: "id" },
    { child: "historicalLiquidityObservations", field: "datasetId", parent: "historicalDatasets" },
    { child: "historicalLiquidityObservations", field: "assetId", parent: "assets", parentField: "id" },
    { child: "executionCostStudies", field: "userId", parent: "users" },
    { child: "executionCostStudies", field: "modelId", parent: "executionCostModels", optional: true },
    { child: "executionCostStudies", field: "datasetId", parent: "historicalDatasets" },
    { child: "executionCostStudies", field: "assetId", parent: "assets", parentField: "id" },
    { child: "alerts", field: "userId", parent: "users" },
    { child: "alertExecutions", field: "alertId", parent: "alerts" },
  ];
  return checks.map(check => {
    const parent = tableIdSet(snapshot, check.parent);
    const missingReferences = tableRows(snapshot, check.child).filter(row => {
      const childValue = row[check.field];
      return !((check.optional && (childValue === null || childValue === undefined)) || parent.has(childValue));
    }).length;
    return { relationship: `${check.child}.${check.field} -> ${check.parent}.${check.parentField ?? "id"}`, valid: missingReferences === 0, missingReferences };
  });
}

export function calculateDisasterRecoveryLogicalChecksum(components: ArchiveComponent[]) {
  return sha256(stableJson(components.map(({ path, checksum, recordCount }) => ({ path, checksum, recordCount }))));
}

function portability() {
  return {
    portable: ["All included relational data rows", "Dataset/version and provenance metadata", "Schema DDL", "Manifest, component checksums, and logical archive checksum", "User-owned Research Lab and Execution Cost records"],
    partiallyPortable: ["Scheduled-ingestion configuration and task UID records; platform cron jobs must be recreated or reattached manually", "Authenticated user identity; the record is portable but external OAuth session recreation is manual"],
    notPortable: ["Manus-hosted OAuth sessions", "Platform-managed secrets and built-in service credentials", "Existing platform cron registrations", "Manus deployment/domain/account state"],
  };
}

async function showCreateTable(db: any, tableName: string) {
  const response = await db.execute(sql.raw(`SHOW CREATE TABLE \`${tableName}\``));
  const result = Array.isArray(response) && Array.isArray(response[0]) ? response[0] : response;
  const row = Array.isArray(result) ? result[0] as Row | undefined : undefined;
  const ddl = row?.["Create Table"];
  if (typeof ddl !== "string") throw new Error(`Could not read schema DDL for ${tableName}.`);
  return ddl;
}

async function collectSnapshot(db: any, userId: number): Promise<Snapshot> {
  const startedAt = new Date().toISOString();
  const owner = await db.select().from(users).where(eq(users.id, userId));
  if (!owner.length) throw new Error("Authenticated user record was not found.");
  const portfolios = await db.select().from(paperPortfolios).where(eq(paperPortfolios.userId, userId));
  const portfolioIds = ids(rows(portfolios));
  const backtests = await db.select().from(backtestRuns).where(eq(backtestRuns.userId, userId));
  const backtestIds = ids(rows(backtests));
  const experiments = await db.select().from(researchExperiments).where(eq(researchExperiments.userId, userId));
  const experimentIds = ids(rows(experiments));
  const userAlerts = await db.select().from(alerts).where(eq(alerts.userId, userId));
  const alertIds = ids(rows(userAlerts));
  const tables: Record<string, Row[]> = {
    users: rows(owner),
    assets: rows(await db.select().from(assets)),
    dataSources: rows(await db.select().from(dataSources)),
    marketData: rows(await db.select().from(marketData)),
    technicalSnapshots: rows(await db.select().from(technicalSnapshots)),
    scoreSnapshots: rows(await db.select().from(scoreSnapshots)),
    sectors: rows(await db.select().from(sectors)),
    userSettings: rows(await db.select().from(userSettings).where(eq(userSettings.userId, userId))),
    paperPortfolios: rows(portfolios),
    paperTrades: portfolioIds.length ? rows(await db.select().from(paperTrades).where(inArray(paperTrades.portfolioId, portfolioIds))) : [],
    backtestRuns: rows(backtests),
    backtestResults: backtestIds.length ? rows(await db.select().from(backtestResults).where(inArray(backtestResults.runId, backtestIds))) : [],
    researchExperiments: rows(experiments),
    researchExperimentResults: experimentIds.length ? rows(await db.select().from(researchExperimentResults).where(inArray(researchExperimentResults.experimentId, experimentIds))) : [],
    historicalDatasets: rows(await db.select().from(historicalDatasets)),
    historicalIngestionSchedules: rows(await db.select().from(historicalIngestionSchedules)),
    historicalScheduleExecutions: rows(await db.select().from(historicalScheduleExecutions)),
    historicalIngestionRuns: rows(await db.select().from(historicalIngestionRuns)),
    historicalIngestionIssues: rows(await db.select().from(historicalIngestionIssues)),
    historicalIngestionIssueEvents: rows(await db.select().from(historicalIngestionIssueEvents)),
    historicalCandles: rows(await db.select().from(historicalCandles)),
    historicalDataQuality: rows(await db.select().from(historicalDataQuality)),
    historicalMissingIntervals: rows(await db.select().from(historicalMissingIntervals)),
    historicalMarketCaps: rows(await db.select().from(historicalMarketCaps)),
    historicalRegimeSnapshots: rows(await db.select().from(historicalRegimeSnapshots)),
    historicalSectorSnapshots: rows(await db.select().from(historicalSectorSnapshots)),
    historicalAssetAvailability: rows(await db.select().from(historicalAssetAvailability)),
    marketUniverseAssets: rows(await db.select().from(marketUniverseAssets)),
    historicalUniverseSnapshots: rows(await db.select().from(historicalUniverseSnapshots)),
    historicalUniverseMembers: rows(await db.select().from(historicalUniverseMembers)),
    executionCostModels: rows(await db.select().from(executionCostModels).where(eq(executionCostModels.userId, userId))),
    historicalFundingRates: rows(await db.select().from(historicalFundingRates)),
    historicalLiquidityObservations: rows(await db.select().from(historicalLiquidityObservations)),
    executionCostStudies: rows(await db.select().from(executionCostStudies).where(eq(executionCostStudies.userId, userId))),
    alerts: rows(userAlerts),
    alertExecutions: alertIds.length ? rows(await db.select().from(alertExecutions).where(inArray(alertExecutions.alertId, alertIds))) : [],
    researchReports: rows(await db.select().from(researchReports)),
  };
  const schema: Record<string, string> = {};
  for (const tableName of TABLE_ORDER) schema[tableName] = await showCreateTable(db, tableName);
  return { tables, schema, startedAt, completedAt: new Date().toISOString() };
}

function createArchive(snapshot: Snapshot, exportId: string) {
  const components: ArchiveComponent[] = [];
  const files: Record<string, Uint8Array> = {};
  for (const tableName of TABLE_ORDER) {
    const path = archivePath(tableName);
    const bytes = strToU8(stableJson(snapshot.tables[tableName] ?? []));
    files[path] = bytes;
    components.push({ path, recordCount: snapshot.tables[tableName]?.length ?? 0, checksum: sha256(bytes), bytes: bytes.byteLength });
  }
  const schemaPath = "schema/mysql-ddl.json";
  const schemaBytes = strToU8(stableJson(snapshot.schema));
  files[schemaPath] = schemaBytes;
  components.push({ path: schemaPath, recordCount: Object.keys(snapshot.schema).length, checksum: sha256(schemaBytes), bytes: schemaBytes.byteLength });
  const datasetVersions = tableRows(snapshot, "historicalDatasets").map(row => ({ id: Number(row.id), version: String(row.version), contentFingerprint: typeof row.contentFingerprint === "string" ? row.contentFingerprint : null, status: String(row.status) }));
  const entityCounts = Object.fromEntries(TABLE_ORDER.map(tableName => [tableName, snapshot.tables[tableName]?.length ?? 0]));
  const manifest: DisasterRecoveryManifest = {
    exportId,
    exportTimestamp: new Date().toISOString(),
    archiveFormat: DISASTER_RECOVERY_ARCHIVE_FORMAT,
    archiveVersion: DISASTER_RECOVERY_ARCHIVE_VERSION,
    applicationVersion: APPLICATION_VERSION,
    schemaVersion: "drizzle/0014_absurd_groot.sql",
    snapshotStartedAt: snapshot.startedAt,
    snapshotCompletedAt: snapshot.completedAt,
    datasetVersions,
    components,
    entityCounts,
    sourceProvenance: { providerEvidencePreserved: true, ingestionEvidencePreserved: true, privateRecordsScope: "owner-only", scheduleState: "configuration-only" },
    portability: portability(),
    archiveChecksum: calculateDisasterRecoveryLogicalChecksum(components),
  };
  files["manifest.json"] = strToU8(stableJson(manifest));
  return { manifest, archiveBytes: zipSync(files, { level: 9 }) };
}

export function validateDisasterRecoveryArchive(archiveBytes: Uint8Array): RestoreValidation {
  const errors: string[] = [];
  const checksumMismatches: string[] = [];
  let manifest: DisasterRecoveryManifest | null = null;
  let snapshot: Snapshot = { tables: {}, schema: {}, startedAt: "", completedAt: "" };
  try {
    const files = unzipSync(archiveBytes);
    const manifestBytes = files["manifest.json"];
    if (!manifestBytes) throw new Error("Archive does not contain manifest.json.");
    manifest = JSON.parse(strFromU8(manifestBytes)) as DisasterRecoveryManifest;
    for (const component of manifest.components) {
      const bytes = files[component.path];
      if (!bytes) {
        checksumMismatches.push(`${component.path}: missing`);
        continue;
      }
      if (sha256(bytes) !== component.checksum) checksumMismatches.push(`${component.path}: checksum mismatch`);
      if (component.path.startsWith("data/")) snapshot.tables[component.path.slice(5, -5)] = JSON.parse(strFromU8(bytes)) as Row[];
      if (component.path === "schema/mysql-ddl.json") snapshot.schema = JSON.parse(strFromU8(bytes)) as Record<string, string>;
    }
    if (calculateDisasterRecoveryLogicalChecksum(manifest.components) !== manifest.archiveChecksum) checksumMismatches.push("manifest: logical archive checksum mismatch");
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Archive parsing failed.");
  }
  const sourceVsRestoredCounts = manifest ? Object.entries(manifest.entityCounts).map(([table, source]) => ({ table, source, restored: tableRows(snapshot, table).length, matches: source === tableRows(snapshot, table).length })) : [];
  const relationshipChecks = manifest ? relationshipValidation(snapshot) : [];
  if (sourceVsRestoredCounts.some(item => !item.matches)) errors.push("Source-versus-restored record-count mismatch.");
  if (relationshipChecks.some(item => !item.valid)) errors.push("Relationship-integrity mismatch.");
  return { environment: "isolated-in-memory-archive-reconstruction", valid: Boolean(manifest) && !errors.length && !checksumMismatches.length, archiveChecksum: manifest?.archiveChecksum ?? "", sourceVsRestoredCounts, relationshipChecks, checksumMismatches, errors };
}

export async function createDisasterRecoveryArchive(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; a disaster-recovery archive cannot be created.");
  const exportId = `dr-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().replaceAll("-", "").slice(0, 16)}`;
  const snapshot = await db.transaction(async tx => collectSnapshot(tx, userId));
  const { manifest, archiveBytes } = createArchive(snapshot, exportId);
  const retentionUntil = new Date(Date.now() + DISASTER_RECOVERY_RETENTION_DAYS * 24 * 60 * 60_000);
  const verification = validateDisasterRecoveryArchive(archiveBytes);
  if (!verification.valid) throw new Error(`Archive validation failed before storage: ${[...verification.errors, ...verification.checksumMismatches].join("; ")}`);
  await db.insert(disasterRecoveryArchives).values({ userId, exportId, status: "creating", archiveFormat: manifest.archiveFormat, archiveVersion: manifest.archiveVersion, applicationVersion: manifest.applicationVersion, schemaVersion: manifest.schemaVersion, datasetVersions: manifest.datasetVersions, manifest, componentChecksums: Object.fromEntries(manifest.components.map(component => [component.path, component.checksum])), archiveChecksum: manifest.archiveChecksum, archiveSizeBytes: archiveBytes.byteLength, storageKey: null, storageUrl: null, retentionUntil, verification: null, errorMessage: null });
  const created = (await db.select().from(disasterRecoveryArchives).where(eq(disasterRecoveryArchives.exportId, exportId)).limit(1))[0];
  if (!created) throw new Error("Backup metadata persistence failed.");
  try {
    const stored = await storagePut(`disaster-recovery/${userId}/${exportId}.zip`, Buffer.from(archiveBytes), "application/zip");
    await db.update(disasterRecoveryArchives).set({ status: "verified", storageKey: stored.key, storageUrl: null, verification, verifiedAt: new Date() }).where(eq(disasterRecoveryArchives.id, created.id));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Archive storage failed.";
    await db.update(disasterRecoveryArchives).set({ status: "failed", errorMessage }).where(eq(disasterRecoveryArchives.id, created.id));
    throw error;
  }
  return getDisasterRecoveryArchive(userId, created.id);
}

export async function listDisasterRecoveryArchives(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  return db.select().from(disasterRecoveryArchives).where(eq(disasterRecoveryArchives.userId, userId)).orderBy(desc(disasterRecoveryArchives.createdAt));
}

export async function getDisasterRecoveryArchive(userId: number, archiveId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const archive = (await db.select().from(disasterRecoveryArchives).where(eq(disasterRecoveryArchives.id, archiveId)).limit(1))[0];
  if (!archive || archive.userId !== userId) throw new Error("Disaster-recovery archive not found.");
  return archive;
}

export async function getDisasterRecoveryArchiveDownload(userId: number, archiveId: number) {
  const archive = await getDisasterRecoveryArchive(userId, archiveId);
  if (archive.status !== "verified" || !archive.storageKey) throw new Error("A verified stored archive is not available for download.");
  return { exportId: archive.exportId, filename: `${archive.exportId}.zip`, url: await storageGetSignedUrl(archive.storageKey), expires: "provider-signed URL" };
}
