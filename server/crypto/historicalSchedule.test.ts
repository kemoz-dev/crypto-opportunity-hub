import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDb, runHistoricalIncremental, inheritHistoricalDatasetContext, recomputeHistoricalQuality, refreshMarketUniverseCoverage, snapshotMarketUniverse, createHistoricalScheduleExecution, finishHistoricalScheduleExecution } = vi.hoisted(() => ({ getDb: vi.fn(), runHistoricalIncremental: vi.fn(), inheritHistoricalDatasetContext: vi.fn(), recomputeHistoricalQuality: vi.fn(), refreshMarketUniverseCoverage: vi.fn(), snapshotMarketUniverse: vi.fn(), createHistoricalScheduleExecution: vi.fn(), finishHistoricalScheduleExecution: vi.fn() }));
vi.mock("../db", () => ({ getDb }));
vi.mock("./historicalIngestion", () => ({ runHistoricalIncremental }));
vi.mock("./historicalContext", () => ({ inheritHistoricalDatasetContext }));
vi.mock("./historicalData", () => ({ recomputeHistoricalQuality }));
vi.mock("./marketUniverse", () => ({ refreshMarketUniverseCoverage, snapshotMarketUniverse }));
vi.mock("./ingestionObservability", () => ({ createHistoricalScheduleExecution, finishHistoricalScheduleExecution }));

import { EXPANDED_HISTORICAL_SCHEDULES, evaluateHistoricalIngestionByTaskUid, upsertHistoricalIngestionScheduleRecord } from "./historicalSchedule";

function dbForSchedule(schedule?: Record<string, unknown>) {
  const inserts: unknown[] = [];
  const updates: Array<Record<string, unknown>> = [];
  return {
    inserts,
    updates,
    insert: vi.fn(() => ({ values: (values: unknown) => { inserts.push(values); return { onDuplicateKeyUpdate: async () => undefined }; } })),
    select: vi.fn(() => ({ from: () => ({ where: () => ({ limit: async () => schedule ? [schedule] : [] }) }) })),
    update: vi.fn(() => ({ set: (values: Record<string, unknown>) => ({ where: async () => { updates.push(values); } }) })),
  };
}

describe("tiered historical ingestion schedules", () => {
  beforeEach(() => vi.resetAllMocks());

  it("persists any expanded schedule definition with its exact task UID instead of relying on a hard-coded BTC record", async () => {
    const definition = EXPANDED_HISTORICAL_SCHEDULES.find(item => item.name === "daily-public-historical-liquid-1h");
    if (!definition) throw new Error("Expected liquid-major definition.");
    const db = dbForSchedule();
    getDb.mockResolvedValue(db);

    await upsertHistoricalIngestionScheduleRecord(definition, "liquid-task-uid");

    expect(db.inserts).toEqual([expect.objectContaining({ name: "daily-public-historical-liquid-1h", scheduleCronTaskUid: "liquid-task-uid", cronExpression: "0 52 2 * * *", configuration: definition.configuration })]);
  });

  it("resolves only the authenticated task UID and passes its persisted bounded lookback to the incremental run", async () => {
    const definition = EXPANDED_HISTORICAL_SCHEDULES.find(item => item.name === "daily-public-historical-eth-sol-15m");
    if (!definition) throw new Error("Expected ETH/SOL definition.");
    const db = dbForSchedule({ id: 42, scheduleCronTaskUid: "eth-sol-task-uid", isEnabled: true, lastRunAt: null, configuration: definition.configuration });
    getDb.mockResolvedValue(db);
    createHistoricalScheduleExecution.mockResolvedValue({ id: 90001 });
    runHistoricalIncremental.mockResolvedValue({ datasetId: 300002, basedOnDatasetId: 300001, failedScopes: [], completedScopes: [{ assetId: "ethereum", insertedCount: 12, duplicateCount: 4, missingIntervals: 0 }] });
    inheritHistoricalDatasetContext.mockResolvedValue({ inheritedFromDatasetId: 300001 });
    recomputeHistoricalQuality.mockResolvedValue({ scopesRecomputed: 10 });
    refreshMarketUniverseCoverage.mockResolvedValue({ assetsRefreshed: 20 });
    snapshotMarketUniverse.mockResolvedValue({ id: 60002 });

    await expect(evaluateHistoricalIngestionByTaskUid("eth-sol-task-uid")).resolves.toMatchObject({ status: "SUCCESS", datasetId: 300002, failedScopes: 0 });
    expect(runHistoricalIncremental).toHaveBeenCalledWith(expect.objectContaining({ assetIds: ["ethereum", "solana"], timeframes: ["15m"], instrumentType: "perpetual", maximumMonths: 2, lookbackDays: 4 }));
    expect(inheritHistoricalDatasetContext).toHaveBeenCalledWith(300001, 300002);
    expect(recomputeHistoricalQuality).toHaveBeenCalledWith(300002);
    expect(refreshMarketUniverseCoverage).toHaveBeenCalledWith(300002);
    expect(snapshotMarketUniverse).toHaveBeenCalledWith(300002);
    expect(db.updates).toEqual(expect.arrayContaining([expect.objectContaining({ lastStatus: "SUCCESS", lastDatasetId: 300002 })]));
    expect(finishHistoricalScheduleExecution).toHaveBeenCalledWith(90001, expect.objectContaining({ status: "SUCCESS", candlesInserted: 12, candlesSkipped: 4, duplicatesDetected: 4, gapsDetected: 0, assetsFailed: 0 }));
  });

  it("records a partial execution when one asset fails without recasting the independent completed asset as success-only", async () => {
    const definition = EXPANDED_HISTORICAL_SCHEDULES.find(item => item.name === "daily-public-historical-eth-sol-15m");
    if (!definition) throw new Error("Expected ETH/SOL definition.");
    const db = dbForSchedule({ id: 43, scheduleCronTaskUid: "partial-task-uid", isEnabled: true, lastRunAt: null, configuration: definition.configuration });
    getDb.mockResolvedValue(db);
    createHistoricalScheduleExecution.mockResolvedValue({ id: 90002 });
    runHistoricalIncremental.mockResolvedValue({ datasetId: 300003, basedOnDatasetId: 300002, completedScopes: [{ assetId: "ethereum", insertedCount: 3, duplicateCount: 1, missingIntervals: 2, retryAttempt: 1 }], failedScopes: [{ assetId: "solana", timeframe: "15m", error: "source unavailable", retryAttempt: 0 }] });
    inheritHistoricalDatasetContext.mockResolvedValue({});
    recomputeHistoricalQuality.mockResolvedValue({});
    refreshMarketUniverseCoverage.mockResolvedValue({});
    snapshotMarketUniverse.mockResolvedValue({ id: 60003 });

    await expect(evaluateHistoricalIngestionByTaskUid("partial-task-uid")).resolves.toMatchObject({ status: "PARTIAL", failedScopes: 1, completedScopes: 1 });
    expect(finishHistoricalScheduleExecution).toHaveBeenCalledWith(90002, expect.objectContaining({ status: "PARTIAL", assetsAttempted: 2, assetsSucceeded: 1, assetsFailed: 1, candlesInserted: 3, duplicatesDetected: 1, gapsDetected: 2, retryCount: 1, providerErrors: [expect.objectContaining({ assetId: "solana" })] }));
  });
});
