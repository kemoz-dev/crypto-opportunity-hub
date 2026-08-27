import type { TradeSetupCondition, TradeSetupDirection, TradeSetupMode, TradeSetupPlan, TradeSetupReadinessCandidate } from "./tradeSetup";
import { qualifyAdaptive } from "./adaptiveQualification";

/**
 * Phase 8 is an interpretation layer. It intentionally contains no indicator,
 * price, provider, score, or trade-execution calculation.
 */
export const OPPORTUNITY_DISCOVERY_VERSION = "OPPORTUNITY_DISCOVERY_V2";
export const SETUP_READINESS_VERSION = "SETUP_READINESS_V1";
export type OpportunityDiscoveryStatus = "QUALIFIED" | "POTENTIAL" | "WATCH" | "NO TRADE" | "DATA UNAVAILABLE";
export type SetupMaturity = "EARLY" | "DEVELOPING" | "CONFIRMING" | "QUALIFIED" | "INVALIDATED" | "UNAVAILABLE";
export type SetupReadinessState = "READY" | "NEAR_READY" | "EARLY" | "WATCH" | "INVALID" | "DATA_UNAVAILABLE";
export type DiscoveryTradeReadiness = "READY" | "WAITING" | "RESTRICTED" | "NOT ELIGIBLE" | "UNAVAILABLE";

type ReadinessPlan = {
  availability: "SUPPORTED" | "PARTIAL" | "UNAVAILABLE";
  currentPrice: number | null;
  entryZone: TradeSetupReadinessCandidate["entryZone"];
  confirmation: string | null;
  invalidation: TradeSetupReadinessCandidate["invalidation"];
  targets: Array<{ label: string; price: number; distancePercent: number | null; rMultiple: number | null; reason: string }>;
  rewardRisk: number | null;
  reason: string;
  health: { state: "WAITING" | "UNAVAILABLE"; reason: string };
};

export type OpportunityDiscoveryItem = {
  version: typeof OPPORTUNITY_DISCOVERY_VERSION;
  assetId: string;
  symbol: string;
  mode: TradeSetupMode;
  status: OpportunityDiscoveryStatus;
  maturity: SetupMaturity;
  setupReadiness: { version: typeof SETUP_READINESS_VERSION; state: SetupReadinessState; score: number | null; components: { timeframeAlignment: number; positiveEvidence: number; technicalPlan: number; rewardRisk: number; regime: number }; explanation: string };
  tradeReadiness: DiscoveryTradeReadiness;
  paperTradeEligible: boolean;
  potentialAlertEligible: false;
  rank: number | null;
  opportunityScore: number | null;
  direction: TradeSetupDirection;
  provider: string | null;
  dataTimestamp: number | null;
  freshness: TradeSetupPlan["availability"];
  validationStatus: TradeSetupPlan["dataBundle"]["state"];
  timeframes: TradeSetupPlan["timeframes"];
  regime: { classification: string | null; restricted: boolean };
  timeframeAgreement: { aligned: number; required: number; direction: TradeSetupDirection; label: string };
  whyInteresting: string[];
  missingEvidence: string[];
  confirmationRequirements: string[];
  invalidationExplanation: string;
  whatWouldChange: string[];
  conditionalEntry: string | null;
  readinessPlan: ReadinessPlan;
  exactReason: string;
  dataReason: string | null;
  sourcePresentationStatus: TradeSetupPlan["presentationStatus"];
  adaptive: ReturnType<typeof qualifyAdaptive>;
  sourcePlan: Pick<TradeSetupPlan, "actionable" | "currentPrice" | "entryZone" | "stop" | "invalidation" | "targets" | "rewardRisk" | "readinessCandidate" | "evidence" | "risks" | "diagnostics">;
};

export type OpportunityDiscoveryResponse = {
  version: typeof OPPORTUNITY_DISCOVERY_VERSION;
  mode: TradeSetupMode;
  items: OpportunityDiscoveryItem[];
  summary: { evaluated: number; qualified: number; potential: number; watch: number; noTrade: number; dataUnavailable: number; restrictedByRiskOff: number };
};

