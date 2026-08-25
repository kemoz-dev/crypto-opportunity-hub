import type { Candle, MarketRegime, ScannerResponse, ScannerRow, ScoringConfig, Timeframe, TimeframeAnalysis } from "../../shared/crypto";
import { calculateAtr } from "./technical";
import { fetchValidatedLiveOhlcv } from "./providers";
import { buildLiveScanner } from "./marketService";

export type TradeSetupMode = "SCALP" | "SWING";
export type TradeSetupDirection = "LONG" | "SHORT" | "NO TRADE";
export type TradeHealthState = "HEALTHY" | "CAUTION" | "THREATENED" | "INVALIDATED" | "DATA UNAVAILABLE";
export type TradeSetupDiagnosticStatus = "PASSED" | "FAILED" | "UNAVAILABLE" | "STALE";

export type TradeSetupCondition = {
  key: "live_price" | "freshness" | "execution_analysis" | "confirmation_analysis" | "context_analysis" | "opportunity_direction" | "atr" | "entry_zone" | "structural_stop" | "target_structure" | "risk_reward";
  label: string;
  status: TradeSetupDiagnosticStatus;
  actual: string;
  required: string;
  detail: string;
};

export type TradeSetupDiagnosticSummary = {
  evaluatedAssets: number;
  noTradeAssets: number;
  byCondition: Array<{ key: TradeSetupCondition["key"]; label: string; passed: number; failed: number; unavailable: number; stale: number }>;
  topNoTradeReasons: Array<{ key: TradeSetupCondition["key"]; label: string; count: number; status: Exclude<TradeSetupDiagnosticStatus, "PASSED"> }>;
  classification: { lackOfMarketSetups: number; missingData: number; staleData: number; existingSetupRequirement: number };
};

type SetupProfile = { execution: Timeframe; confirmation: Timeframe; context: Timeframe; horizon: "SHORT" | "MEDIUM" | "EXTENDED"; minimumLabel: string };

export const LOWER_TIMEFRAME_DATA_READY = false;
export const TRADE_SETUP_ENGINE_VERSION = "TRADE_SETUP_ENGINE_V1";

const PROFILES: Record<TradeSetupMode, SetupProfile> = {
  SCALP: { execution: "15m", confirmation: "1h", context: "4h", horizon: "SHORT", minimumLabel: "Current minimum validated timeframe: 15M" },
  SWING: { execution: "1h", confirmation: "4h", context: "1d", horizon: "MEDIUM", minimumLabel: "Current minimum validated timeframe: 15M" },
};

const round = (value: number, digits = 8) => Number(value.toFixed(digits));
const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

export type TradeSetupLevel = { label: "ENTRY LOW" | "ENTRY HIGH" | "PREFERRED ENTRY" | "STOP" | "INVALIDATION" | "TP1" | "TP2" | "TP3"; price: number; reason: string; priority: "PRIMARY" | "SECONDARY" | "EXTENDED" };

export type TradeSetupPlan = {
  engineVersion: typeof TRADE_SETUP_ENGINE_VERSION;
  mode: TradeSetupMode;
  actionable: boolean;
  availability: "LIVE" | "STALE" | "UNAVAILABLE";
  minimumValidatedTimeframe: string;
  assetId: string;
  symbol: string;
  direction: TradeSetupDirection;
  setupType: string;
  expectedHorizon: SetupProfile["horizon"] | "UNAVAILABLE";
  dataTimestamp: number | null;
  provider: string | null;
  timeframes: { execution: Timeframe; confirmation: Timeframe; context: Timeframe };
  opportunityScore: number | null;
  regimeScore: number | null;
  regimeClassification: MarketRegime["classification"] | null;
  marketContext: "SUPPORTIVE" | "NEUTRAL" | "HOSTILE" | "UNAVAILABLE";
  tradeSetupQuality: number | null;
  entryZone: { low: number; high: number; preferred: number; reason: string } | null;
  stop: TradeSetupLevel | null;
  invalidation: TradeSetupLevel | null;
  targets: TradeSetupLevel[];
  rewardRisk: number | null;
  evidence: string[];
  risks: string[];
  unavailable: string[];
  diagnostics: TradeSetupCondition[];
  executionState: TimeframeAnalysis | null;
  confirmationState: TimeframeAnalysis | null;
  contextState: TimeframeAnalysis | null;
};

