import { describe, expect, it } from "vitest";
import { qualifiesForAlert } from "./alerts";

const conditions = { minimumOpportunity: 75, minimumConfidence: 70, minimumTechnical: 26, assetIds: ["bitcoin"], cooldownMinutes: 15, requireNotRiskOff: false, requireBullishSetup: false, notificationEnabled: false };
const bullishScore = { score: 82, confidence: 79, technicalScore: 28, direction: "bullish" as const, technicalByTimeframe: [{ timeframe: "4h" as const, bias: "bullish" as const }] };

describe("explainable alert qualification", () => {
  it("requires every configured score threshold and asset scope to pass", () => {
    expect(qualifiesForAlert(bullishScore, "bitcoin", conditions, "RISK ON")).toBe(true);
    expect(qualifiesForAlert({ ...bullishScore, score: 74 }, "bitcoin", conditions, "RISK ON")).toBe(false);
    expect(qualifiesForAlert({ ...bullishScore, confidence: 69 }, "bitcoin", conditions, "RISK ON")).toBe(false);
    expect(qualifiesForAlert({ ...bullishScore, technicalScore: 25 }, "bitcoin", conditions, "RISK ON")).toBe(false);
    expect(qualifiesForAlert(bullishScore, "ethereum", conditions, "RISK ON")).toBe(false);
  });

  it("allows any tracked asset when the user leaves the asset scope empty", () => {
    expect(qualifiesForAlert(bullishScore, "ethereum", { ...conditions, assetIds: [] }, "RISK ON")).toBe(true);
  });

  it("enforces non–Risk Off, bullish-setup, and selected-timeframe constraints", () => {
    const strict = { ...conditions, assetIds: [], requireNotRiskOff: true, requireBullishSetup: true, requiredTimeframe: "4h" as const, notificationEnabled: true };
    expect(qualifiesForAlert(bullishScore, "bitcoin", strict, "RISK ON")).toBe(true);
    expect(qualifiesForAlert(bullishScore, "bitcoin", strict, "RISK OFF")).toBe(false);
    expect(qualifiesForAlert({ ...bullishScore, direction: "neutral" }, "bitcoin", strict, "RISK ON")).toBe(false);
    expect(qualifiesForAlert({ ...bullishScore, technicalByTimeframe: [{ timeframe: "4h", bias: "neutral" }] }, "bitcoin", strict, "RISK ON")).toBe(false);
  });
});
