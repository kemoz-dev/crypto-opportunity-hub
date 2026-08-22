import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDb } = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("../db", () => ({ getDb }));

import { calculateCoverageQuality, refreshMarketUniverseCoverage, resolveEnabledUniverseAssets, seedMarketUniverseRegistry, snapshotMarketUniverse } from "./marketUniverse";

function sequencedDb(selectResults: unknown[][]) {
  const updates: Array<Record<string, unknown>> = [];
  const inserts: unknown[] = [];
  const next = () => selectResults.shift() ?? [];
  return {
    updates,
    inserts,
    select: vi.fn(() => ({
      from: () => ({
        where: () => {
          const result = Promise.resolve(next()) as Promise<unknown[]> & { limit?: () => Promise<unknown[]> };
          result.limit = () => result;
          return result;
        },
      }),
    })),
    update: vi.fn(() => ({ set: (values: Record<string, unknown>) => ({ where: async () => { updates.push(values); } }) })),
    insert: vi.fn(() => ({ values: async (values: unknown) => { inserts.push(values); } })),
  };
}

const btcRegistry = { assetId: "bitcoin", priorityTier: "TIER_1", inclusionReason: "reference", registrySector: "Large Cap", sectorClassificationStatus: "HISTORICAL_UNAVAILABLE" };
const pepeRegistry = { assetId: "pepe", priorityTier: "TIER_4", inclusionReason: "candidate", registrySector: "Meme", sectorClassificationStatus: "HISTORICAL_UNAVAILABLE" };
const btcQuality = { assetId: "bitcoin", expectedCandleCount: 100, actualCandleCount: 100, earliestCandleAt: new Date("2026-01-01T00:00:00Z"), latestCandleAt: new Date("2026-01-05T00:00:00Z"), missingIntervalCount: 0, longestGapMs: 0, qualityScore: 100, qualityRating: "HIGH" };

describe("market universe quality and immutable membership", () => {
  beforeEach(() => vi.resetAllMocks());

  it("seeds every representative registry candidate through idempotent asset and registry upserts", async () => {
    const inserts: unknown[] = [];
    const db = { insert: vi.fn(() => ({ values: (values: unknown) => ({ onDuplicateKeyUpdate: async () => { inserts.push(values); } }) })) };
    getDb.mockResolvedValue(db);

    await expect(seedMarketUniverseRegistry()).resolves.toEqual({ seeded: 20 });
    expect(db.insert).toHaveBeenCalledTimes(40);
    expect(inserts).toHaveLength(40);
  });

  it("resolves only enabled registry candidates requested by the ingestion configuration and never creates related records", async () => {
    const db = sequencedDb([[{ assetId: "bitcoin", priorityTier: "TIER_1", registrySector: "Large Cap", exchangeIdentifiers: { binance: { perpetual: "BTCUSDT" } } }, { assetId: "unsupported", priorityTier: "TIER_4", registrySector: "Meme", exchangeIdentifiers: { binance: {} } }]]);
    getDb.mockResolvedValue(db);

    await expect(resolveEnabledUniverseAssets(["bitcoin", "unsupported"])).resolves.toEqual([{ id: "bitcoin", binanceSymbol: "BTCUSDT", priorityTier: "TIER_1", registrySector: "Large Cap" }]);
    expect(db.inserts).toEqual([]);
    expect(db.updates).toEqual([]);
  });

  it("calculates data quality independently from opportunity scoring and treats missing scopes as unavailable", () => {
    expect(calculateCoverageQuality({ expected: 100, actual: 100, missing: 0, longestGapMs: 0, timeframeMs: 60 * 60_000, duplicates: 0, malformed: 0, stale: false, providerState: "completed" })).toEqual({ coveragePercent: 100, qualityScore: 100, qualityRating: "HIGH" });
    expect(calculateCoverageQuality({ expected: 0, actual: 0, missing: 0, longestGapMs: 0, timeframeMs: 60 * 60_000, duplicates: 0, malformed: 0, stale: true, providerState: "unknown" })).toEqual({ coveragePercent: 0, qualityScore: 0, qualityRating: "UNAVAILABLE" });
  });

  it("refreshes registry observation and coverage statuses only from the selected dataset evidence", async () => {
    const db = sequencedDb([[btcRegistry, pepeRegistry], [btcQuality], [{ assetId: "bitcoin", availability: "AVAILABLE" }]]);
    getDb.mockResolvedValue(db);

    await refreshMarketUniverseCoverage(300001);

    expect(db.updates).toHaveLength(2);
    expect(db.updates[0]).toMatchObject({ ohlcvCoverageStatus: "AVAILABLE", marketCapCoverageStatus: "AVAILABLE", dataQualityStatus: "HIGH", firstObservedAt: btcQuality.earliestCandleAt, lastObservedAt: btcQuality.latestCandleAt });
    expect(db.updates[1]).toMatchObject({ ohlcvCoverageStatus: "UNAVAILABLE", marketCapCoverageStatus: "UNAVAILABLE", dataQualityStatus: "UNAVAILABLE", firstObservedAt: null, lastObservedAt: null });
  });

  it("snapshots a current-survivor registry with explicit missing PEPE and historical-sector-unavailable evidence", async () => {
    const snapshot = { id: 60001, datasetId: 300001 };
    const db = sequencedDb([[], [btcRegistry, pepeRegistry], [btcQuality], [{ assetId: "bitcoin", availability: "AVAILABLE" }], [snapshot]]);
    getDb.mockResolvedValue(db);

    const result = await snapshotMarketUniverse(300001);

    expect(result).toEqual(snapshot);
    expect(db.inserts).toHaveLength(2);
    const members = db.inserts[1] as Array<Record<string, unknown>>;
    expect(members).toEqual(expect.arrayContaining([
      expect.objectContaining({ assetId: "bitcoin", ohlcvStatus: "AVAILABLE", marketCapStatus: "AVAILABLE", dataQualityStatus: "HIGH", sectorClassificationStatus: "HISTORICAL_UNAVAILABLE" }),
      expect.objectContaining({ assetId: "pepe", ohlcvStatus: "UNAVAILABLE", marketCapStatus: "UNAVAILABLE", dataQualityStatus: "UNAVAILABLE", sectorClassificationStatus: "HISTORICAL_UNAVAILABLE" }),
    ]));
  });

  it("never replaces an existing immutable snapshot for the same dataset", async () => {
    const existing = { id: 60001, datasetId: 300001, universeKind: "CURRENT_SURVIVOR_UNIVERSE" };
    const db = sequencedDb([[existing]]);
    getDb.mockResolvedValue(db);

    await expect(snapshotMarketUniverse(300001)).resolves.toEqual(existing);
    expect(db.inserts).toEqual([]);
    expect(db.updates).toEqual([]);
  });
});
