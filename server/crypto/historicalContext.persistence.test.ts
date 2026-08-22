import { beforeEach, describe, expect, it, vi } from "vitest";
import { historicalAssetAvailability, historicalMarketCaps, historicalRegimeSnapshots, historicalSectorSnapshots } from "../../drizzle/schema";

const { getDb } = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("../db", () => ({ getDb }));
import { inheritHistoricalDatasetContext } from "./historicalContext";

describe("historical context inheritance persistence", () => {
  beforeEach(() => vi.resetAllMocks());

  it("copies only immutable predecessor context into the target dataset with explicit lineage", async () => {
    const inserted: Array<{ table: unknown; values: unknown }> = [];
    const selected = [
      [{ assetId: "bitcoin", provider: "CoinGecko", sourceObservedAt: new Date("2026-07-01"), marketCap: 1, circulatingSupply: null, availability: "AVAILABLE", retrievalAt: new Date("2026-08-01"), sourcePayload: { timestampMs: 1 } }],
      [{ timeframe: "1h", observedAt: new Date("2026-07-01"), classification: "RISK ON", regimeScore: 1, inputs: { btcTrend24hPercent: 2 }, definitionVersion: "V1", availability: "AVAILABLE", source: "archive", freshnessAt: new Date("2026-07-01") }],
      [{ assetId: "bitcoin", observedAt: new Date("2026-07-01"), sector: null, sectorMomentum: null, sectorRank: null, relativeStrengthVsSector: null, relativeStrengthVsBtc: null, definitionVersion: "V1", availability: "UNAVAILABLE", source: "no source", freshnessAt: null }],
      [{ assetId: "bitcoin", listingAt: null, delistingAt: null, availability: "UNAVAILABLE", source: "archive", notes: "Survivorship limitation." }],
    ];
    let call = 0;
    const db = {
      select: () => ({ from: () => ({ where: async () => selected[call++] }) }),
      insert: (table: unknown) => ({ values: (values: unknown) => ({ onDuplicateKeyUpdate: async () => { inserted.push({ table, values }); } }) }),
    };
    getDb.mockResolvedValue(db);
    const result = await inheritHistoricalDatasetContext(10, 11);
    expect(result).toMatchObject({ marketCaps: 1, regimes: 1, sectors: 1, availability: 1, inheritedFromDatasetId: 10 });
    expect(inserted.map(entry => entry.table)).toEqual([historicalMarketCaps, historicalRegimeSnapshots, historicalSectorSnapshots, historicalAssetAvailability]);
    expect(inserted[0].values).toMatchObject([{ datasetId: 11, sourcePayload: { inheritedFromDatasetId: 10 } }]);
    expect(inserted[1].values).toMatchObject([{ datasetId: 11, inputs: { inheritedFromDatasetId: 10 } }]);
    expect(inserted[2].values).toMatchObject([{ datasetId: 11, availability: "UNAVAILABLE" }]);
    expect(inserted[3].values).toMatchObject([{ datasetId: 11, notes: expect.stringContaining("Inherited from dataset 10") }]);
  });
});
