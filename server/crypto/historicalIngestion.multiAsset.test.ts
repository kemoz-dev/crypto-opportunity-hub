import { beforeEach, describe, expect, it, vi } from "vitest";

const { createHistoricalDataset, ingestHistoricalCandleBatch, sealHistoricalDataset, fetchBinanceHistoricalArchiveRange, resolveEnabledUniverseAssets } = vi.hoisted(() => ({ createHistoricalDataset: vi.fn(), ingestHistoricalCandleBatch: vi.fn(), sealHistoricalDataset: vi.fn(), fetchBinanceHistoricalArchiveRange: vi.fn(), resolveEnabledUniverseAssets: vi.fn() }));
vi.mock("./historicalData", () => ({ createHistoricalDataset, ingestHistoricalCandleBatch, sealHistoricalDataset }));
vi.mock("./providers", () => ({ fetchBinanceHistoricalArchiveRange }));
vi.mock("./marketUniverse", () => ({ resolveEnabledUniverseAssets }));

import { runHistoricalBackfill } from "./historicalIngestion";

describe("multi-asset historical ingestion isolation", () => {
  beforeEach(() => vi.resetAllMocks());

  it("records a source-unavailable asset as a partial failure without discarding an independent successful asset", async () => {
    resolveEnabledUniverseAssets.mockResolvedValue([{ id: "ethereum", binanceSymbol: "ETHUSDT" }, { id: "pepe", binanceSymbol: "PEPEUSDT" }]);
    createHistoricalDataset.mockResolvedValue({ id: 300010, version: "DATASET-2026-08-22-010" });
    fetchBinanceHistoricalArchiveRange.mockImplementation(async (symbol: string) => {
      if (symbol === "PEPEUSDT") throw new Error("Binance public archive returned HTTP 404.");
      return { source: "Binance public archive", candles: [{ openTime: 1, closeTime: 900_000, open: 1, high: 2, low: 1, close: 2, volume: 3 }], requestedMonths: ["2026-08"], unavailableMonths: [], dailyFallbackDays: ["2026-08-21"], unavailableDays: [] };
    });
    ingestHistoricalCandleBatch.mockResolvedValue({ insertedCount: 1, duplicateCount: 0, malformedCount: 0, gaps: [], quality: "COMPLETE" });
    sealHistoricalDataset.mockResolvedValue({ contentFingerprint: "immutable-fingerprint" });

    const result = await runHistoricalBackfill({ notes: "partial failure test", assetIds: ["ethereum", "pepe"], timeframes: ["15m"], instrumentType: "perpetual", startAt: 1, endAt: 900_000, maximumMonths: 2 });

    expect(result).toMatchObject({ datasetId: 300010, sealed: true, completedScopes: [expect.objectContaining({ assetId: "ethereum", insertedCount: 1 })], failedScopes: [expect.objectContaining({ assetId: "pepe", timeframe: "15m" })] });
    expect(ingestHistoricalCandleBatch).toHaveBeenCalledTimes(1);
    expect(sealHistoricalDataset).toHaveBeenCalledWith(300010);
  });
});
