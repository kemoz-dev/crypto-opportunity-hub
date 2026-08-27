import { describe, expect, it } from "vitest";
import { buildOpportunityDiscovery, buildOpportunityDiscoveryItem } from "./opportunityDiscovery";
import type { TradeSetupPlan } from "./tradeSetup";

const condition = (key: string, status: "PASSED" | "FAILED" | "UNAVAILABLE" | "STALE", detail = `${key} detail`) => ({ key, label: key, status, actual: status, required: "Existing requirement", detail });
const analysis = (timeframe: "1h" | "4h" | "1d", bias: "bullish" | "bearish" | "neutral") => ({ timeframe, bias, reasons: bias === "neutral" ? [] : [{ direction: "positive", label: `${timeframe} confirmation`, score: 1, maxScore: 1, detail: "validated fixture" }] });
const coreConditions = () => ["provider_bundle", "live_price", "freshness", "execution_analysis", "confirmation_analysis", "context_analysis"].map(key => condition(key, "PASSED"));

function plan(overrides: Record<string, unknown> = {}) {
  return {
    assetId: "bitcoin",
    symbol: "BTC",
    mode: "SWING",
    actionable: false,
    presentationStatus: "NO TRADE",
    opportunityScore: 71,
    direction: "LONG",
    provider: "Kraken Spot",
    dataTimestamp: 123,
    regimeClassification: "SELECTIVE",
    dataBundle: { provider: "Kraken Spot", state: "VALID", coherent: true, eligibleForScoring: true, statusMessage: "Validated bundle", timeframes: [] },
    timeframes: { execution: "1h", confirmation: "4h", context: "1d" },
    entryZone: null,
    stop: null,
    invalidation: null,
    targets: [],
    rewardRisk: null,
    evidence: [],
    risks: [],
    diagnostics: [...coreConditions(), condition("opportunity_direction", "PASSED"), condition("structural_stop", "PASSED"), condition("target_structure", "PASSED"), condition("risk_reward", "PASSED")],
    executionState: analysis("1h", "bullish"),
    confirmationState: analysis("4h", "bullish"),
    contextState: analysis("1d", "bullish"),
    ...overrides,
  } as unknown as TradeSetupPlan;
}