type DerivedLevels = Pick<TradeSetupPlan, "entryZone" | "stop" | "invalidation" | "targets" | "rewardRisk">;
type LevelDerivation = { state: "VALID" | "NO_PIVOT" | "INVALID_STOP" | "NO_TARGET" | "RR_BELOW_MINIMUM"; levels: DerivedLevels | null; preferred: number | null; pivot: number | null; stopPrice: number | null; firstTarget: number | null; rewardRisk: number | null };
const MINIMUM_REWARD_RISK = 1;

function emptyPlan(mode: TradeSetupMode, row: ScannerRow | null, regime: MarketRegime | null, reason: string, availability: TradeSetupPlan["availability"] = "UNAVAILABLE"): TradeSetupPlan {
  const profile = PROFILES[mode];
  return {
    engineVersion: TRADE_SETUP_ENGINE_VERSION,
    mode,
    actionable: false,
    availability,
    minimumValidatedTimeframe: profile.minimumLabel,
    assetId: row?.asset.id ?? "UNAVAILABLE",
    symbol: row?.asset.symbol ?? "UNAVAILABLE",
    direction: "NO TRADE",
    setupType: row?.score?.setupType ?? "UNAVAILABLE",
    expectedHorizon: "UNAVAILABLE",
    dataTimestamp: null,
    provider: null,
    timeframes: { execution: profile.execution, confirmation: profile.confirmation, context: profile.context },
    opportunityScore: row?.score?.score ?? null,
    regimeScore: regime?.score ?? null,
    regimeClassification: regime?.classification ?? null,
    marketContext: regime ? (regime.classification === "RISK ON" ? "SUPPORTIVE" : regime.classification === "RISK OFF" ? "HOSTILE" : "NEUTRAL") : "UNAVAILABLE",
    tradeSetupQuality: null,
    entryZone: null,
    stop: null,
    invalidation: null,
    targets: [],
    rewardRisk: null,
    evidence: [],
    risks: [],
    unavailable: [reason],
    diagnostics: [],
    executionState: null,
    confirmationState: null,
    contextState: null,
  };
}

function analysisFor(row: ScannerRow, timeframe: Timeframe) {
  return row.score?.technicalByTimeframe.find(item => item.timeframe === timeframe) ?? null;
}

function lastPivot(candles: Candle[], kind: "high" | "low") {
  for (let index = candles.length - 3; index >= Math.max(2, candles.length - 48); index -= 1) {
    const value = candles[index][kind];
    const compare = kind === "high" ? (left: number, right: number) => left >= right : (left: number, right: number) => left <= right;
    if (compare(value, candles[index - 1][kind]) && compare(value, candles[index + 1][kind]) && compare(value, candles[index - 2][kind]) && compare(value, candles[index + 2][kind])) return value;
  }
  return null;
}

function historicalLevels(candles: Candle[], kind: "high" | "low", direction: TradeSetupDirection, price: number) {
  const levels = candles.slice(-72, -2).map(candle => candle[kind]).filter(value => direction === "LONG" ? value > price : value < price);
  return Array.from(new Set(levels.map(value => round(value, 8)))).sort((left, right) => direction === "LONG" ? left - right : right - left);
}

function directionFrom(score: ScannerRow["score"], regime: MarketRegime | null): TradeSetupDirection {
  if (!score || regime?.classification === "RISK OFF") return "NO TRADE";
  return score.direction === "bullish" ? "LONG" : score.direction === "bearish" ? "SHORT" : "NO TRADE";
}

function contextLabel(regime: MarketRegime | null): TradeSetupPlan["marketContext"] {
  if (!regime) return "UNAVAILABLE";
  if (regime.classification === "RISK ON") return "SUPPORTIVE";
  if (regime.classification === "RISK OFF") return "HOSTILE";
  return "NEUTRAL";
}

