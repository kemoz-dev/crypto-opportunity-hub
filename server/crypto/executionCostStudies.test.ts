import { beforeEach, describe, expect, it, vi } from "vitest";
import { alerts, assets, executionCostModels, executionCostStudies, historicalCandles, historicalDatasets, historicalFundingRates, historicalLiquidityObservations, historicalMarketCaps, paperTrades, userSettings } from "../../drizzle/schema";

const hoisted = vi.hoisted(() => ({ getDb: vi.fn(), fetchFunding: vi.fn() }));
vi.mock("../db", () => ({ getDb: hoisted.getDb }));
vi.mock("./providers", () => ({ fetchBinanceHistoricalFundingRates: hoisted.fetchFunding }));

import { createExecutionCostStudy, previewExecutionCostStudy } from "./executionCostStudies";

const entryAt = 1_700_000_000_000;
const dataset = { id: 300001, version: "DATASET-2026-08-22-004", status: "sealed", sealedAt: new Date(entryAt + 9_000_000), ingestionCutoffAt: new Date(entryAt + 9_000_000), contentFingerprint: "d".repeat(64) };
const asset = { id: "bitcoin", binanceSymbol: "BTCUSDT" };
const candles = [
  { id: 1, openTime: entryAt - 3_600_000, closeTime: entryAt - 1, close: 100, volume: 1_000, ingestedAt: new Date(entryAt) },
  { id: 2, openTime: entryAt, closeTime: entryAt + 3_599_999, close: 110, volume: 900, ingestedAt: new Date(entryAt) },
];

function createDb(inserted: unknown[]) {
  return {
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          limit: async () => table === historicalDatasets ? [dataset] : table === assets ? [asset] : [],
          orderBy: () => table === historicalCandles ? candles : table === historicalFundingRates ? [] : { limit: async () => [] },
        }),
      }),
    }),
    insert: (table: unknown) => ({ values: async (values: unknown) => { inserted.push({ table, values }); } }),
  };
}