describe("Phase 8 opportunity discovery interpretation", () => {
  it("retains QUALIFIED as the only paper-trade eligible state", () => {
    const result = buildOpportunityDiscoveryItem(plan({ actionable: true, presentationStatus: "QUALIFIED", entryZone: { preferred: 100 }, stop: { price: 95 }, targets: [{ label: "TP1", price: 110 }] }));
    expect(result).toMatchObject({ status: "QUALIFIED", maturity: "QUALIFIED", tradeReadiness: "READY", paperTradeEligible: true });
  });

  it("classifies an otherwise valid directional setup with unchanged borderline R:R as POTENTIAL with no paper eligibility", () => {
    const result = buildOpportunityDiscoveryItem(plan({ diagnostics: [...coreConditions(), condition("opportunity_direction", "PASSED"), condition("structural_stop", "PASSED"), condition("target_structure", "PASSED"), { ...condition("risk_reward", "FAILED", "The first target is below the unchanged minimum."), actual: "Current R:R 0.8:1.", required: "Minimum required: 1:1 under the existing setup engine." }] }));
    expect(result).toMatchObject({ status: "POTENTIAL", maturity: "DEVELOPING", paperTradeEligible: false });
    expect(result.conditionalEntry).toContain("Conditional entry");
    expect(result.whatWouldChange.join(" ")).toContain("Current R:R 0.8:1.");
  });

  it("classifies incomplete but meaningful technical evidence as WATCH without an entry", () => {
    const result = buildOpportunityDiscoveryItem(plan({ direction: "NO TRADE", executionState: analysis("1h", "bullish"), confirmationState: analysis("4h", "neutral"), contextState: analysis("1d", "neutral"), diagnostics: [...coreConditions(), condition("opportunity_direction", "FAILED"), condition("structural_stop", "UNAVAILABLE"), condition("target_structure", "UNAVAILABLE"), condition("risk_reward", "UNAVAILABLE")] }));
    expect(result).toMatchObject({ status: "WATCH", maturity: "EARLY", paperTradeEligible: false });
    expect(result.conditionalEntry).toContain("No entry");
  });

  it("keeps invalid structural setups as NO TRADE", () => {
    const result = buildOpportunityDiscoveryItem(plan({ diagnostics: [...coreConditions(), condition("opportunity_direction", "PASSED"), condition("structural_stop", "FAILED", "The derived stop was not valid relative to the entry zone."), condition("target_structure", "UNAVAILABLE"), condition("risk_reward", "UNAVAILABLE")] }));
    expect(result).toMatchObject({ status: "NO TRADE", maturity: "INVALIDATED", tradeReadiness: "NOT ELIGIBLE", paperTradeEligible: false });
    expect(result.exactReason).toContain("derived stop");
  });

  it("keeps provider, stale, missing, or incoherent data separate as DATA UNAVAILABLE", () => {
    const result = buildOpportunityDiscoveryItem(plan({ dataBundle: { provider: null, state: "PROVIDER_UNAVAILABLE", coherent: false, eligibleForScoring: false, statusMessage: "Kraken Spot returned HTTP 403.", timeframes: [] }, diagnostics: [...coreConditions().map(item => ({ ...item, status: "UNAVAILABLE" as const })), condition("opportunity_direction", "UNAVAILABLE")] }));
    expect(result).toMatchObject({ status: "DATA UNAVAILABLE", maturity: "UNAVAILABLE", tradeReadiness: "UNAVAILABLE", paperTradeEligible: false });
    expect(result.dataReason).toContain("HTTP 403");
  });

  it("keeps RISK OFF technically interesting items visible as restricted POTENTIAL rather than a qualified trade", () => {
    const result = buildOpportunityDiscoveryItem(plan({ direction: "NO TRADE", availability: "LIVE", regimeClassification: "RISK OFF", diagnostics: [...coreConditions(), condition("opportunity_direction", "FAILED", "Market regime is RISK OFF."), condition("structural_stop", "UNAVAILABLE"), condition("target_structure", "UNAVAILABLE"), condition("risk_reward", "UNAVAILABLE")] }));
    expect(result).toMatchObject({ status: "POTENTIAL", tradeReadiness: "RESTRICTED", paperTradeEligible: false, regime: { restricted: true } });
    expect(result.exactReason).toContain("RISK OFF");
  });

  it("orders discovery as qualified, potential, watch, no trade, then unavailable using existing Opportunity Score only within a state", () => {
    const qualified = plan({ assetId: "solana", symbol: "SOL", actionable: true, presentationStatus: "QUALIFIED", opportunityScore: 60 });
    const potential = plan({ assetId: "ethereum", symbol: "ETH", opportunityScore: 90, diagnostics: [...coreConditions(), condition("opportunity_direction", "PASSED"), condition("structural_stop", "PASSED"), condition("target_structure", "PASSED"), condition("risk_reward", "FAILED")] });
    const unavailable = plan({ assetId: "aave", symbol: "AAVE", opportunityScore: 99, dataBundle: { provider: null, state: "NO_DATA", coherent: false, eligibleForScoring: false, statusMessage: "No bundle.", timeframes: [] } });
    const response = buildOpportunityDiscovery("SWING", [unavailable, potential, qualified]);
    expect(response.items.map(item => item.status)).toEqual(["QUALIFIED", "POTENTIAL", "DATA UNAVAILABLE"]);
    expect(response.items.map(item => item.rank)).toEqual([1, 2, null]);
  });
});

const readinessCandidate = (overrides: Record<string, unknown> = {}) => ({
  availability: "PARTIAL",
  reason: "Validated candidate retained for read-only readiness explanation.",
  entryZone: { low: 99, high: 101, preferred: 100, reason: "Validated execution EMA zone." },
  stop: { label: "STOP", price: 95, reason: "Validated pivot stop.", priority: "PRIMARY" },
  invalidation: { label: "INVALIDATION", price: 95, reason: "Validated structural invalidation.", priority: "PRIMARY" },
  targets: [{ label: "TP1", price: 104, reason: "Validated structure target.", priority: "PRIMARY" }],
  rewardRisk: 0.8,
  ...overrides,
});