function matches(direction: TradeSetupDirection, analysis: TimeframeAnalysis | null) {
  return direction === "LONG" ? analysis?.bias === "bullish" : direction === "SHORT" ? analysis?.bias === "bearish" : false;
}

function quality(direction: TradeSetupDirection, execution: TimeframeAnalysis, confirmation: TimeframeAnalysis, context: TimeframeAnalysis, rewardRisk: number, regime: MarketRegime | null) {
  const executionAlignment = matches(direction, execution) ? 25 : 0;
  const confirmationAlignment = matches(direction, confirmation) ? 20 : 0;
  const contextAlignment = matches(direction, context) ? 15 : 0;
  const volume = (execution.volumeExpansion ?? 0) >= 1 ? 10 : 0;
  const riskReward = clamp(rewardRisk / 3 * 20, 0, 20);
  const regimeWeight = regime?.classification === "RISK ON" ? 10 : regime?.classification === "SELECTIVE" ? 5 : 0;
  return round(executionAlignment + confirmationAlignment + contextAlignment + volume + riskReward + regimeWeight, 1);
}

function buildLevels(direction: TradeSetupDirection, candles: Candle[], currentPrice: number, atr: number): LevelDerivation {
  const ema20 = candles.slice(-20).reduce((sum, candle) => sum + candle.close, 0) / 20;
  const entryLow = direction === "LONG" ? Math.min(currentPrice, ema20) : Math.min(currentPrice, ema20);
  const entryHigh = direction === "LONG" ? Math.max(currentPrice, ema20) : Math.max(currentPrice, ema20);
  const preferred = round(ema20, 8);
  const pivot = lastPivot(candles, direction === "LONG" ? "low" : "high");
  const buffer = atr * 0.25;
  const stopPrice = pivot === null ? null : direction === "LONG" ? pivot - buffer : pivot + buffer;
  if (pivot === null) return { state: "NO_PIVOT", levels: null, preferred: round(ema20, 8), pivot: null, stopPrice: null, firstTarget: null, rewardRisk: null };
  if (stopPrice === null || (direction === "LONG" ? stopPrice >= entryLow : stopPrice <= entryHigh)) return { state: "INVALID_STOP", levels: null, preferred: round(ema20, 8), pivot, stopPrice, firstTarget: null, rewardRisk: null };
  const perUnitRisk = Math.abs(preferred - stopPrice);
  if (!Number.isFinite(perUnitRisk) || perUnitRisk <= 0) return { state: "INVALID_STOP", levels: null, preferred, pivot, stopPrice, firstTarget: null, rewardRisk: null };
  const candidates = historicalLevels(candles, direction === "LONG" ? "high" : "low", direction, preferred);
  const extensions = [2, 3, 4].map(multiplier => round(direction === "LONG" ? preferred + atr * multiplier : preferred - atr * multiplier, 8));
  const prices = Array.from(new Set([...candidates, ...extensions])).filter(price => direction === "LONG" ? price > preferred : price < preferred).slice(0, 3);
  if (!prices.length) return { state: "NO_TARGET", levels: null, preferred, pivot, stopPrice, firstTarget: null, rewardRisk: null };
  const targets = prices.map((price, index) => ({ label: (`TP${index + 1}` as "TP1" | "TP2" | "TP3"), price, reason: candidates.includes(price) ? "Nearest validated swing structure" : "ATR-based volatility extension", priority: index === 0 ? "PRIMARY" as const : index === 1 ? "SECONDARY" as const : "EXTENDED" as const }));
  const rr = Math.abs(targets[0].price - preferred) / perUnitRisk;
  if (!Number.isFinite(rr) || rr < MINIMUM_REWARD_RISK) return { state: "RR_BELOW_MINIMUM", levels: null, preferred, pivot, stopPrice, firstTarget: targets[0]?.price ?? null, rewardRisk: Number.isFinite(rr) ? round(rr, 2) : null };
  return { state: "VALID", preferred, pivot, stopPrice, firstTarget: targets[0]?.price ?? null, rewardRisk: round(rr, 2), levels: {
    entryZone: { low: round(entryLow, 8), high: round(entryHigh, 8), preferred, reason: "Current price and execution-timeframe EMA20 define the validated timing zone." },
    stop: { label: "STOP" as const, price: round(stopPrice, 8), reason: "Recent structural pivot with a 0.25 ATR volatility buffer.", priority: "PRIMARY" as const },
    invalidation: { label: "INVALIDATION" as const, price: round(stopPrice, 8), reason: "Crossing this structural level invalidates the recorded setup context.", priority: "PRIMARY" as const },
    targets,
    rewardRisk: round(rr, 2),
  } };
}

