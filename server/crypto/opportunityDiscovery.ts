import type { TradeSetupCondition, TradeSetupDirection, TradeSetupMode, TradeSetupPlan } from "./tradeSetup";

/**
 * Phase 8 is an interpretation layer. It intentionally contains no indicator,
 * price, provider, score, or trade-execution calculation.
 */
export const OPPORTUNITY_DISCOVERY_VERSION = "OPPORTUNITY_DISCOVERY_V1";
export type OpportunityDiscoveryStatus = "QUALIFIED" | "POTENTIAL" | "WATCH" | "NO TRADE" | "DATA UNAVAILABLE";
export type SetupMaturity = "EARLY" | "DEVELOPING" | "CONFIRMING" | "QUALIFIED" | "INVALIDATED" | "UNAVAILABLE";
export type DiscoveryTradeReadiness = "READY" | "WAITING" | "RESTRICTED" | "NOT ELIGIBLE" | "UNAVAILABLE";

export type OpportunityDiscoveryItem = {
  version: typeof OPPORTUNITY_DISCOVERY_VERSION;
  assetId: string;
  symbol: string;
  mode: TradeSetupMode;
  status: OpportunityDiscoveryStatus;
  maturity: SetupMaturity;
  tradeReadiness: DiscoveryTradeReadiness;
  paperTradeEligible: boolean;
  rank: number | null;
  opportunityScore: number | null;
  direction: TradeSetupDirection;
  provider: string | null;
  dataTimestamp: number | null;
  regime: { classification: string | null; restricted: boolean };
  timeframeAgreement: { aligned: number; required: number; direction: TradeSetupDirection; label: string };
  whyInteresting: string[];
  whatWouldChange: string[];
  conditionalEntry: string | null;
  exactReason: string;
  dataReason: string | null;
  sourcePresentationStatus: TradeSetupPlan["presentationStatus"];
  sourcePlan: Pick<TradeSetupPlan, "actionable" | "entryZone" | "stop" | "invalidation" | "targets" | "rewardRisk" | "evidence" | "risks" | "diagnostics">;
};

export type OpportunityDiscoveryResponse = {
  version: typeof OPPORTUNITY_DISCOVERY_VERSION;
  mode: TradeSetupMode;
  items: OpportunityDiscoveryItem[];
  summary: { evaluated: number; qualified: number; potential: number; watch: number; noTrade: number; dataUnavailable: number; restrictedByRiskOff: number };
};

const CORE_DATA_KEYS = new Set<TradeSetupCondition["key"]>(["provider_bundle", "live_price", "freshness", "execution_analysis", "confirmation_analysis", "context_analysis"]);
const STATUS_PRIORITY: Record<OpportunityDiscoveryStatus, number> = { QUALIFIED: 0, POTENTIAL: 1, WATCH: 2, "NO TRADE": 3, "DATA UNAVAILABLE": 4 };
const directionForBias = (bias: string | null | undefined): TradeSetupDirection => bias === "bullish" ? "LONG" : bias === "bearish" ? "SHORT" : "NO TRADE";

function coreDataFailure(plan: TradeSetupPlan) {
  const failed = plan.diagnostics.filter(condition => CORE_DATA_KEYS.has(condition.key) && (condition.status === "UNAVAILABLE" || condition.status === "STALE"));
  if (!plan.dataBundle.eligibleForScoring || !plan.dataBundle.coherent) return plan.dataBundle.statusMessage;
  if (failed.length) return failed.map(condition => `${condition.label}: ${condition.detail}`).join(" ");
  return null;
}

function technicalDirection(plan: TradeSetupPlan): TradeSetupDirection {
  if (plan.direction !== "NO TRADE") return plan.direction;
  const directions = [plan.executionState, plan.confirmationState, plan.contextState].map(analysis => directionForBias(analysis?.bias));
  const long = directions.filter(direction => direction === "LONG").length;
  const short = directions.filter(direction => direction === "SHORT").length;
  return long > short && long > 0 ? "LONG" : short > long && short > 0 ? "SHORT" : "NO TRADE";
}

function alignedTimeframes(plan: TradeSetupPlan, direction: TradeSetupDirection) {
  if (direction === "NO TRADE") return [] as Array<{ timeframe: string; bias: string; reasons: NonNullable<TradeSetupPlan["executionState"]>["reasons"] }>;
  return [plan.executionState, plan.confirmationState, plan.contextState]
    .filter((analysis): analysis is NonNullable<typeof analysis> => Boolean(analysis && directionForBias(analysis.bias) === direction))
    .map(analysis => ({ timeframe: analysis.timeframe.toUpperCase(), bias: analysis.bias, reasons: analysis.reasons }));
}