const potentialDiagnostics = () => [...coreConditions(), condition("opportunity_direction", "PASSED"), condition("structural_stop", "PASSED"), condition("target_structure", "PASSED"), { ...condition("risk_reward", "FAILED", "The first target remains below the unchanged minimum."), actual: "Current R:R 0.8:1.", required: "Minimum required: 1:1 under the existing setup engine." }];

describe("Phase 9 setup readiness and conditional-plan contract", () => {
  it("uses a separate explicit readiness version", () => {
    expect(buildOpportunityDiscoveryItem(plan()).setupReadiness.version).toBe("SETUP_READINESS_V1");
  });

  it("marks a qualified setup READY without changing its opportunity score", () => {
    const result = buildOpportunityDiscoveryItem(plan({ actionable: true, presentationStatus: "QUALIFIED", opportunityScore: 71, currentPrice: 100, readinessCandidate: readinessCandidate({ availability: "SUPPORTED", rewardRisk: 1.4 }) }));
    expect(result.setupReadiness.state).toBe("READY");
    expect(result.opportunityScore).toBe(71);
  });

  it("marks a potential setup NEAR_READY", () => {
    const result = buildOpportunityDiscoveryItem(plan({ currentPrice: 100, readinessCandidate: readinessCandidate(), diagnostics: potentialDiagnostics() }));
    expect(result).toMatchObject({ status: "POTENTIAL", setupReadiness: { state: "NEAR_READY" } });
  });

  it("marks partial directional evidence EARLY rather than trade-ready", () => {
    const result = buildOpportunityDiscoveryItem(plan({ direction: "NO TRADE", executionState: analysis("1h", "bullish"), confirmationState: analysis("4h", "neutral"), contextState: analysis("1d", "neutral"), diagnostics: [...coreConditions(), condition("opportunity_direction", "FAILED"), condition("structural_stop", "UNAVAILABLE"), condition("target_structure", "UNAVAILABLE"), condition("risk_reward", "UNAVAILABLE")] }));
    expect(result).toMatchObject({ status: "WATCH", setupReadiness: { state: "EARLY" }, paperTradeEligible: false });
  });

  it("marks invalid structure INVALID with zero readiness", () => {
    const result = buildOpportunityDiscoveryItem(plan({ diagnostics: [...coreConditions(), condition("opportunity_direction", "PASSED"), condition("structural_stop", "FAILED"), condition("target_structure", "UNAVAILABLE"), condition("risk_reward", "UNAVAILABLE")] }));
    expect(result.setupReadiness).toMatchObject({ state: "INVALID", score: 0 });
  });

  it("marks invalid provider data DATA_UNAVAILABLE with null readiness", () => {
    const result = buildOpportunityDiscoveryItem(plan({ dataBundle: { provider: null, state: "INCOHERENT", coherent: false, eligibleForScoring: false, statusMessage: "Provider bundle is incoherent.", timeframes: [] } }));
    expect(result.setupReadiness).toMatchObject({ state: "DATA_UNAVAILABLE", score: null });
  });

  it("keeps potential alerts permanently false", () => {
    expect(buildOpportunityDiscoveryItem(plan({ currentPrice: 100, readinessCandidate: readinessCandidate(), diagnostics: potentialDiagnostics() })).potentialAlertEligible).toBe(false);
  });

  it("never grants paper eligibility to a potential candidate", () => {
    expect(buildOpportunityDiscoveryItem(plan({ currentPrice: 100, readinessCandidate: readinessCandidate(), diagnostics: potentialDiagnostics() })).paperTradeEligible).toBe(false);
  });

  it("retains a validated partial entry zone only when a candidate exists", () => {
    const result = buildOpportunityDiscoveryItem(plan({ currentPrice: 100, readinessCandidate: readinessCandidate(), diagnostics: potentialDiagnostics() }));
    expect(result.readinessPlan.entryZone).toMatchObject({ low: 99, high: 101, preferred: 100 });
  });

  it("calculates target distance from the current validated price", () => {
    const result = buildOpportunityDiscoveryItem(plan({ currentPrice: 100, readinessCandidate: readinessCandidate(), diagnostics: potentialDiagnostics() }));
    expect(result.readinessPlan.targets[0]).toMatchObject({ price: 104, distancePercent: 4 });
  });

  it("calculates the target R multiple from the existing candidate entry and invalidation", () => {
    const result = buildOpportunityDiscoveryItem(plan({ currentPrice: 100, readinessCandidate: readinessCandidate(), diagnostics: potentialDiagnostics() }));
    expect(result.readinessPlan.targets[0]?.rMultiple).toBe(0.8);
  });

  it("does not force three targets when only one validated target exists", () => {
    const result = buildOpportunityDiscoveryItem(plan({ currentPrice: 100, readinessCandidate: readinessCandidate(), diagnostics: potentialDiagnostics() }));
    expect(result.readinessPlan.targets).toHaveLength(1);
  });

  it("keeps the actual structural invalidation explanation", () => {
    const result = buildOpportunityDiscoveryItem(plan({ currentPrice: 100, readinessCandidate: readinessCandidate(), diagnostics: potentialDiagnostics() }));
    expect(result.invalidationExplanation).toContain("95");
    expect(result.invalidationExplanation).toContain("Validated structural invalidation");
  });

  it("does not expose a conditional plan without candidate evidence", () => {
    const result = buildOpportunityDiscoveryItem(plan({ currentPrice: 100, diagnostics: potentialDiagnostics() }));
    expect(result.readinessPlan.availability).toBe("UNAVAILABLE");
    expect(result.readinessPlan.entryZone).toBeNull();
  });

  it("keeps manual Trade Health waiting until an immutable qualified paper snapshot exists", () => {
    const result = buildOpportunityDiscoveryItem(plan({ currentPrice: 100, readinessCandidate: readinessCandidate(), diagnostics: potentialDiagnostics() }));
    expect(result.readinessPlan.health.state).toBe("WAITING");
    expect(result.readinessPlan.health.reason).toContain("immutable qualified entry snapshot");
  });

  it("fails closed for stale mandatory input", () => {
    const diagnostics = [...coreConditions().map(item => item.key === "freshness" ? { ...item, status: "STALE" as const } : item), condition("opportunity_direction", "UNAVAILABLE")];
    const result = buildOpportunityDiscoveryItem(plan({ diagnostics }));
    expect(result.status).toBe("DATA UNAVAILABLE");
  });

  it("fails closed for missing validated volume represented by invalid provider bundle", () => {
    const result = buildOpportunityDiscoveryItem(plan({ dataBundle: { provider: "Kraken Spot", state: "INVALID", coherent: false, eligibleForScoring: false, statusMessage: "15M volume was invalid.", timeframes: [] } }));
    expect(result).toMatchObject({ status: "DATA UNAVAILABLE", dataReason: "15M volume was invalid." });
  });

  it("fails closed for mixed-provider/coherence rejection", () => {
    const result = buildOpportunityDiscoveryItem(plan({ dataBundle: { provider: null, state: "INCOHERENT", coherent: false, eligibleForScoring: false, statusMessage: "Mixed provider bundle rejected.", timeframes: [] } }));
    expect(result.dataReason).toContain("Mixed provider bundle rejected");
  });

  it("preserves RISK OFF as a restricted non-eligible readiness state", () => {
    const result = buildOpportunityDiscoveryItem(plan({ currentPrice: 100, direction: "NO TRADE", availability: "LIVE", regimeClassification: "RISK OFF", readinessCandidate: readinessCandidate(), diagnostics: [...coreConditions(), condition("opportunity_direction", "FAILED", "Market regime is RISK OFF."), condition("structural_stop", "UNAVAILABLE"), condition("target_structure", "UNAVAILABLE"), condition("risk_reward", "UNAVAILABLE")] }));
    expect(result).toMatchObject({ status: "POTENTIAL", tradeReadiness: "RESTRICTED", setupReadiness: { state: "NEAR_READY" }, paperTradeEligible: false });
    expect(result.setupReadiness.components.regime).toBe(0);
  });

  it("exposes provider, timestamp, freshness, validation, and timeframes as provenance", () => {
    const result = buildOpportunityDiscoveryItem(plan({ dataTimestamp: 456, availability: "LIVE", dataBundle: { provider: "Kraken Spot", state: "VALID", coherent: true, eligibleForScoring: true, statusMessage: "Validated", timeframes: [] } }));
    expect(result).toMatchObject({ provider: "Kraken Spot", dataTimestamp: 456, freshness: "LIVE", validationStatus: "VALID", timeframes: { execution: "1h", confirmation: "4h", context: "1d" } });
  });

  it("uses readiness only as a transparent secondary ordering tie-breaker after status and opportunity score", () => {
    const lowerScoreHigherReadiness = plan({ assetId: "eth", symbol: "ETH", opportunityScore: 70, currentPrice: 100, readinessCandidate: readinessCandidate({ availability: "SUPPORTED", rewardRisk: 1.2 }), diagnostics: potentialDiagnostics() });
    const higherScoreLowerReadiness = plan({ assetId: "sol", symbol: "SOL", opportunityScore: 80, currentPrice: 100, readinessCandidate: readinessCandidate(), diagnostics: potentialDiagnostics() });
    const response = buildOpportunityDiscovery("SWING", [lowerScoreHigherReadiness, higherScoreLowerReadiness]);
    expect(response.items.map(item => item.symbol)).toEqual(["SOL", "ETH"]);
  });

  it("does not let readiness override status hierarchy", () => {
    const unavailable = plan({ assetId: "aave", symbol: "AAVE", opportunityScore: 99, dataBundle: { provider: null, state: "NO_DATA", coherent: false, eligibleForScoring: false, statusMessage: "No data", timeframes: [] } });
    const potential = plan({ assetId: "eth", symbol: "ETH", opportunityScore: 40, currentPrice: 100, readinessCandidate: readinessCandidate(), diagnostics: potentialDiagnostics() });
    expect(buildOpportunityDiscovery("SWING", [unavailable, potential]).items.map(item => item.status)).toEqual(["POTENTIAL", "DATA UNAVAILABLE"]);
  });
});