const diagnostic = (key: TradeSetupCondition["key"], label: string, status: TradeSetupDiagnosticStatus, actual: string, required: string, detail: string): TradeSetupCondition => ({ key, label, status, actual, required, detail });
const numberLabel = (value: number | null | undefined, digits = 2) => value == null || !Number.isFinite(value) ? "UNAVAILABLE" : Number(value.toFixed(digits)).toString();
const analysisActual = (analysis: TimeframeAnalysis | null) => analysis ? `Bias ${analysis.bias}; RSI ${numberLabel(analysis.rsi)}; MACD histogram ${numberLabel(analysis.macdHistogram, 4)}.` : "UNAVAILABLE";

function buildDiagnostics(plan: TradeSetupPlan, row: ScannerRow, regime: MarketRegime | null, atr: number | null, derivation: LevelDerivation | null): TradeSetupCondition[] {
  const existingDirection = directionFrom(row.score, regime);
  const analysisCondition = (key: "execution_analysis" | "confirmation_analysis" | "context_analysis", label: string, analysis: TimeframeAnalysis | null, timeframe: Timeframe) => diagnostic(key, label, analysis ? "PASSED" : "UNAVAILABLE", analysisActual(analysis), `Validated ${timeframe.toUpperCase()} technical analysis is required.`, analysis ? "Current validated analysis is available; bias is shown as evidence, not an added eligibility threshold." : "This required analysis was unavailable, so the setup engine cannot verify the corresponding input.");
  const directionCondition = !row.score
    ? diagnostic("opportunity_direction", "Existing Opportunity direction", "UNAVAILABLE", "UNAVAILABLE", "Existing Opportunity direction must be bullish or bearish and the market must not be Risk Off.", "The existing Opportunity inputs were unavailable; no direction was inferred.")
    : regime?.classification === "RISK OFF"
      ? diagnostic("opportunity_direction", "Existing Opportunity direction", "FAILED", "Market regime is RISK OFF.", "Existing Opportunity direction must be bullish or bearish and the market must not be Risk Off.", "The existing setup engine rejects a directional plan in Risk Off conditions.")
      : existingDirection === "NO TRADE"
        ? diagnostic("opportunity_direction", "Existing Opportunity direction", "FAILED", `Existing Opportunity direction is ${row.score.direction}.`, "Existing Opportunity direction must be bullish or bearish and the market must not be Risk Off.", "The existing setup engine did not provide a directional thesis, so levels were not evaluated.")
        : diagnostic("opportunity_direction", "Existing Opportunity direction", "PASSED", `Existing Opportunity direction is ${existingDirection}.`, "Existing Opportunity direction must be bullish or bearish and the market must not be Risk Off.", "The existing direction gate passed without changing Opportunity or Regime scoring.");
  const levelsNotEvaluated = existingDirection === "NO TRADE" || !plan.executionState || !plan.confirmationState || !plan.contextState;
  const atrCondition = levelsNotEvaluated
    ? diagnostic("atr", "Execution ATR", "UNAVAILABLE", "Not evaluated because an earlier required setup input did not pass or was unavailable.", "A positive ATR on the validated execution timeframe is required to derive technical levels.", "No ATR-based level was constructed after an earlier gate stopped the existing engine.")
    : atr == null || atr <= 0
      ? diagnostic("atr", "Execution ATR", "UNAVAILABLE", "ATR is unavailable or non-positive.", "A positive ATR on the validated execution timeframe is required to derive technical levels.", "The existing engine cannot create a volatility buffer without ATR.")
      : diagnostic("atr", "Execution ATR", "PASSED", `ATR ${numberLabel(atr, 6)} on ${plan.timeframes.execution.toUpperCase()}.`, "A positive ATR on the validated execution timeframe is required to derive technical levels.", "ATR supports the existing 0.25 ATR structural buffer; no buffer rule was changed.");
  const hasEntry = derivation?.preferred != null;
  const stopStatus: TradeSetupDiagnosticStatus = derivation?.state === "VALID" || derivation?.state === "NO_TARGET" || derivation?.state === "RR_BELOW_MINIMUM" ? "PASSED" : derivation?.state === "INVALID_STOP" ? "FAILED" : "UNAVAILABLE";
  const targetStatus: TradeSetupDiagnosticStatus = derivation?.state === "VALID" || derivation?.state === "RR_BELOW_MINIMUM" ? "PASSED" : derivation?.state === "NO_TARGET" ? "FAILED" : "UNAVAILABLE";
  const rrStatus: TradeSetupDiagnosticStatus = derivation?.state === "VALID" ? "PASSED" : derivation?.state === "RR_BELOW_MINIMUM" ? "FAILED" : "UNAVAILABLE";
  return [
    diagnostic("live_price", "Validated live price", row.asset.price == null ? "UNAVAILABLE" : "PASSED", row.asset.price == null ? "UNAVAILABLE" : `Price ${numberLabel(row.asset.price, 8)}.`, "A validated live price is required.", row.asset.price == null ? "No validated price is available for this asset." : "The current plan used the existing scanner price."),
    diagnostic("freshness", "Input freshness", plan.availability === "STALE" ? "STALE" : plan.dataTimestamp == null ? "UNAVAILABLE" : "PASSED", plan.dataTimestamp == null ? "UNAVAILABLE" : `${new Date(plan.dataTimestamp).toISOString()} · ${plan.availability}.`, "Provider inputs must be marked live with a timestamp.", plan.availability === "STALE" ? "Existing provider freshness marked this result stale; no plan is treated as current." : plan.dataTimestamp == null ? "No live execution-series timestamp was available." : "The validated execution series carried a live retrieval timestamp."),
    analysisCondition("execution_analysis", `${plan.timeframes.execution.toUpperCase()} execution analysis`, plan.executionState, plan.timeframes.execution),
    analysisCondition("confirmation_analysis", `${plan.timeframes.confirmation.toUpperCase()} confirmation analysis`, plan.confirmationState, plan.timeframes.confirmation),
    analysisCondition("context_analysis", `${plan.timeframes.context.toUpperCase()} context analysis`, plan.contextState, plan.timeframes.context),
    directionCondition,
    atrCondition,
    diagnostic("entry_zone", "Valid entry zone", hasEntry ? "PASSED" : "UNAVAILABLE", hasEntry ? `EMA20 preferred entry ${numberLabel(derivation?.preferred, 8)}.` : "Not derived because earlier setup inputs were unavailable or the direction gate failed.", "Execution-timeframe price and EMA20 must define a validated timing zone.", hasEntry ? "The current price/EMA20 zone was derived by the existing level method." : "No entry zone is presented when the existing engine has not reached level derivation."),
    diagnostic("structural_stop", "Structural stop", stopStatus, derivation?.stopPrice == null ? "UNAVAILABLE" : `Structural stop ${numberLabel(derivation.stopPrice, 8)}; pivot ${numberLabel(derivation.pivot, 8)}.`, "A structural pivot stop must be valid relative to the entry zone.", derivation?.state === "NO_PIVOT" ? "No qualifying recent structural pivot was found." : derivation?.state === "INVALID_STOP" ? "The derived stop was not valid relative to the entry zone." : stopStatus === "PASSED" ? "The structural stop passed the existing validity check." : "Stop evaluation was not reached because an earlier input was unavailable."),
    diagnostic("target_structure", "First technical target", targetStatus, derivation?.firstTarget == null ? "UNAVAILABLE" : `Nearest technical target ${numberLabel(derivation.firstTarget, 8)}.`, "At least one target above entry for LONG or below entry for SHORT must be derivable from validated structure or ATR extension.", derivation?.state === "NO_TARGET" ? "No eligible target in the required direction was found." : targetStatus === "PASSED" ? "At least one target was derived by the existing structure/ATR method." : "Target evaluation was not reached because earlier level inputs were unavailable."),
    diagnostic("risk_reward", "Risk / Reward", rrStatus, derivation?.rewardRisk == null ? "UNAVAILABLE" : `Current R:R ${numberLabel(derivation.rewardRisk)}:1.`, `Minimum required: ${MINIMUM_REWARD_RISK}:1 under the existing setup engine.`, derivation?.state === "RR_BELOW_MINIMUM" ? "The first derived target did not satisfy the existing minimum R:R requirement; no threshold was loosened." : rrStatus === "PASSED" ? "The first derived target satisfied the existing minimum R:R requirement." : "R:R was not evaluated because a valid stop and target were not both available."),
  ];
}

