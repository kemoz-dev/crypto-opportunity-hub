import type { TradeSetupPlan } from "./tradeSetup";

export type AdaptiveStatus = "STRONG SETUP" | "QUALIFIED" | "POTENTIAL" | "WATCH" | "CAUTION" | "LOW CONFIDENCE" | "NO TRADE" | "DATA UNAVAILABLE";
export type AdaptiveTradingMode = "CONSERVATIVE" | "BALANCED" | "OPPORTUNITY" | "EXPERIMENTAL" | "CUSTOM";

export type AdaptiveSetupQuality = {
  score: number | null;
  confidence: "HIGH" | "MODERATE" | "LOW" | "UNAVAILABLE";
  components: Array<{ key: "trendAlignment" | "momentum" | "structure" | "volume" | "volatility" | "marketRegime" | "rewardRisk" | "confirmation"; label: string; score: number | null; status: "SUPPORTED" | "LIMITED" | "UNAVAILABLE"; reason: string }>;
  confirmationGaps: string[];
  warnings: string[];
};

export type AdaptiveQualification = {
  status: AdaptiveStatus;
  direction: "LONG" | "SHORT" | "NO TRADE";
  strategy: "SCALP" | "SWING";
  timeframe: string;
  quality: AdaptiveSetupQuality;
  reasons: string[];
  warnings: string[];
  dataQuality: "GOOD" | "LIMITED" | "WARNING" | "UNAVAILABLE";
  eligibleForAutoPaper: boolean;
};

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

function component(key: AdaptiveSetupQuality["components"][number]["key"], label: string, score: number | null, status: AdaptiveSetupQuality["components"][number]["status"], reason: string) {
  return { key, label, score: score === null ? null : Math.round(clamp(score)), status, reason } as const;
}

function qualityFor(plan: TradeSetupPlan): AdaptiveSetupQuality {
  if (plan.availability !== "LIVE" || !plan.dataBundle.coherent || !plan.dataBundle.eligibleForScoring) {
    return { score: null, confidence: "UNAVAILABLE", components: [component("trendAlignment", "Trend alignment", null, "UNAVAILABLE", "Validated plan inputs are unavailable."), component("momentum", "Momentum", null, "UNAVAILABLE", "Validated momentum input is unavailable."), component("structure", "Structure", null, "UNAVAILABLE", "Validated structure input is unavailable."), component("volume", "Volume", null, "UNAVAILABLE", "Validated volume input is unavailable."), component("volatility", "Volatility", null, "UNAVAILABLE", "Validated volatility input is unavailable."), component("marketRegime", "Market regime", null, "UNAVAILABLE", "Market regime input is unavailable."), component("rewardRisk", "Reward/Risk", plan.rewardRisk === null ? null : plan.rewardRisk / 3 * 100, plan.rewardRisk === null ? "UNAVAILABLE" : "SUPPORTED", plan.rewardRisk === null ? "R:R is unavailable." : "Existing validated R:R."), component("confirmation", "Confirmation", null, "UNAVAILABLE", "Confirmation input is unavailable.")], confirmationGaps: ["Validated plan inputs unavailable"], warnings: [plan.dataBundle.statusMessage] };
  }
  const execution = plan.executionState;
  const confirmation = plan.confirmationState;
  const context = plan.contextState;
  const aligned = [execution, confirmation, context].filter(item => item?.bias === (plan.direction === "LONG" ? "bullish" : "bearish")).length;
  const trendScore = aligned / 3 * 100;
  const momentumScore = execution && execution.macdHistogram != null && execution.rsi != null ? clamp((execution.macdHistogram > 0 ? 60 : 30) + (plan.direction === "LONG" ? execution.rsi >= 50 ? 25 : 10 : execution.rsi <= 50 ? 25 : 10)) : null;
  const structureScore = plan.stop && plan.targets.length ? 80 : plan.entryZone ? 55 : null;
  const volumeScore = execution?.volumeExpansion == null ? null : clamp(execution.volumeExpansion * 50);
  const volatilityScore = execution?.atrPercent == null ? null : clamp(100 - execution.atrPercent * 10);
  const regimeScore = plan.regimeClassification === "RISK ON" ? 90 : plan.regimeClassification === "RISK OFF" ? 35 : plan.regimeClassification ? 60 : null;
  const rrScore = plan.rewardRisk === null ? null : clamp(plan.rewardRisk / 3 * 100);
  const confirmationScore = confirmation ? (confirmation.bias === (plan.direction === "LONG" ? "bullish" : "bearish") ? 85 : 35) : null;
  const values = [trendScore, momentumScore, structureScore, volumeScore, volatilityScore, regimeScore, rrScore, confirmationScore].filter((value): value is number => value !== null);
  const score = values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
  const confidence = score === null ? "UNAVAILABLE" : score >= 75 ? "HIGH" : score >= 55 ? "MODERATE" : "LOW";
  const confirmationGaps = [
    ...(confirmation && confirmation.bias !== (plan.direction === "LONG" ? "bullish" : "bearish") ? [`${plan.timeframes.confirmation.toUpperCase()} confirmation is not aligned`] : []),
    ...(plan.rewardRisk !== null && plan.rewardRisk < 1 ? ["Minimum reward/risk is not met"] : []),
    ...(volumeScore === null ? ["Volume evidence unavailable"] : []),
  ];
  const warnings = [
    ...(plan.regimeClassification === "RISK OFF" ? ["Market regime is Risk Off; reversal risk is elevated."] : []),
    ...(confidence === "LOW" ? ["Trend or confirmation strength is weak."] : []),
    ...(volumeScore === null ? ["Volume confirmation is unavailable."] : []),
  ];
  return {
    score,
    confidence,
    components: [
      component("trendAlignment", "Trend alignment", trendScore, "SUPPORTED", `${aligned}/3 validated timeframes align with direction.`),
      component("momentum", "Momentum", momentumScore, momentumScore === null ? "UNAVAILABLE" : "SUPPORTED", execution ? `RSI ${execution.rsi == null ? "UNAVAILABLE" : execution.rsi.toFixed(1)}; MACD histogram ${execution.macdHistogram == null ? "UNAVAILABLE" : execution.macdHistogram.toFixed(4)}.` : "Execution momentum unavailable."),
      component("structure", "Structure", structureScore, structureScore === null ? "UNAVAILABLE" : plan.targets.length ? "SUPPORTED" : "LIMITED", plan.targets.length ? "Entry, stop, and target structure are present." : "Only partial level structure is present."),
      component("volume", "Volume", volumeScore, volumeScore === null ? "UNAVAILABLE" : "SUPPORTED", volumeScore === null ? "No valid volume evidence." : "Existing execution volume expansion."),
      component("volatility", "Volatility", volatilityScore, volatilityScore === null ? "UNAVAILABLE" : "SUPPORTED", volatilityScore === null ? "ATR evidence unavailable." : "Existing ATR evidence."),
      component("marketRegime", "Market regime", regimeScore, regimeScore === null ? "UNAVAILABLE" : "SUPPORTED", plan.regimeClassification ?? "Market regime unavailable."),
      component("rewardRisk", "Reward/Risk", rrScore, rrScore === null ? "UNAVAILABLE" : "SUPPORTED", plan.rewardRisk === null ? "R:R unavailable." : `${plan.rewardRisk.toFixed(2)}R from existing target path.`),
      component("confirmation", "Confirmation", confirmationScore, confirmationScore === null ? "UNAVAILABLE" : confirmationScore >= 70 ? "SUPPORTED" : "LIMITED", confirmationScore === null ? "Confirmation unavailable." : "Existing confirmation timeframe evidence."),
    ],
    confirmationGaps,
    warnings,
  };
}