describe("Phase 34 opportunity quality contract", () => {
  it("exposes independent server-derived quality without replacing the primary opportunity score", () => {
    const result = buildOpportunityDiscoveryItem(plan({ actionable: true, presentationStatus: "QUALIFIED", opportunityScore: 71, availability: "LIVE", entryZone: { preferred: 100 }, stop: { price: 95 }, targets: [{ label: "TP1", price: 110 }], rewardRisk: 2, currentPrice: 100 }));
    expect(result.opportunityScore).toBe(71);
    expect(result.opportunityQuality).toMatchObject({ level: expect.any(String), score: expect.any(Number) });
    expect(result.opportunityQuality.explanation).toContain("does not replace the Opportunity Score");
  });

  it("marks quality unavailable when validated evidence is unavailable", () => {
    const result = buildOpportunityDiscoveryItem(plan({ dataBundle: { provider: null, state: "PROVIDER_UNAVAILABLE", coherent: false, eligibleForScoring: false, statusMessage: "Provider unavailable.", timeframes: [] }, diagnostics: [...coreConditions().map(item => ({ ...item, status: "UNAVAILABLE" as const })), condition("opportunity_direction", "UNAVAILABLE")] }));
    expect(result.status).toBe("DATA UNAVAILABLE");
    expect(result.opportunityQuality).toMatchObject({ level: "UNAVAILABLE", score: null });
  });

  it("keeps Risk Off restricted and non-eligible while exposing quality evidence", () => {
    const result = buildOpportunityDiscoveryItem(plan({ direction: "NO TRADE", availability: "LIVE", regimeClassification: "RISK OFF", diagnostics: [...coreConditions(), condition("opportunity_direction", "FAILED", "Market regime is RISK OFF."), condition("structural_stop", "UNAVAILABLE"), condition("target_structure", "UNAVAILABLE"), condition("risk_reward", "UNAVAILABLE")] }));
    expect(result).toMatchObject({ status: "POTENTIAL", tradeReadiness: "RESTRICTED", paperTradeEligible: false, regime: { restricted: true } });
    expect(result.opportunityQuality.level).not.toBe("UNAVAILABLE");
  });
});