function withDiagnostics(plan: TradeSetupPlan, row: ScannerRow, regime: MarketRegime | null, atr: number | null = null, derivation: LevelDerivation | null = null): TradeSetupPlan {
  return { ...plan, diagnostics: buildDiagnostics(plan, row, regime, atr, derivation) };
}

export function summarizeDiagnostics(plans: TradeSetupPlan[]): TradeSetupDiagnosticSummary {
  const byCondition = new Map<TradeSetupCondition["key"], { key: TradeSetupCondition["key"]; label: string; passed: number; failed: number; unavailable: number; stale: number }>();
  const reasons = new Map<string, { key: TradeSetupCondition["key"]; label: string; count: number; status: Exclude<TradeSetupDiagnosticStatus, "PASSED"> }>();
  let lackOfMarketSetups = 0;
  let missingData = 0;
  let staleData = 0;
  let existingSetupRequirement = 0;
  for (const plan of plans) {
    for (const condition of plan.diagnostics) {
      const current = byCondition.get(condition.key) ?? { key: condition.key, label: condition.label, passed: 0, failed: 0, unavailable: 0, stale: 0 };
      if (condition.status === "PASSED") current.passed += 1;
      if (condition.status === "FAILED") current.failed += 1;
      if (condition.status === "UNAVAILABLE") current.unavailable += 1;
      if (condition.status === "STALE") current.stale += 1;
      byCondition.set(condition.key, current);
      if (!plan.actionable && condition.status !== "PASSED") {
        const reasonKey = `${condition.key}:${condition.status}`;
        const reason = reasons.get(reasonKey) ?? { key: condition.key, label: condition.label, count: 0, status: condition.status };
        reason.count += 1;
        reasons.set(reasonKey, reason);
      }
    }
    if (!plan.actionable) {
      const statuses = plan.diagnostics.map(condition => condition.status);
      const failedKeys = new Set(plan.diagnostics.filter(condition => condition.status === "FAILED").map(condition => condition.key));
      if (statuses.includes("UNAVAILABLE")) missingData += 1;
      else if (statuses.includes("STALE")) staleData += 1;
      else if (failedKeys.has("risk_reward")) existingSetupRequirement += 1;
      else lackOfMarketSetups += 1;
    }
  }
  return {
    evaluatedAssets: plans.length,
    noTradeAssets: plans.filter(plan => !plan.actionable).length,
    byCondition: Array.from(byCondition.values()),
    topNoTradeReasons: Array.from(reasons.values()).sort((left, right) => right.count - left.count || left.label.localeCompare(right.label)).slice(0, 5),
    classification: { lackOfMarketSetups, missingData, staleData, existingSetupRequirement },
  };
}