function diagnostic(plan: TradeSetupPlan, key: TradeSetupCondition["key"]) {
  return plan.diagnostics.find(condition => condition.key === key) ?? null;
}

function evidenceFor(plan: TradeSetupPlan, matches: ReturnType<typeof alignedTimeframes>) {
  const actual = matches.flatMap(analysis => analysis.reasons.filter(reason => reason.direction === "positive").map(reason => `${analysis.timeframe}: ${reason.label}`));
  if (actual.length) return Array.from(new Set(actual)).slice(0, 4);
  return matches.map(analysis => `${analysis.timeframe} technical bias is ${analysis.bias}.`).slice(0, 3);
}

function upgradeConditions(plan: TradeSetupPlan, direction: TradeSetupDirection, matches: ReturnType<typeof alignedTimeframes>, riskOff: boolean) {
  const conditions: string[] = [];
  if (riskOff) conditions.push("Market regime must no longer be RISK OFF before trade qualification can be considered.");
  const opportunity = diagnostic(plan, "opportunity_direction");
  if (opportunity?.status === "FAILED") conditions.push(opportunity.key === "opportunity_direction" ? "The existing Opportunity direction must confirm the technical thesis." : opportunity.required);
  const all = [plan.executionState, plan.confirmationState, plan.contextState].filter((analysis): analysis is NonNullable<typeof analysis> => Boolean(analysis));
  const missing = all.filter(analysis => directionForBias(analysis.bias) !== direction);
  for (const analysis of missing) conditions.push(`${analysis.timeframe.toUpperCase()} bias must confirm ${direction === "LONG" ? "bullish" : "bearish"} direction.`);
  const riskReward = diagnostic(plan, "risk_reward");
  if (riskReward?.status === "FAILED") conditions.push(`${riskReward.actual} A better entry must satisfy the existing ${riskReward.required.replace("Minimum required: ", "").replace(" under the existing setup engine.", "")} minimum.`);
  const unique = Array.from(new Set(conditions));
  return unique.length ? unique.slice(0, 4) : matches.length ? ["All existing qualification conditions must remain valid at the next completed candle."] : ["A coherent directional multi-timeframe thesis must emerge from validated analyses."];
}

function sourcePlan(plan: TradeSetupPlan): OpportunityDiscoveryItem["sourcePlan"] {
  return { actionable: plan.actionable, entryZone: plan.entryZone, stop: plan.stop, invalidation: plan.invalidation, targets: plan.targets, rewardRisk: plan.rewardRisk, evidence: plan.evidence, risks: plan.risks, diagnostics: plan.diagnostics };
}