describe("Execution Cost Lab study service", () => {
  beforeEach(() => vi.resetAllMocks());

  it("keeps an ACTUAL-funding preview read-only when no cached evidence exists", async () => {
    const inserted: unknown[] = [];
    hoisted.getDb.mockResolvedValue(createDb(inserted));
    const preview = await previewExecutionCostStudy({
      name: "Read-only preview",
      datasetId: dataset.id,
      assetId: "bitcoin",
      timeframe: "1h",
      instrumentType: "perpetual",
      side: "long",
      entryAt,
      exitAt: entryAt + 3_600_000,
      tradeSizeUsd: 10_000,
      fee: { entryKind: "taker", entryPercent: 0.1, exitKind: "taker", exitPercent: 0.1, source: "Declared scenario" },
      slippage: { entryBps: 5, exitBps: 5, source: "Declared scenario" },
      liquidityImpact: { enabled: true, lookbackHours: 24, participationCoefficient: 0.5, capBps: 100, source: "Estimated OHLCV impact" },
      funding: { mode: "ACTUAL", assumedPercent: null, source: null },
    });
    expect(hoisted.fetchFunding).not.toHaveBeenCalled();
    expect(inserted).toEqual([]);
    expect(preview.state.funding).toMatchObject({ status: "UNAVAILABLE", recordCount: 0 });
    expect(preview.outcome.netReturnPercent).toBeNull();
    expect(preview.outcome.limitations.join(" ")).toContain("Persist a study");
  });

  it("does not replace a missing historical market-cap fact with a live value in liquidity evidence", async () => {
    const inserted: unknown[] = [];
    hoisted.getDb.mockResolvedValue(createDb(inserted));
    const preview = await previewExecutionCostStudy({
      name: "Spot preview",
      datasetId: dataset.id,
      assetId: "bitcoin",
      timeframe: "1h",
      instrumentType: "spot",
      side: "long",
      entryAt,
      exitAt: entryAt + 3_600_000,
      tradeSizeUsd: 1_000,
      fee: { entryKind: "taker", entryPercent: 0.1, exitKind: "taker", exitPercent: 0.1, source: "Declared scenario" },
      slippage: { entryBps: 0, exitBps: 0, source: "Declared scenario" },
      liquidityImpact: { enabled: false, lookbackHours: 24, participationCoefficient: 0, capBps: 0, source: "None" },
      funding: { mode: "EXCLUDED", assumedPercent: null, source: null },
    });
    expect(preview.state.entryLiquidity.marketCap).toBeNull();
    expect(preview.outcome.funding).toMatchObject({ mode: "EXCLUDED", amountUsd: 0 });
    expect(preview.outcome.netReturnPercent).not.toBeNull();
  });

  it("persists an immutable completed study with public funding provenance and never touches scoring, alert, or trading tables", async () => {
    const inserted: Array<{ table: unknown; values: unknown }> = [];
    const updates: Array<{ table: unknown; values: unknown }> = [];
    const modelRow = { id: 71 };
    const studyRow = { id: 81 };
    const db = {
      select: () => ({
        from: (table: unknown) => ({
          where: () => ({
            limit: async () => table === historicalDatasets ? [dataset] : table === assets ? [asset] : table === executionCostModels ? inserted.some(item => item.table === executionCostModels) ? [modelRow] : [] : table === historicalLiquidityObservations ? [] : [],
            orderBy: () => table === historicalCandles ? candles : table === historicalMarketCaps ? { limit: async () => [] } : table === historicalFundingRates ? [] : table === executionCostStudies ? { limit: async () => [studyRow] } : { limit: async () => [] },
          }),
        }),
      }),
      insert: (table: unknown) => ({ values: (values: unknown) => { inserted.push({ table, values }); return { onDuplicateKeyUpdate: async () => undefined }; } }),
      update: (table: unknown) => ({ set: (values: unknown) => ({ where: async () => { updates.push({ table, values }); } }) }),
    };
    hoisted.getDb.mockResolvedValue(db);
    hoisted.fetchFunding.mockResolvedValue([{ symbol: "BTCUSDT", fundingRate: 0.0001, fundingTime: entryAt + 1_800_000, markPrice: 105, rateType: "Regular" }]);
    const result = await createExecutionCostStudy(7, {
      name: "Persisted funding study",
      datasetId: dataset.id,
      assetId: "bitcoin",
      timeframe: "1h",
      instrumentType: "perpetual",
      side: "long",
      entryAt,
      exitAt: entryAt + 3_600_000,
      tradeSizeUsd: 10_000,
      fee: { entryKind: "taker", entryPercent: 0.1, exitKind: "taker", exitPercent: 0.1, source: "Declared scenario" },
      slippage: { entryBps: 5, exitBps: 5, source: "Declared scenario" },
      liquidityImpact: { enabled: true, lookbackHours: 24, participationCoefficient: 0.5, capBps: 100, source: "Estimated OHLCV impact" },
      funding: { mode: "ACTUAL", assumedPercent: null, source: null },
    });
    expect(result).toMatchObject({ id: 81, status: "completed" });
    expect(hoisted.fetchFunding).toHaveBeenCalledWith("BTCUSDT", entryAt, entryAt + 3_600_000);
    expect(inserted.some(item => item.table === executionCostModels)).toBe(true);
    expect(inserted.some(item => item.table === executionCostStudies)).toBe(true);
    expect(inserted.some(item => item.table === historicalFundingRates)).toBe(true);
    expect(inserted.some(item => item.table === historicalLiquidityObservations)).toBe(true);
    expect(updates).toEqual(expect.arrayContaining([expect.objectContaining({ table: executionCostStudies, values: expect.objectContaining({ status: "completed" }) })]));
    expect(inserted.some(item => [alerts, paperTrades, userSettings].includes(item.table as never))).toBe(false);
    expect(updates.some(item => [alerts, paperTrades, userSettings].includes(item.table as never))).toBe(false);
  });
});