export function buildTradeSetupPlan(mode: TradeSetupMode, row: ScannerRow, regime: MarketRegime | null, candles: Candle[], provider: string, timestamp: number): TradeSetupPlan {
  const profile = PROFILES[mode];
  const execution = analysisFor(row, profile.execution);
  const confirmation = analysisFor(row, profile.confirmation);
  const context = analysisFor(row, profile.context);
  if (!row.score || row.asset.price === null) return withDiagnostics(emptyPlan(mode, row, regime, "Validated live price and Opportunity inputs are required."), row, regime);
  if (!execution || !confirmation || !context) return withDiagnostics(emptyPlan(mode, row, regime, "Required validated multi-timeframe analysis is unavailable."), row, regime);
  const direction = directionFrom(row.score, regime);
  if (direction === "NO TRADE") return withDiagnostics({ ...emptyPlan(mode, row, regime, regime?.classification === "RISK OFF" ? "Market context is hostile; no actionable plan is presented." : "Existing Opportunity direction is neutral; no trade plan is presented.", "LIVE"), executionState: execution, confirmationState: confirmation, contextState: context, dataTimestamp: timestamp, provider }, row, regime);
  const atr = calculateAtr(candles);
  if (atr === null || atr <= 0) return withDiagnostics({ ...emptyPlan(mode, row, regime, "ATR is unavailable on the validated execution timeframe, so technical levels cannot be derived."), executionState: execution, confirmationState: confirmation, contextState: context, dataTimestamp: timestamp, provider }, row, regime, atr);
  const derivation = buildLevels(direction, candles, row.asset.price, atr);
  if (!derivation.levels) return withDiagnostics({ ...emptyPlan(mode, row, regime, "A structurally valid stop and at least one positive risk/reward target could not be derived; NO TRADE."), executionState: execution, confirmationState: confirmation, contextState: context, dataTimestamp: timestamp, provider }, row, regime, atr, derivation);
  const levels = derivation.levels;
  const setupQuality = quality(direction, execution, confirmation, context, levels.rewardRisk!, regime);
  const evidence = [
    ...execution.reasons.filter(reason => reason.direction === "positive").map(reason => `${profile.execution.toUpperCase()}: ${reason.label}`),
    ...confirmation.reasons.filter(reason => reason.direction === "positive").map(reason => `${profile.confirmation.toUpperCase()}: ${reason.label}`),
    matches(direction, context) ? `${profile.context.toUpperCase()} context confirms the selected direction.` : `${profile.context.toUpperCase()} context is not a confirming signal.`,
  ];
  const risks = [
    ...execution.reasons.filter(reason => reason.direction === "negative").map(reason => `${profile.execution.toUpperCase()}: ${reason.label}`),
    ...confirmation.reasons.filter(reason => reason.direction === "negative").map(reason => `${profile.confirmation.toUpperCase()}: ${reason.label}`),
    !matches(direction, context) ? `${profile.context.toUpperCase()} context conflicts with or does not confirm this setup.` : "",
  ].filter(Boolean);
  return withDiagnostics({
    engineVersion: TRADE_SETUP_ENGINE_VERSION,
    mode,
    actionable: true,
    availability: "LIVE",
    minimumValidatedTimeframe: profile.minimumLabel,
    assetId: row.asset.id,
    symbol: row.asset.symbol,
    direction,
    setupType: row.score.setupType,
    expectedHorizon: profile.horizon,
    dataTimestamp: timestamp,
    provider,
    timeframes: { execution: profile.execution, confirmation: profile.confirmation, context: profile.context },
    opportunityScore: row.score.score,
    regimeScore: regime?.score ?? null,
    regimeClassification: regime?.classification ?? null,
    marketContext: contextLabel(regime),
    tradeSetupQuality: setupQuality,
    ...levels,
    evidence,
    risks,
    unavailable: [],
    diagnostics: [],
    executionState: execution,
    confirmationState: confirmation,
    contextState: context,
  }, row, regime, atr, derivation);
}

