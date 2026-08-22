import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDb, createHistoricalDataset, ingestHistoricalCandleBatch, sealHistoricalDataset, fetchBinanceHistoricalArchiveRange, resolveEnabledUniverseAssets, findOpenScopeIssues, appendHistoricalIssueEvent, recordHistoricalIngestionIssue } = vi.hoisted(() => ({ getDb: vi.fn(), createHistoricalDataset: vi.fn(), ingestHistoricalCandleBatch: vi.fn(), sealHistoricalDataset: vi.fn(), fetchBinanceHistoricalArchiveRange: vi.fn(), resolveEnabledUniverseAssets: vi.fn(), findOpenScopeIssues: vi.fn(), appendHistoricalIssueEvent: vi.fn(), recordHistoricalIngestionIssue: vi.fn() }));
vi.mock("../db", () => ({ getDb }));
vi.mock("./historicalData", () => ({ createHistoricalDataset, ingestHistoricalCandleBatch, sealHistoricalDataset, timeframeMs: { "15m": 900_000, "1h": 3_600_000, "4h": 14_400_000, "1d": 86_400_000 } }));
vi.mock("./providers", () => ({ fetchBinanceHistoricalArchiveRange }));
vi.mock("./marketUniverse", () => ({ resolveEnabledUniverseAssets }));
vi.mock("./ingestionObservability", () => ({ findOpenScopeIssues, appendHistoricalIssueEvent, recordHistoricalIngestionIssue }));

import { runHistoricalIncremental } from "./historicalIngestion";

function incrementalDb() {
  const results = [[{ id: 300001, status: "sealed", sealedAt: new Date("2026-08-01T00:00:00Z") }], []];
  return { select: vi.fn(() => ({ from: () => ({ where: () => ({ orderBy: () => ({ limit: async () => results.shift() ?? [] }), limit: async () => results.shift() ?? [] }) }) })) };
}

describe("scheduled incremental retry lineage", () => {
  beforeEach(() => vi.resetAllMocks());

  it("keeps the prior sealed dataset immutable and passes the unresolved issue's nonzero retry attempt into a duplicate-safe recovery batch", async () => {
    getDb.mockResolvedValue(incrementalDb());
    resolveEnabledUniverseAssets.mockResolvedValue([{ id: "pepe", binanceSymbol: "PEPEUSDT" }]);
    createHistoricalDataset.mockResolvedValue({ id: 300002, version: "DATASET-2026-08-23-001" });
    findOpenScopeIssues.mockResolvedValue([{ id: 77, nextRetryAttempt: 1 }]);
    fetchBinanceHistoricalArchiveRange.mockResolvedValue({ source: "Binance public archive", candles: [{ openTime: 1, closeTime: 900_000, open: 1, high: 2, low: 1, close: 2, volume: 3 }], requestedMonths: ["2026-08"], unavailableMonths: [], dailyFallbackDays: ["2026-08-22"], unavailableDays: [] });
    ingestHistoricalCandleBatch.mockResolvedValue({ runId: 88, insertedCount: 0, duplicateCount: 1, malformedCount: 0, gaps: [], quality: "COMPLETE" });
    sealHistoricalDataset.mockResolvedValue({ contentFingerprint: "new-immutable-fingerprint" });

    const result = await runHistoricalIncremental({ notes: "scheduled recovery", assetIds: ["pepe"], timeframes: ["15m"], instrumentType: "perpetual", endAt: Date.parse("2026-08-23T00:00:00Z"), lookbackDays: 4, scheduleExecutionId: 90002 });

    expect(createHistoricalDataset).toHaveBeenCalledWith("scheduled recovery", 300001);
    expect(ingestHistoricalCandleBatch).toHaveBeenCalledWith(expect.objectContaining({ datasetId: 300002, assetId: "pepe", scheduleExecutionId: 90002, retryAttempt: 1 }), "incremental", expect.any(Array), expect.any(Number), expect.any(Number), expect.any(Object));
    expect(result.completedScopes).toEqual([expect.objectContaining({ assetId: "pepe", retryAttempt: 1, insertedCount: 0, duplicateCount: 1 })]);
    expect(result.failedScopes).toEqual([]);
    expect(recordHistoricalIngestionIssue).not.toHaveBeenCalled();
    expect(appendHistoricalIssueEvent).not.toHaveBeenCalled();
    expect(sealHistoricalDataset).toHaveBeenCalledWith(300002);
  });
});
