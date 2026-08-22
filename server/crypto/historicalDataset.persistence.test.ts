import { beforeEach, describe, expect, it, vi } from "vitest";
import { historicalDataQuality, historicalDatasets, historicalIngestionRuns, historicalMissingIntervals } from "../../drizzle/schema";

const { getDb } = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("../db", () => ({ getDb }));
import { createHistoricalDataset, sealHistoricalDataset } from "./historicalData";

describe("historical dataset versioning and sealing", () => {
  beforeEach(() => { vi.resetAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-08-22T00:00:00.000Z")); });

  it("creates a versioned building dataset and seals it with a deterministic manifest fingerprint", async () => {
    const inserts: Array<{ table: unknown; values: unknown }> = [];
    const updates: Array<{ table: unknown; values: unknown }> = [];
    let selection = 0;
    const qualityRows = [{ assetId: "bitcoin", instrumentType: "perpetual", timeframe: "1h", status: "COMPLETE", earliestCandleAt: new Date("2026-07-01"), latestCandleAt: new Date("2026-08-01"), expectedCandleCount: 744, actualCandleCount: 744, missingIntervalCount: 0 }];
    const runRows = [{ batchId: "INGEST-1", status: "completed", provider: "Binance", exchange: "Binance", instrumentType: "perpetual", insertedCount: 744, malformedCount: 0, duplicateCount: 0 }];
    const db = {
      select: () => {
        const call = selection++;
        return { from: () => ({ where: () => {
          if (call === 0) return { orderBy: () => ({ limit: async () => [] }) };
          if (call === 1) return { limit: async () => [{ id: 71, version: "DATASET-2026-08-22-001" }] };
          if (call === 2) return qualityRows;
          return runRows;
        } }) };
      },
      insert: (table: unknown) => ({ values: async (values: unknown) => { inserts.push({ table, values }); } }),
      update: (table: unknown) => ({ set: (values: unknown) => ({ where: async () => { updates.push({ table, values }); } }) }),
    };
    getDb.mockResolvedValue(db);
    const created = await createHistoricalDataset("test dataset");
    expect(created).toMatchObject({ id: 71, version: "DATASET-2026-08-22-001" });
    expect(inserts).toContainEqual(expect.objectContaining({ table: historicalDatasets, values: expect.objectContaining({ version: "DATASET-2026-08-22-001", status: "building" }) }));
    const sealed = await sealHistoricalDataset(71);
    expect(sealed.contentFingerprint).toHaveLength(64);
    expect(updates).toContainEqual(expect.objectContaining({ table: historicalDatasets, values: expect.objectContaining({ status: "sealed", contentFingerprint: sealed.contentFingerprint }) }));
    expect(inserts.every(entry => entry.table === historicalDatasets)).toBe(true);
    expect([historicalDataQuality, historicalIngestionRuns]).toEqual([historicalDataQuality, historicalIngestionRuns]);
  });

  it("branches from a predecessor while preserving immutable quality and gap lineage", async () => {
    const inserts: Array<{ table: unknown; values: unknown }> = [];
    let selection = 0;
    const inheritedQuality = { assetId: "bitcoin", exchange: "Binance", provider: "archive", instrumentType: "perpetual", timeframe: "15m", status: "STALE", earliestCandleAt: new Date("2026-07-01"), latestCandleAt: new Date("2026-08-01"), expectedCandleCount: 100, actualCandleCount: 100, missingIntervalCount: 0, duplicateCount: 0, malformedCount: 0, lastSuccessfulIngestionAt: new Date("2026-08-01"), lastIngestionRunId: 3, freshnessThresholdMs: 1_800_000, details: { sourceScope: "predecessor" } };
    const inheritedGap = { assetId: "bitcoin", exchange: "Binance", instrumentType: "perpetual", timeframe: "15m", gapStartMs: 1, gapEndMs: 2, expectedMissingCount: 1 };
    const db = {
      select: () => {
        const call = selection++;
        return { from: () => ({ where: () => {
          if (call === 0) return { orderBy: () => ({ limit: async () => [{ version: "DATASET-2026-08-22-005" }] }) };
          if (call === 1) return { limit: async () => [{ id: 72, version: "DATASET-2026-08-22-006" }] };
          if (call === 2) return [inheritedQuality];
          return [inheritedGap];
        } }) };
      },
      insert: (table: unknown) => ({ values: async (values: unknown) => { inserts.push({ table, values }); } }),
    };
    getDb.mockResolvedValue(db);
    const created = await createHistoricalDataset("incremental branch", 33);
    expect(created).toMatchObject({ id: 72, version: "DATASET-2026-08-22-006" });
    expect(inserts).toContainEqual(expect.objectContaining({ table: historicalDatasets, values: expect.objectContaining({ basedOnDatasetId: 33 }) }));
    expect(inserts).toContainEqual(expect.objectContaining({ table: historicalDataQuality, values: [expect.objectContaining({ datasetId: 72, details: expect.objectContaining({ inheritedFromDatasetId: 33 }) })] }));
    expect(inserts).toContainEqual(expect.objectContaining({ table: historicalMissingIntervals, values: [expect.objectContaining({ datasetId: 72, gapStartMs: 1, expectedMissingCount: 1 })] }));
  });
});