export async function getTradeSetups(mode: TradeSetupMode, configuration: ScoringConfig) {
  const scan = await buildLiveScanner(false, configuration);
  const profile = PROFILES[mode];
  const minimumCandles = Math.max(configuration.indicator.emaSlow + 2, configuration.indicator.macdSlow + configuration.indicator.macdSignal + 2, 60);
  const setups = await Promise.all(scan.rows.map(row => getTradeSetupForRow(mode, row, scan.marketRegime, configuration, minimumCandles)));
  const ordered = setups.sort((left, right) => Number(right.actionable) - Number(left.actionable) || (right.tradeSetupQuality ?? -1) - (left.tradeSetupQuality ?? -1) || (right.opportunityScore ?? -1) - (left.opportunityScore ?? -1));
  return { mode, generatedAt: scan.generatedAt, lowerTimeframeDataReady: LOWER_TIMEFRAME_DATA_READY, minimumValidatedTimeframe: PROFILES[mode].minimumLabel, marketRegime: scan.marketRegime, diagnostics: summarizeDiagnostics(ordered), setups: ordered };
}

export async function getTradeSetupForRow(mode: TradeSetupMode, row: ScannerRow, regime: MarketRegime | null, configuration: ScoringConfig, minimumCandles = Math.max(configuration.indicator.emaSlow + 2, configuration.indicator.macdSlow + configuration.indicator.macdSignal + 2, 60)) {
  const profile = PROFILES[mode];
  const ohlcv = await fetchValidatedLiveOhlcv(row.asset.symbol, profile.execution, minimumCandles);
  const expectedProvider = row.dataStatus.find(status => status.capability === "OHLCV" && status.timeframe === profile.execution && status.status === "live")?.provider ?? null;
  if (!ohlcv.series || (expectedProvider !== null && expectedProvider !== ohlcv.series.provider)) return withDiagnostics(emptyPlan(mode, row, regime, expectedProvider ? "Execution OHLCV provider coherence could not be verified." : "Validated execution OHLCV is unavailable."), row, regime);
  return buildTradeSetupPlan(mode, row, regime, ohlcv.series.candles, ohlcv.series.provider, ohlcv.series.retrievedAt);
}

