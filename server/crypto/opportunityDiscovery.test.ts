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
    const result = buildOpportunityDiscoveryItem(plan({ direction: "NO TRADE", regimeClassification: "RISK OFF", diagnostics: [...coreConditions(), condition("opportunity_direction", "FAILED", "Market regime is RISK OFF."), condition("structural_stop", "UNAVAILABLE"), condition("target_structure", "UNAVAILABLE"), condition("risk_reward", "UNAVAILABLE")] }));
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