function item(plan: TradeSetupPlan): OpportunityDiscoveryItem {
  const unavailableReason = coreDataFailure(plan);
  const riskOff = plan.regimeClassification === "RISK OFF";
  const direction = technicalDirection(plan);
  const matches = alignedTimeframes(plan, direction);
  const whyInteresting = evidenceFor(plan, matches);
  const agreement = { aligned: matches.length, required: 3, direction, label: direction === "NO TRADE" ? "No directional agreement" : `${matches.length}/3 timeframes align ${direction === "LONG" ? "bullishly" : "bearishly"}` };
  const base = {
    version: OPPORTUNITY_DISCOVERY_VERSION,
    assetId: plan.assetId,
    symbol: plan.symbol,
    mode: plan.mode,
    rank: null,
    opportunityScore: plan.opportunityScore,
    direction,
    provider: plan.provider,
    dataTimestamp: plan.dataTimestamp,
    regime: { classification: plan.regimeClassification, restricted: riskOff },
    timeframeAgreement: agreement,
    whyInteresting,
    sourcePresentationStatus: plan.presentationStatus,
    sourcePlan: sourcePlan(plan),
  } as const;

  if (unavailableReason) return { ...base, status: "DATA UNAVAILABLE", maturity: "UNAVAILABLE", tradeReadiness: "UNAVAILABLE", paperTradeEligible: false, whatWouldChange: [], conditionalEntry: null, exactReason: "Required validated data is unavailable, stale, invalid, or incoherent; no technical setup was evaluated.", dataReason: unavailableReason };
  if (plan.actionable && plan.presentationStatus === "QUALIFIED") return { ...base, status: "QUALIFIED", maturity: "QUALIFIED", tradeReadiness: "READY", paperTradeEligible: true, whatWouldChange: [], conditionalEntry: null, exactReason: "All existing confirmation, level, target, and risk/reward conditions passed using coherent validated inputs.", dataReason: null };

  const stop = diagnostic(plan, "structural_stop");
  const target = diagnostic(plan, "target_structure");
  const riskReward = diagnostic(plan, "risk_reward");
  const directionGate = diagnostic(plan, "opportunity_direction");
  const hardInvalidation = !riskOff && directionGate?.status === "PASSED" && (stop?.status !== "PASSED" || target?.status !== "PASSED");
  if (hardInvalidation) return { ...base, status: "NO TRADE", maturity: "INVALIDATED", tradeReadiness: "NOT ELIGIBLE", paperTradeEligible: false, whatWouldChange: [], conditionalEntry: null, exactReason: stop?.status !== "PASSED" ? stop?.detail ?? "A technically valid structural stop was not available." : target?.detail ?? "A forward technical target was not available.", dataReason: null };

  const upgrades = upgradeConditions(plan, direction, matches, riskOff);
  if (direction !== "NO TRADE" && (riskOff || matches.length >= 2 || riskReward?.status === "FAILED")) {
    const restricted = riskOff;
    const rrNeedsEntry = riskReward?.status === "FAILED";
    return { ...base, status: "POTENTIAL", maturity: "DEVELOPING", tradeReadiness: restricted ? "RESTRICTED" : "WAITING", paperTradeEligible: false, whatWouldChange: upgrades, conditionalEntry: rrNeedsEntry ? "Conditional entry only after a better entry produces the existing minimum risk/reward." : "Conditional entry only after every listed confirmation is present on completed validated candles.", exactReason: restricted ? "The technical setup is developing, but the current RISK OFF regime restricts trade qualification." : rrNeedsEntry ? "The technical setup is developing, but the current first target does not meet the unchanged minimum risk/reward." : `${agreement.label}; the remaining confirmation is not complete.`, dataReason: null };
  }

  const anyTechnicalEvidence = [plan.executionState, plan.confirmationState, plan.contextState].some(analysis => analysis?.bias !== "neutral");
  if (anyTechnicalEvidence) return { ...base, status: "WATCH", maturity: "EARLY", tradeReadiness: riskOff ? "RESTRICTED" : "WAITING", paperTradeEligible: false, whatWouldChange: upgrades, conditionalEntry: "No entry is presented. Wait for the listed completed-candle confirmation conditions.", exactReason: riskOff ? "Market regime is RISK OFF; early technical evidence is shown for monitoring only." : direction === "NO TRADE" ? "Technical evidence exists, but the validated timeframes do not yet form a directional thesis." : `${agreement.label}; confirmation is still early.`, dataReason: null };

  return { ...base, status: "NO TRADE", maturity: "INVALIDATED", tradeReadiness: "NOT ELIGIBLE", paperTradeEligible: false, whatWouldChange: [], conditionalEntry: null, exactReason: "Validated technical evidence does not currently form a directional or structurally eligible setup.", dataReason: null };
}

export function buildOpportunityDiscoveryItem(plan: TradeSetupPlan) {
  return item(plan);
}

export function buildOpportunityDiscovery(mode: TradeSetupMode, plans: TradeSetupPlan[]): OpportunityDiscoveryResponse {
  const ordered = plans.map(item).sort((left, right) => STATUS_PRIORITY[left.status] - STATUS_PRIORITY[right.status] || (right.opportunityScore ?? -1) - (left.opportunityScore ?? -1) || right.timeframeAgreement.aligned - left.timeframeAgreement.aligned || left.symbol.localeCompare(right.symbol));
  let rank = 0;
  const items = ordered.map(discovery => ["QUALIFIED", "POTENTIAL", "WATCH"].includes(discovery.status) ? { ...discovery, rank: ++rank } : discovery);
  const count = (status: OpportunityDiscoveryStatus) => items.filter(item => item.status === status).length;
  return { version: OPPORTUNITY_DISCOVERY_VERSION, mode, items, summary: { evaluated: items.length, qualified: count("QUALIFIED"), potential: count("POTENTIAL"), watch: count("WATCH"), noTrade: count("NO TRADE"), dataUnavailable: count("DATA UNAVAILABLE"), restrictedByRiskOff: items.filter(item => item.regime.restricted && ["POTENTIAL", "WATCH"].includes(item.status)).length } };
}