export function buildTradeHealth(plan: TradeSetupPlan | null | undefined, current: { price: number | null; execution: TimeframeAnalysis | null; confirmation: TimeframeAnalysis | null; context: TimeframeAnalysis | null; generatedAt: number | null }) {
  if (!plan || !plan.actionable || current.price === null || !plan.stop || !plan.invalidation) return { state: "DATA UNAVAILABLE" as const, reasons: ["A valid immutable setup plan or current validated price is unavailable."], targetProgress: [], reversalWarning: null };
  const price = current.price;
  const invalidated = plan.direction === "LONG" ? price <= plan.invalidation.price : price >= plan.invalidation.price;
  const threatened = !matches(plan.direction, current.execution) || !matches(plan.direction, current.confirmation);
  const executionHistogramWeakening = current.execution?.macdHistogram != null && plan.executionState?.macdHistogram != null && Math.abs(current.execution.macdHistogram) < Math.abs(plan.executionState.macdHistogram);
  const executionRsiWeakening = current.execution?.rsi != null && plan.executionState?.rsi != null && (plan.direction === "LONG" ? current.execution.rsi < plan.executionState.rsi - 5 : current.execution.rsi > plan.executionState.rsi + 5);
  const weakening = executionHistogramWeakening || executionRsiWeakening;
  const state: TradeHealthState = invalidated ? "INVALIDATED" : threatened ? "THREATENED" : weakening ? "CAUTION" : "HEALTHY";
  const reasons = [
    invalidated ? `Current price crossed immutable invalidation ${plan.invalidation.price}.` : `Current price remains ${plan.direction === "LONG" ? "above" : "below"} immutable invalidation ${plan.invalidation.price}.`,
    current.execution ? `${plan.timeframes.execution.toUpperCase()} technical state is ${current.execution.bias}.` : "Execution timeframe update is unavailable.",
    current.confirmation ? `${plan.timeframes.confirmation.toUpperCase()} confirmation is ${current.confirmation.bias}.` : "Confirmation timeframe update is unavailable.",
  ];
  const targetProgress = plan.targets.map(target => {
    const reached = plan.direction === "LONG" ? price >= target.price : price <= target.price;
    const denominator = target.price - plan.entryZone!.preferred;
    const progress = denominator === 0 ? null : round((price - plan.entryZone!.preferred) / denominator * 100, 1);
    return { ...target, reached, progressPercent: progress, distancePercent: round((target.price - price) / Math.max(price, Number.EPSILON) * 100, 2) };
  });
  return { state, reasons, targetProgress, reversalWarning: state === "THREATENED" || state === "INVALIDATED" ? "Potential reversal warning: current validated technical state no longer supports the immutable entry thesis." : null };
}
