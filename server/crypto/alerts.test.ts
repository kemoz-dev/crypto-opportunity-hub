import { describe, expect, it } from "vitest";
import { qualifiesForAlert } from "./alerts";

const conditions = { minimumOpportunity: 75, minimumConfidence: 70, minimumTechnical: 26, assetIds: ["bitcoin"], cooldownMinutes: 15 };

describe("explainable alert qualification", () => {
  it("requires every configured score threshold and asset scope to pass", () => {
    expect(qualifiesForAlert({ score: 82, confidence: 79, technicalScore: 28 }, "bitcoin", conditions)).toBe(true);
    expect(qualifiesForAlert({ score: 74, confidence: 79, technicalScore: 28 }, "bitcoin", conditions)).toBe(false);
    expect(qualifiesForAlert({ score: 82, confidence: 69, technicalScore: 28 }, "bitcoin", conditions)).toBe(false);
    expect(qualifiesForAlert({ score: 82, confidence: 79, technicalScore: 25 }, "bitcoin", conditions)).toBe(false);
    expect(qualifiesForAlert({ score: 82, confidence: 79, technicalScore: 28 }, "ethereum", conditions)).toBe(false);
  });

  it("allows any tracked asset when the user leaves the asset scope empty", () => {
    expect(qualifiesForAlert({ score: 82, confidence: 79, technicalScore: 28 }, "ethereum", { ...conditions, assetIds: [] })).toBe(true);
  });
});
