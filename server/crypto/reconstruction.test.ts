import { describe, expect, it } from "vitest";
import { classifyHistoricalRegime } from "./historicalContext";
import { calculateResearchCosts } from "./reconstruction";

describe("closed-candle historical reconstruction primitives", () => {
  it("classifies regime only from supplied completed BTC observations", () => {
    expect(classifyHistoricalRegime(102, 100).classification).toBe("RISK ON");
    expect(classifyHistoricalRegime(98, 100).classification).toBe("RISK OFF");
    expect(classifyHistoricalRegime(undefined, 100).classification).toBe("UNAVAILABLE");
  });

  it("keeps gross and net research results separate and treats unavailable perpetual funding as unavailable net", () => {
    const spot = calculateResearchCosts(10, { version: "RESEARCH_COST_MODEL_V1", instrumentType: "spot", feePercent: 0.1, slippagePercent: 0.05, funding: { mode: "EXCLUDED" } });
    expect(spot).toMatchObject({ grossReturnPercent: 10, totalCostPercent: 0.3, netReturnPercent: 9.7, fundingStatus: "EXCLUDED" });
    const perpetual = calculateResearchCosts(10, { version: "RESEARCH_COST_MODEL_V1", instrumentType: "perpetual", feePercent: 0.1, slippagePercent: 0.05, funding: { mode: "UNAVAILABLE" } });
    expect(perpetual.netReturnPercent).toBeNull();
    expect(perpetual.totalCostPercent).toBeNull();
  });
});
