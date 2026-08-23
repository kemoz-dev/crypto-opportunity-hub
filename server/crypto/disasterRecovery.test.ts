import { createHash } from "node:crypto";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({ getDb: vi.fn(), storagePut: vi.fn(), storageGetSignedUrl: vi.fn() }));
vi.mock("../db", () => ({ getDb: hoisted.getDb }));
vi.mock("../storage", () => ({ storagePut: hoisted.storagePut, storageGetSignedUrl: hoisted.storageGetSignedUrl }));

import { calculateDisasterRecoveryLogicalChecksum, getDisasterRecoveryArchive, validateDisasterRecoveryArchive } from "./disasterRecovery";

const checksum = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");

function fixture({ tamper = false } = {}) {
  const asset = strToU8(JSON.stringify([{ id: "bitcoin", symbol: "BTC" }]));
  const schema = strToU8(JSON.stringify({ assets: "CREATE TABLE assets (...)" }));
  const components = [
    { path: "data/assets.json", recordCount: 1, checksum: checksum(asset), bytes: asset.byteLength },
    { path: "schema/mysql-ddl.json", recordCount: 1, checksum: checksum(schema), bytes: schema.byteLength },
  ];
  const manifest = {
    exportId: "dr-fixture", exportTimestamp: "2026-08-23T00:00:00.000Z", archiveFormat: "zip-json", archiveVersion: "crypto-opportunity-hub-dr-v1", applicationVersion: "test", schemaVersion: "test", snapshotStartedAt: "2026-08-23T00:00:00.000Z", snapshotCompletedAt: "2026-08-23T00:00:01.000Z", datasetVersions: [], components, entityCounts: { assets: 1 }, sourceProvenance: { providerEvidencePreserved: true, ingestionEvidencePreserved: true, privateRecordsScope: "owner-only", scheduleState: "configuration-only" }, portability: { portable: [], partiallyPortable: [], notPortable: [] }, archiveChecksum: calculateDisasterRecoveryLogicalChecksum(components),
  };
  return zipSync({ "data/assets.json": tamper ? strToU8(JSON.stringify([{ id: "bitcoin", symbol: "BTC", tampered: true }])) : asset, "schema/mysql-ddl.json": schema, "manifest.json": strToU8(JSON.stringify(manifest)) });
}

describe("disaster recovery archive validation", () => {
  it("validates checksums, source-to-restored counts, and dependency relationships in an isolated archive reconstruction", () => {
    const result = validateDisasterRecoveryArchive(fixture());
    expect(result.valid).toBe(true);
    expect(result.sourceVsRestoredCounts).toContainEqual({ table: "assets", source: 1, restored: 1, matches: true });
    expect(result.relationshipChecks.every(check => check.valid)).toBe(true);
    expect(result.checksumMismatches).toEqual([]);
  });

  it("reports a checksum mismatch instead of silently accepting altered archive data", () => {
    const result = validateDisasterRecoveryArchive(fixture({ tamper: true }));
    expect(result.valid).toBe(false);
    expect(result.checksumMismatches).toContain("data/assets.json: checksum mismatch");
  });

  it("rejects cross-user archive retrieval", async () => {
    hoisted.getDb.mockResolvedValue({ select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ id: 9, userId: 1 }] }) }) }) });
    await expect(getDisasterRecoveryArchive(2, 9)).rejects.toThrow("Disaster-recovery archive not found.");
  });
});