export function qualifyAdaptive(plan: TradeSetupPlan): AdaptiveQualification {
  const quality = qualityFor(plan);
  const dataUnavailable = plan.availability !== "LIVE" || !plan.dataBundle.coherent || !plan.dataBundle.eligibleForScoring || plan.currentPrice === null;
  if (dataUnavailable) return { status: "DATA UNAVAILABLE", direction: plan.direction, strategy: plan.mode, timeframe: plan.timeframes.execution, quality, reasons: plan.unavailable?.length ? plan.unavailable : [plan.dataBundle.statusMessage], warnings: quality.warnings, dataQuality: "UNAVAILABLE", eligibleForAutoPaper: false };
  const reasons = plan.evidence.length ? plan.evidence : ["Validated directional and timeframe evidence is available."];
  const validPlan = plan.direction !== "NO TRADE" && plan.entryZone !== null && plan.stop !== null && plan.targets.length > 0 && plan.rewardRisk !== null;
  if (!validPlan) {
    const status: AdaptiveStatus = plan.watch ? "WATCH" : quality.score !== null && quality.score >= 45 ? "CAUTION" : "NO TRADE";
    return { status, direction: plan.direction, strategy: plan.mode, timeframe: plan.timeframes.execution, quality, reasons, warnings: quality.warnings, dataQuality: "GOOD", eligibleForAutoPaper: false };
  }
  const strong = plan.actionable && (quality.score ?? 0) >= 75;
  const status: AdaptiveStatus = strong ? "STRONG SETUP" : plan.actionable ? "QUALIFIED" : plan.regimeClassification === "RISK OFF" || quality.confidence === "LOW" ? "LOW CONFIDENCE" : "POTENTIAL";
  return { status, direction: plan.direction, strategy: plan.mode, timeframe: plan.timeframes.execution, quality, reasons, warnings: quality.warnings, dataQuality: quality.warnings.length ? "WARNING" : "GOOD", eligibleForAutoPaper: status === "QUALIFIED" || status === "STRONG SETUP" };
}

export function isVisibleInAdaptiveMode(status: AdaptiveStatus, mode: AdaptiveTradingMode) {
  if (status === "DATA UNAVAILABLE" || status === "NO TRADE") return true;
  if (mode === "CONSERVATIVE") return status === "STRONG SETUP" || status === "QUALIFIED";
  if (mode === "BALANCED") return status === "STRONG SETUP" || status === "QUALIFIED" || status === "POTENTIAL";
  if (mode === "OPPORTUNITY") return true;
  return true;
}