const CORE_DATA_KEYS = new Set<TradeSetupCondition["key"]>(["provider_bundle", "live_price", "freshness", "execution_analysis", "confirmation_analysis", "context_analysis"]);
const STATUS_PRIORITY: Record<OpportunityDiscoveryStatus, number> = { QUALIFIED: 0, POTENTIAL: 1, WATCH: 2, "NO TRADE": 3, "DATA UNAVAILABLE": 4 };
const round = (value: number, digits = 2) => Number(value.toFixed(digits));
const clamp = (value: number) => Math.min(100, Math.max(0, value));
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
  return { actionable: plan.actionable, currentPrice: plan.currentPrice, entryZone: plan.entryZone, stop: plan.stop, invalidation: plan.invalidation, targets: plan.targets, rewardRisk: plan.rewardRisk, readinessCandidate: plan.readinessCandidate, evidence: plan.evidence, risks: plan.risks, diagnostics: plan.diagnostics };
}

function candidatePlan(plan: TradeSetupPlan, confirmation: string | null): ReadinessPlan {
  const candidate = plan.readinessCandidate;
  if (!candidate || plan.currentPrice == null) return { availability: "UNAVAILABLE", currentPrice: plan.currentPrice, entryZone: null, confirmation, invalidation: null, targets: [], rewardRisk: null, reason: candidate?.reason ?? "Validated technical evidence did not support a conditional entry, target path, or invalidation level.", health: { state: "UNAVAILABLE", reason: "Trade Health is available only for an immutable qualified Paper Trade snapshot." } };
  const perUnitRisk = candidate.entryZone && candidate.invalidation ? Math.abs(candidate.entryZone.preferred - candidate.invalidation.price) : null;
  return {
    availability: candidate.availability,
    currentPrice: plan.currentPrice,
    entryZone: candidate.entryZone,
    confirmation,
    invalidation: candidate.invalidation,
    targets: candidate.targets.map(target => ({ label: target.label, price: target.price, distancePercent: round(Math.abs(target.price - plan.currentPrice!) / Math.max(plan.currentPrice!, Number.EPSILON) * 100, 2), rMultiple: perUnitRisk && perUnitRisk > 0 && candidate.entryZone ? round(Math.abs(target.price - candidate.entryZone.preferred) / perUnitRisk, 2) : null, reason: target.reason })),
    rewardRisk: candidate.rewardRisk,
    reason: candidate.reason,
    health: { state: "WAITING", reason: "No Paper Trade is open from this plan. Existing manual Trade Health is evaluated only against an immutable qualified entry snapshot." },
  };
}

function readiness(status: OpportunityDiscoveryStatus, plan: TradeSetupPlan, matches: ReturnType<typeof alignedTimeframes>, riskOff: boolean): OpportunityDiscoveryItem["setupReadiness"] {
  if (status === "DATA UNAVAILABLE") return { version: SETUP_READINESS_VERSION, state: "DATA_UNAVAILABLE" as const, score: null, components: { timeframeAlignment: 0, positiveEvidence: 0, technicalPlan: 0, rewardRisk: 0, regime: 0 }, explanation: "Readiness is unavailable because mandatory live or coherent provider input did not validate." };
  if (status === "NO TRADE") return { version: SETUP_READINESS_VERSION, state: "INVALID" as const, score: 0, components: { timeframeAlignment: 0, positiveEvidence: 0, technicalPlan: 0, rewardRisk: 0, regime: 0 }, explanation: "Readiness is invalid because the existing structural setup requirements did not pass." };
  const candidate = plan.readinessCandidate;
  const components = {
    timeframeAlignment: round(matches.length / 3 * 35, 1),
    positiveEvidence: Math.min(20, matches.flatMap(match => match.reasons.filter(reason => reason.direction === "positive")).length * 5),
    technicalPlan: candidate?.availability === "SUPPORTED" ? 20 : candidate?.availability === "PARTIAL" ? 12 : 0,
    rewardRisk: candidate?.rewardRisk != null ? candidate.rewardRisk >= 1 ? 15 : 5 : 0,
    regime: riskOff ? 0 : plan.regimeClassification === "RISK ON" ? 10 : plan.regimeClassification === "SELECTIVE" ? 5 : 0,
  };
  const score = round(clamp(Object.values(components).reduce((total, value) => total + value, 0)), 1);
  const state: SetupReadinessState = status === "QUALIFIED" ? "READY" : status === "POTENTIAL" ? "NEAR_READY" : matches.length ? "EARLY" : "WATCH";
  const explanation = status === "QUALIFIED" ? "All existing setup requirements passed; readiness does not replace the Opportunity Score or Paper Trading revalidation." : status === "POTENTIAL" ? "Validated evidence is developing. The listed confirmation remains mandatory before qualification." : "Only early validated evidence is present; no directional or trade-ready conclusion is implied.";
  return { version: SETUP_READINESS_VERSION, state, score, components, explanation };
}

