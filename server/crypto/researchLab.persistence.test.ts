import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SCORING_CONFIG, type Candle } from "../../shared/crypto";
import { alerts, paperTrades, researchExperimentResults, researchExperiments, userSettings } from "../../drizzle/schema";

const hoisted = vi.hoisted(() => ({ getDb: vi.fn(), fetchBinanceCandlesForResearch: vi.fn() }));
vi.mock("../db", () => ({ getDb: hoisted.getDb }));
vi.mock("./providers", () => ({ fetchBinanceCandlesForResearch: hoisted.fetchBinanceCandlesForResearch }));

import { exportResearchExperiment, runResearchExperiment } from "./researchLab";

function candles(count: number): Candle[] {
  return Array.from({ length: count }, (_, index) => {
    const close = 100 + index * 0.16 + Math.sin(index / 4) * 1.5;
    return { openTime: index * 3_600_000, closeTime: (index + 1) * 3_600_000 - 1, open: close - 0.2, high: close + 1, low: close - 1, close, volume: 1_000 + (index % 11) * 130 };
  });
}

describe("Research Lab immutable experiment persistence", () => {
  beforeEach(() => vi.resetAllMocks());

  it("persists exact configuration, source provenance, result snapshot, and segmented result rows", async () => {
    const inserted: Array<{ table: unknown; values: unknown }> = [];
    const updates: Array<{ table: unknown; values: unknown }> = [];
    const experiment = { id: 41, userId: 7 };
    const db = {
      insert: (table: unknown) => ({ values: async (values: unknown) => { inserted.push({ table, values }); } }),
      select: () => ({ from: () => ({ where: () => ({ orderBy: () => ({ limit: async () => [experiment] }) }) }) }),
      update: (table: unknown) => ({ set: (values: unknown) => ({ where: async () => { updates.push({ table, values }); } }) }),
    };
    hoisted.getDb.mockResolvedValue(db);
    hoisted.fetchBinanceCandlesForResearch.mockResolvedValue({ candles: candles(280), source: "Binance public archive" });
    const result = await runResearchExperiment(7, { name: "Persistence study", experimentId: "A", assetIds: ["bitcoin"], timeframe: "1h", candleLimit: 280, minimumOpportunity: 60, minimumConfidence: 60, holdingBars: 8, riskPercent: 1, stopAtrMultiplier: 1.5, takeProfitRule: "holding-close", targetRiskReward: 2, trainPercent: 70, regime: "ALL", datasetReference: { datasetId: 210001, datasetVersion: "DATASET-2026-08-22-001", datasetFingerprint: "b".repeat(64) }, modelVersion: "OPPORTUNITY_ENGINE_RESEARCH_ADAPTER_V1", instrumentType: "perpetual", costModel: { version: "RESEARCH_GROSS_ONLY_V1", treatment: "GROSS_ONLY", fundingMode: "UNAVAILABLE" } }, structuredClone(DEFAULT_SCORING_CONFIG));
    const experimentInsert = inserted.find(entry => entry.table === researchExperiments)?.values as { configurationFingerprint: string; configuration: { input: { experimentId: string }; scoringConfiguration: unknown }; datasetId: number; datasetVersion: string; datasetFingerprint: string; modelConfigurationFingerprint: string; instrumentType: string; costModel: { version: string }; dataProvenance: { selectedHistoricalDataset: { datasetId: number } | null } };
    const resultInsert = inserted.find(entry => entry.table === researchExperimentResults)?.values as Array<{ experimentId: number; dimension: string }>;
    expect(result.experimentId).toBe(41);
    expect(experimentInsert.configuration.input.experimentId).toBe("A");
    expect(experimentInsert.configuration.scoringConfiguration).toEqual(DEFAULT_SCORING_CONFIG);
    expect(experimentInsert.configurationFingerprint).toHaveLength(64);
    expect(experimentInsert).toMatchObject({ datasetId: 210001, datasetVersion: "DATASET-2026-08-22-001", datasetFingerprint: "b".repeat(64), instrumentType: "perpetual", costModel: { version: "RESEARCH_GROSS_ONLY_V1" }, dataProvenance: { selectedHistoricalDataset: { datasetId: 210001 } } });
    expect(experimentInsert.modelConfigurationFingerprint).toHaveLength(64);
    expect(resultInsert.every(row => row.experimentId === 41)).toBe(true);
    expect(resultInsert.some(row => row.dimension === "score_bucket")).toBe(true);
    const completion = updates.find(entry => entry.table === researchExperiments)?.values as { status: string; dataProvenance: { provider: string[] }; resultSnapshot: { protocol: string } };
    expect(completion.status).toBe("completed");
    expect(completion.dataProvenance.provider).toContain("Binance public archive");
    expect(completion.resultSnapshot.protocol).toBe("OPPORTUNITY_RESEARCH_LAB_V1");
    expect(inserted.some(entry => entry.table === alerts || entry.table === paperTrades || entry.table === userSettings)).toBe(false);
    expect(updates.some(entry => entry.table === alerts || entry.table === paperTrades || entry.table === userSettings)).toBe(false);
    expect(inserted.every(entry => entry.table === researchExperiments || entry.table === researchExperimentResults)).toBe(true);
    expect(updates.every(entry => entry.table === researchExperiments)).toBe(true);
  });

  it("includes persisted filter controls and full configuration in JSON and CSV exports", async () => {
    const experiment = { id: 52, userId: 7, name: "Filtered study", protocolVersion: "OPPORTUNITY_RESEARCH_LAB_V1", configurationFingerprint: "a".repeat(64), datasetId: 210001, datasetVersion: "DATASET-2026-08-22-001", datasetFingerprint: "b".repeat(64), modelConfigurationFingerprint: "c".repeat(64), instrumentType: "perpetual", costModel: { version: "RESEARCH_GROSS_ONLY_V1", treatment: "GROSS_ONLY" }, configuration: { input: { assetIds: ["bitcoin"], sector: "Large Cap", regime: "RISK ON", startAt: 1_700_000_000_000, endAt: 1_700_100_000_000, timeframe: "1h", minimumOpportunity: 80, minimumConfidence: 70, holdingBars: 24, takeProfitRule: "risk-reward", trainPercent: 70 } }, dataProvenance: { provider: ["Binance public archive"] }, dataStartAt: new Date(1_700_000_000_000), dataEndAt: new Date(1_700_100_000_000) };
    const results = [{ id: 1, dimension: "aggregate", dimensionKey: "selected", signalCount: 30, evidenceStatus: "WEAK EVIDENCE", metrics: { winRate: 40, averageReturn: 0.1, medianReturn: -1, expectancy: 0.1, profitFactor: 1.1, maximumDrawdown: 10, averageR: 0.1 }, reason: "Measured" }];
    let selectCount = 0;
    hoisted.getDb.mockResolvedValue({ select: () => ({ from: () => ({ where: () => { selectCount += 1; return selectCount === 1 ? { limit: async () => [experiment] } : results; } }) }) });
    const json = await exportResearchExperiment(7, 52, "json");
    expect(JSON.parse(json.content).configuration.input).toMatchObject({ assetIds: ["bitcoin"], sector: "Large Cap", regime: "RISK ON", timeframe: "1h" });
    selectCount = 0;
    const csv = await exportResearchExperiment(7, 52, "csv");
    expect(csv.content).toContain("configurationJson");
    expect(csv.content).toContain("datasetFingerprint");
    expect(csv.content).toContain("DATASET-2026-08-22-001");
    expect(csv.content).toContain("Large Cap");
    expect(csv.content).toContain("RISK ON");
    expect(csv.content).toContain("bitcoin");
    expect(csv.content).toContain("2023-11-14T22:13:20.000Z");
  });
});
