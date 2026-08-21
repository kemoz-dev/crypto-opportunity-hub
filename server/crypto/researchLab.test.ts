import { describe, expect, it } from "vitest";
import type { ResearchExperimentInput, ResearchSignal } from "./researchLab";
import { buildResearchResultRows, calculateResearchMetrics } from "./researchLab";

const input: ResearchExperimentInput = { name: "Unit test study", experimentId: "C", assetIds: [], timeframe: "1h", candleLimit: 1_000, minimumOpportunity: 70, minimumConfidence: 70, holdingBars: 24, riskPercent: 1, stopAtrMultiplier: 1.5, takeProfitRule: "risk-reward", targetRiskReward: 2, trainPercent: 70, regime: "ALL" };

function signal(index: number, overrides: Partial<ResearchSignal> = {}): ResearchSignal {
  const positionReturnPercent = index % 3 === 0 ? -1 : 2;
  return { assetId: index % 2 ? "ethereum" : "bitcoin", symbol: index % 2 ? "ETH" : "BTC", sector: index % 2 ? "L1" : "Large Cap", timeframe: "1h", decisionAt: index * 3_600_000, entryAt: index * 3_600_000 + 1, entryPrice: 100, exitPrice: 101, exitReason: "holding-close", returnPercent: positionReturnPercent, positionReturnPercent, rMultiple: positionReturnPercent, opportunityScore: 60 + index % 4 * 10, confidenceScore: 60 + index % 3 * 10, technicalScore: 30, relativeStrengthPercent: 1, regime: index % 3 === 0 ? "RISK OFF" : index % 3 === 1 ? "RISK ON" : "SELECTIVE", higherTimeframeConfirmed: true, outcomes: [{ label: "24H", returnPercent: positionReturnPercent }, { label: "3D", returnPercent: positionReturnPercent + 1 }], evidence: { dataCutoffAt: index * 3_600_000 }, ...overrides };
}

describe("Opportunity Research Lab calculations", () => {
  it("calculates forward outcome, drawdown, and risk metrics from chronological stored returns", () => {
    const metrics = calculateResearchMetrics([signal(0), signal(1), signal(2)]);
    expect(metrics.signalCount).toBe(3);
    expect(metrics.winRate).toBeCloseTo(66.67, 1);
    expect(metrics.averageReturn).toBe(1);
    expect(metrics.bestOutcome).toBe(2);
    expect(metrics.worstOutcome).toBe(-1);
    expect(metrics.maximumDrawdown).toBeGreaterThan(0);
    expect(metrics.sharpeRatio).toBeNull();
    expect(metrics.outcomeHorizons.find(item => item.label === "24H")?.observationCount).toBe(3);
  });

  it("uses fixed thresholds and score/confidence buckets rather than tuning the observed sample", () => {
    const rows = buildResearchResultRows(Array.from({ length: 40 }, (_, index) => signal(index)), input).rows;
    expect(rows.filter(row => row.dimension === "opportunity_threshold").map(row => row.dimensionKey)).toEqual(["OPP_60", "OPP_70", "OPP_80", "OPP_90"]);
    expect(rows.filter(row => row.dimension === "confidence_threshold").map(row => row.dimensionKey)).toEqual(["CONF_60", "CONF_70", "CONF_80"]);
    expect(rows.filter(row => row.dimension === "score_bucket").map(row => row.dimensionKey)).toEqual(["60-69", "70-79", "80-89", "90-100"]);
    expect(rows.filter(row => row.dimension === "confidence_bucket").map(row => row.dimensionKey)).toEqual(["60-69", "70-79", "80-89", "90-100"]);
  });

  it("creates an ordered time split and retains regime and sector segmentation from decision-time signal records", () => {
    const output = buildResearchResultRows(Array.from({ length: 40 }, (_, index) => signal(index)), input);
    expect(output.timeSplit).toEqual({ trainPercent: 70, inSampleSignals: 14, outOfSampleSignals: 6 });
    expect(output.splitAt).toBe(29 * 3_600_000 + 1);
    expect(output.rows.find(row => row.dimension === "regime" && row.dimensionKey === "RISK ON")?.signalCount).toBeGreaterThan(0);
    expect(output.rows.find(row => row.dimension === "sector" && row.dimensionKey === "L1")?.signalCount).toBeGreaterThan(0);
  });

  it("labels small samples as insufficient rather than claiming support", () => {
    const output = buildResearchResultRows(Array.from({ length: 29 }, (_, index) => signal(index, { opportunityScore: 80, confidenceScore: 80 })), { ...input, minimumOpportunity: 80, minimumConfidence: 80 });
    expect(output.rows.find(row => row.dimension === "aggregate")?.evidenceStatus).toBe("INSUFFICIENT DATA");
    expect(output.currentBestCandidate.status).toBe("NO ROBUST WINNER IDENTIFIED");
  });
});