function invalidationExplanation(plan: TradeSetupPlan, readinessPlan: ReadinessPlan) {
  if (readinessPlan.invalidation) return `Technical invalidation: ${readinessPlan.invalidation.price}. ${readinessPlan.invalidation.reason}`;
  return diagnostic(plan, "structural_stop")?.detail ?? "Technical invalidation is unavailable because existing validated structure did not support one.";
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
    freshness: plan.availability,
    validationStatus: plan.dataBundle.state,
    timeframes: plan.timeframes,
    regime: { classification: plan.regimeClassification, restricted: riskOff },
    timeframeAgreement: agreement,
    whyInteresting,
    sourcePresentationStatus: plan.presentationStatus,
    adaptive: qualifyAdaptive(plan),
    sourcePlan: sourcePlan(plan),
    potentialAlertEligible: false as const,
  } as const;

  const finalize = (status: OpportunityDiscoveryStatus, maturity: SetupMaturity, tradeReadiness: DiscoveryTradeReadiness, paperTradeEligible: boolean, whatWouldChange: string[], conditionalEntry: string | null, exactReason: string, dataReason: string | null) => {
    const readinessPlan = candidatePlan(plan, conditionalEntry);
    return { ...base, status, maturity, setupReadiness: readiness(status, plan, matches, riskOff), tradeReadiness, paperTradeEligible, missingEvidence: whatWouldChange, confirmationRequirements: whatWouldChange, invalidationExplanation: invalidationExplanation(plan, readinessPlan), whatWouldChange, conditionalEntry, readinessPlan, exactReason, dataReason };
  };

  if (unavailableReason) return finalize("DATA UNAVAILABLE", "UNAVAILABLE", "UNAVAILABLE", false, [], null, "Required validated data is unavailable, stale, invalid, or incoherent; no technical setup was evaluated.", unavailableReason);
  if (plan.actionable && plan.presentationStatus === "QUALIFIED") return finalize("QUALIFIED", "QUALIFIED", "READY", true, [], null, "All existing confirmation, level, target, and risk/reward conditions passed using coherent validated inputs.", null);

  const stop = diagnostic(plan, "structural_stop");
  const target = diagnostic(plan, "target_structure");
  const riskReward = diagnostic(plan, "risk_reward");
  const directionGate = diagnostic(plan, "opportunity_direction");
  const hardInvalidation = !riskOff && directionGate?.status === "PASSED" && (stop?.status !== "PASSED" || target?.status !== "PASSED");
  if (hardInvalidation) return finalize("NO TRADE", "INVALIDATED", "NOT ELIGIBLE", false, [], null, stop?.status !== "PASSED" ? stop?.detail ?? "A technically valid structural stop was not available." : target?.detail ?? "A forward technical target was not available.", null);

  const upgrades = upgradeConditions(plan, direction, matches, riskOff);
  if (direction !== "NO TRADE" && (riskOff || matches.length >= 2 || riskReward?.status === "FAILED")) {
    const restricted = riskOff;
    const rrNeedsEntry = riskReward?.status === "FAILED";
    return finalize("POTENTIAL", "DEVELOPING", restricted ? "RESTRICTED" : "WAITING", false, upgrades, rrNeedsEntry ? "Conditional entry only after a completed validated candle produces a better entry that satisfies the existing minimum R:R." : "Conditional entry only after every listed confirmation is present on completed validated candles.", restricted ? "The technical setup is developing, but the current RISK OFF regime restricts trade qualification." : rrNeedsEntry ? "The technical setup is developing, but the current first target does not meet the unchanged minimum risk/reward." : `${agreement.label}; the remaining confirmation is not complete.`, null);
  }

  const anyTechnicalEvidence = [plan.executionState, plan.confirmationState, plan.contextState].some(analysis => analysis?.bias !== "neutral");
  if (anyTechnicalEvidence) return finalize("WATCH", "EARLY", riskOff ? "RESTRICTED" : "WAITING", false, upgrades, "No entry is presented. Wait for the listed completed-candle confirmation conditions.", riskOff ? "Market regime is RISK OFF; early technical evidence is shown for monitoring only." : direction === "NO TRADE" ? "Technical evidence exists, but the validated timeframes do not yet form a directional thesis." : `${agreement.label}; confirmation is still early.`, null);

  return finalize("NO TRADE", "INVALIDATED", "NOT ELIGIBLE", false, [], null, "Validated technical evidence does not currently form a directional or structurally eligible setup.", null);
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
