import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { researchExperimentResults, researchExperiments } from "../../drizzle/schema";
import { DEFAULT_ASSET_UNIVERSE, type Candle, type ScoringConfig, type Timeframe } from "../../shared/crypto";
import { getDb } from "../db";
import { fetchBinanceCandlesForResearch } from "./providers";
import { analyzeTimeframe } from "./technical";

export const RESEARCH_PROTOCOL_VERSION = "OPPORTUNITY_RESEARCH_LAB_V1";
export const EXPERIMENTS = [
  { id: "A", label: "RSI + MACD", variables: ["RSI", "MACD"] },
  { id: "B", label: "RSI + MACD + EMA", variables: ["RSI", "MACD", "EMA"] },
  { id: "C", label: "RSI + MACD + EMA + Volume", variables: ["RSI", "MACD", "EMA", "Volume"] },
  { id: "D", label: "RSI + MACD + EMA + Volume + Relative Strength", variables: ["RSI", "MACD", "EMA", "Volume", "Relative Strength versus BTC"] },
  { id: "E", label: "RSI + MACD + EMA + Volume + Relative Strength + Multi-Timeframe", variables: ["RSI", "MACD", "EMA", "Volume", "Relative Strength versus BTC", "Completed higher-timeframe confirmation"] },
] as const;

export type ExperimentId = (typeof EXPERIMENTS)[number]["id"];
export type ResearchEvidenceStatus = "SUPPORTED" | "WEAK EVIDENCE" | "UNSUPPORTED" | "INSUFFICIENT DATA";
export type ResearchDimension = "aggregate" | "combination" | "opportunity_threshold" | "confidence_threshold" | "joint_threshold" | "score_bucket" | "confidence_bucket" | "regime" | "sector" | "in_sample" | "out_of_sample";

export type ResearchExperimentInput = {
  name: string;
  experimentId: ExperimentId;
  assetIds: string[];
  timeframe: Timeframe;
  candleLimit: number;
  startAt?: number;
  endAt?: number;
  minimumOpportunity: number;
  minimumConfidence: number;
  sector?: string;
  regime?: "ALL" | "RISK ON" | "SELECTIVE" | "RISK OFF";
  holdingBars: number;
  riskPercent: number;
  stopAtrMultiplier: number;
  takeProfitRule: "risk-reward" | "holding-close";
  targetRiskReward: number;
  trainPercent: number;
};

type Regime = "RISK ON" | "SELECTIVE" | "RISK OFF" | "UNAVAILABLE";
export type ResearchSignal = {
  assetId: string;
  symbol: string;
  sector: string;
  timeframe: Timeframe;
  decisionAt: number;
  entryAt: number;
  entryPrice: number;
  exitPrice: number;
  exitReason: "stop-loss" | "take-profit" | "holding-close";
  returnPercent: number;
  positionReturnPercent: number;
  rMultiple: number;
  opportunityScore: number;
  confidenceScore: number;
  technicalScore: number;
  relativeStrengthPercent: number | null;
  regime: Regime;
  higherTimeframeConfirmed: boolean | null;
  outcomes: Array<{ label: "24H" | "3D" | "7D" | "30D"; returnPercent: number }>;
  evidence: unknown;
};

type ResearchMetrics = {
  signalCount: number;
  winRate: number | null;
  positiveReturnPercentage: number | null;
  averageReturn: number | null;
  medianReturn: number | null;
  averageR: number | null;
  expectancy: number | null;
  profitFactor: number | null;
  maximumDrawdown: number | null;
  bestOutcome: number | null;
  worstOutcome: number | null;
  sharpeRatio: number | null;
  sortinoRatio: number | null;
  outcomeHorizons: Array<{ label: "24H" | "3D" | "7D" | "30D"; observationCount: number; averageReturn: number | null; medianReturn: number | null }>;
  statisticalGuard: "DESCRIPTIVE_ONLY" | "SAMPLE_SIZE_SUFFICIENT";
};

const round = (value: number, decimals = 2) => Number(value.toFixed(decimals));
const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const timeframes: Record<Timeframe, number> = { "15m": 15 * 60_000, "1h": 60 * 60_000, "4h": 4 * 60 * 60_000, "1d": 24 * 60 * 60_000 };
const higherTimeframe: Partial<Record<Timeframe, Timeframe>> = { "15m": "1h", "1h": "4h", "4h": "1d" };
const horizons = [{ label: "24H" as const, ms: 24 * 60 * 60_000 }, { label: "3D" as const, ms: 3 * 24 * 60 * 60_000 }, { label: "7D" as const, ms: 7 * 24 * 60 * 60_000 }, { label: "30D" as const, ms: 30 * 24 * 60 * 60_000 }];
const opportunityThresholds = [60, 70, 80, 90];
const confidenceThresholds = [60, 70, 80];
const jointThresholds = [{ opportunity: 70, confidence: 70 }, { opportunity: 80, confidence: 70 }, { opportunity: 80, confidence: 80 }, { opportunity: 90, confidence: 80 }];

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

function fingerprint(value: unknown) { return createHash("sha256").update(stable(value)).digest("hex"); }
function median(values: number[]) { if (!values.length) return null; const sorted = [...values].sort((a, b) => a - b); return sorted.length % 2 ? sorted[Math.floor(sorted.length / 2)] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2; }

export function calculateResearchMetrics(signals: ResearchSignal[]): ResearchMetrics {
  const ordered = [...signals].sort((a, b) => a.entryAt - b.entryAt || a.symbol.localeCompare(b.symbol));
  const returns = ordered.map(signal => signal.positionReturnPercent);
  const wins = returns.filter(value => value > 0);
  const losses = returns.filter(value => value < 0);
  const grossProfit = wins.reduce((sum, value) => sum + value, 0);
  const grossLoss = Math.abs(losses.reduce((sum, value) => sum + value, 0));
  let equity = 100_000;
  let peak = equity;
  let maximumDrawdown = 0;
  for (const value of returns) { equity *= 1 + value / 100; peak = Math.max(peak, equity); maximumDrawdown = Math.max(maximumDrawdown, (peak - equity) / peak * 100); }
  const returnsDecimal = returns.map(value => value / 100);
  const mean = returnsDecimal.length ? returnsDecimal.reduce((sum, value) => sum + value, 0) / returnsDecimal.length : null;
  const variance = mean !== null && returnsDecimal.length > 1 ? returnsDecimal.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returnsDecimal.length - 1) : null;
  const downside = mean !== null ? returnsDecimal.filter(value => value < 0) : [];
  const downsideDeviation = downside.length > 1 ? Math.sqrt(downside.reduce((sum, value) => sum + value ** 2, 0) / downside.length) : null;
  const meaningful = signals.length >= 30;
  return {
    signalCount: signals.length,
    winRate: signals.length ? round(wins.length / signals.length * 100) : null,
    positiveReturnPercentage: signals.length ? round(wins.length / signals.length * 100) : null,
    averageReturn: returns.length ? round(returns.reduce((sum, value) => sum + value, 0) / returns.length) : null,
    medianReturn: median(returns) === null ? null : round(median(returns)!),
    averageR: signals.length ? round(signals.reduce((sum, signal) => sum + signal.rMultiple, 0) / signals.length) : null,
    expectancy: signals.length ? round(signals.reduce((sum, signal) => sum + signal.positionReturnPercent, 0) / signals.length) : null,
    profitFactor: grossLoss > 0 ? round(grossProfit / grossLoss) : grossProfit > 0 ? null : 0,
    maximumDrawdown: returns.length ? round(maximumDrawdown) : null,
    bestOutcome: returns.length ? round(Math.max(...returns)) : null,
    worstOutcome: returns.length ? round(Math.min(...returns)) : null,
    sharpeRatio: meaningful && mean !== null && variance && variance > 0 ? round(mean / Math.sqrt(variance) * Math.sqrt(returns.length)) : null,
    sortinoRatio: meaningful && mean !== null && downsideDeviation && downsideDeviation > 0 ? round(mean / downsideDeviation * Math.sqrt(returns.length)) : null,
    outcomeHorizons: horizons.map(horizon => {
      const values = signals.flatMap(signal => signal.outcomes.filter(outcome => outcome.label === horizon.label).map(outcome => outcome.returnPercent));
      return { label: horizon.label, observationCount: values.length, averageReturn: values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : null, medianReturn: median(values) === null ? null : round(median(values)!) };
    }),
    statisticalGuard: meaningful ? "SAMPLE_SIZE_SUFFICIENT" : "DESCRIPTIVE_ONLY",
  };
}

function evidence(signals: ResearchSignal[], requireOutOfSample = false): { status: ResearchEvidenceStatus; reason: string; metrics: ResearchMetrics } {
  const metrics = calculateResearchMetrics(signals);
  if (signals.length < 30) return { status: "INSUFFICIENT DATA", reason: "Fewer than 30 observations are available for this comparison.", metrics };
  if ((metrics.averageReturn ?? 0) > 0 && (metrics.winRate ?? 0) >= 50) return { status: requireOutOfSample ? "WEAK EVIDENCE" : "SUPPORTED", reason: requireOutOfSample ? "The in-sample result is positive, but a separately sufficient out-of-sample result is required for Support." : "The available sample has positive average return and at least a 50% win rate.", metrics };
  if ((metrics.averageReturn ?? 0) > 0 || (metrics.winRate ?? 0) >= 50) return { status: "WEAK EVIDENCE", reason: "The available sample is directionally mixed and needs independent confirmation.", metrics };
  return { status: "UNSUPPORTED", reason: "The available sample does not meet the declared positive-return and win-rate evidence rule.", metrics };
}

function hasPositiveEvidence(analysis: NonNullable<ReturnType<typeof analyzeTimeframe>>, keys: string[]) {
  const positive = new Set(analysis.reasons.filter(reason => reason.direction === "positive").map(reason => reason.key));
  return keys.every(key => positive.has(key));
}

function classifyRegime(btcCandles: Candle[], decisionAt: number, timeframe: Timeframe): Regime {
  const index = btcCandles.findIndex(candle => candle.closeTime === decisionAt);
  const lookback = Math.ceil(24 * 60 * 60_000 / timeframes[timeframe]);
  if (index < lookback) return "UNAVAILABLE";
  const start = btcCandles[index - lookback]?.close;
  const end = btcCandles[index]?.close;
  if (!start || !end) return "UNAVAILABLE";
  const returnPercent = (end - start) / start * 100;
  return returnPercent >= 1 ? "RISK ON" : returnPercent <= -1 ? "RISK OFF" : "SELECTIVE";
}

function relativeStrength(assetCandles: Candle[], btcCandles: Candle[], index: number, timeframe: Timeframe): number | null {
  const lookback = Math.ceil(24 * 60 * 60_000 / timeframes[timeframe]);
  const assetStart = assetCandles[index - lookback]?.close;
  const assetEnd = assetCandles[index]?.close;
  const btcEnd = btcCandles.find(candle => candle.closeTime === assetCandles[index]?.closeTime)?.close;
  const btcIndex = btcCandles.findIndex(candle => candle.closeTime === assetCandles[index]?.closeTime);
  const btcStart = btcIndex >= lookback ? btcCandles[btcIndex - lookback]?.close : undefined;
  if (!assetStart || !assetEnd || !btcStart || !btcEnd) return null;
  return round((assetEnd - assetStart) / assetStart * 100 - (btcEnd - btcStart) / btcStart * 100);
}

function completedHigherTimeframeConfirmation(higherCandles: Candle[] | undefined, decisionAt: number, config: ScoringConfig, timeframe: Timeframe) {
  if (!higherCandles) return null;
  const completed = higherCandles.filter(candle => candle.closeTime <= decisionAt);
  const analysis = analyzeTimeframe(completed, timeframe, config);
  return analysis ? analysis.bias === "bullish" : null;
}

function qualifies(analysis: NonNullable<ReturnType<typeof analyzeTimeframe>>, experimentId: ExperimentId, relativeStrengthPercent: number | null, higherConfirmed: boolean | null) {
  if (!hasPositiveEvidence(analysis, ["rsi", "macd"])) return false;
  if (experimentId === "A") return true;
  if (!hasPositiveEvidence(analysis, ["ema"])) return false;
  if (experimentId === "B") return true;
  if (!hasPositiveEvidence(analysis, ["band-volume"])) return false;
  if (experimentId === "C") return true;
  if (relativeStrengthPercent === null || relativeStrengthPercent <= 0) return false;
  if (experimentId === "D") return true;
  return higherConfirmed === true;
}

function buildSignals(asset: typeof DEFAULT_ASSET_UNIVERSE[number], candles: Candle[], btcCandles: Candle[], higherCandles: Candle[] | undefined, input: ResearchExperimentInput, configuration: ScoringConfig): ResearchSignal[] {
  const required = Math.max(configuration.indicator.emaSlow + 2, configuration.indicator.macdSlow + configuration.indicator.macdSignal + 2, 60);
  const signals: ResearchSignal[] = [];
  for (let index = required; index + input.holdingBars + 1 < candles.length; index += 1) {
    const decisionCandles = candles.slice(0, index + 1);
    const analysis = analyzeTimeframe(decisionCandles, input.timeframe, configuration);
    if (!analysis || analysis.bias !== "bullish") continue;
    const opportunityScore = clamp(analysis.score * 10);
    const confidenceScore = clamp(analysis.score * 8 + ((analysis.volumeExpansion ?? 0) >= 1 ? 10 : 0));
    const relativeStrengthPercent = relativeStrength(candles, btcCandles, index, input.timeframe);
    const higherConfirmed = completedHigherTimeframeConfirmation(higherCandles, candles[index].closeTime, configuration, higherTimeframe[input.timeframe] ?? input.timeframe);
    if (!qualifies(analysis, input.experimentId, relativeStrengthPercent, higherConfirmed)) continue;
    const entryCandle = candles[index + 1];
    const entry = entryCandle.open;
    const stopDistancePercent = Math.max((analysis.atrPercent ?? 2) * input.stopAtrMultiplier, 0.3);
    const stopLoss = entry * (1 - stopDistancePercent / 100);
    const takeProfit = entry * (1 + stopDistancePercent / 100 * input.targetRiskReward);
    let exit = candles[index + input.holdingBars + 1].close;
    let exitReason: ResearchSignal["exitReason"] = "holding-close";
    for (let futureIndex = index + 1; futureIndex <= index + input.holdingBars + 1; futureIndex += 1) {
      const future = candles[futureIndex];
      if (future.low <= stopLoss) { exit = stopLoss; exitReason = "stop-loss"; break; }
      if (input.takeProfitRule === "risk-reward" && future.high >= takeProfit) { exit = takeProfit; exitReason = "take-profit"; break; }
    }
    const returnPercent = (exit - entry) / entry * 100;
    const outcomes = horizons.flatMap(horizon => {
      const outcome = candles[index + 1 + Math.ceil(horizon.ms / timeframes[input.timeframe])];
      return outcome ? [{ label: horizon.label, returnPercent: round((outcome.close - entry) / entry * 100) }] : [];
    });
    signals.push({ assetId: asset.id, symbol: asset.symbol, sector: asset.sector, timeframe: input.timeframe, decisionAt: candles[index].closeTime, entryAt: entryCandle.openTime, entryPrice: round(entry, 8), exitPrice: round(exit, 8), exitReason, returnPercent: round(returnPercent), positionReturnPercent: round(returnPercent / stopDistancePercent * input.riskPercent), rMultiple: round(returnPercent / stopDistancePercent), opportunityScore: round(opportunityScore), confidenceScore: round(confidenceScore), technicalScore: round(analysis.score / 10 * 40), relativeStrengthPercent, regime: classifyRegime(btcCandles, candles[index].closeTime, input.timeframe), higherTimeframeConfirmed: higherConfirmed, outcomes, evidence: { analysis, decisionClose: candles[index].close, stopLoss: round(stopLoss, 8), takeProfit: round(takeProfit, 8), dataCutoffAt: candles[index].closeTime } });
  }
  return signals;
}

function row(dimension: ResearchDimension, dimensionKey: string, signals: ResearchSignal[], requireOutOfSample = false) {
  const result = evidence(signals, requireOutOfSample);
  return { dimension, dimensionKey, signalCount: signals.length, evidenceStatus: result.status, metrics: result.metrics, reason: result.reason };
}

export function buildResearchResultRows(signals: ResearchSignal[], input: ResearchExperimentInput) {
  const base = signals.filter(signal => (!input.sector || input.sector === "ALL" || signal.sector === input.sector) && (!input.regime || input.regime === "ALL" || signal.regime === input.regime));
  const selected = base.filter(signal => signal.opportunityScore >= input.minimumOpportunity && signal.confidenceScore >= input.minimumConfidence);
  const ordered = [...selected].sort((a, b) => a.entryAt - b.entryAt || a.symbol.localeCompare(b.symbol));
  const splitIndex = Math.floor(ordered.length * input.trainPercent / 100);
  const training = ordered.slice(0, splitIndex);
  const validation = ordered.slice(splitIndex);
  const rows = [row("aggregate", "selected", selected), row("combination", input.experimentId, base), row("in_sample", "earlier", training, true), row("out_of_sample", "later", validation)];
  for (const threshold of opportunityThresholds) rows.push(row("opportunity_threshold", `OPP_${threshold}`, base.filter(signal => signal.opportunityScore >= threshold)));
  for (const threshold of confidenceThresholds) rows.push(row("confidence_threshold", `CONF_${threshold}`, base.filter(signal => signal.confidenceScore >= threshold)));
  for (const threshold of jointThresholds) rows.push(row("joint_threshold", `OPP_${threshold.opportunity}_CONF_${threshold.confidence}`, base.filter(signal => signal.opportunityScore >= threshold.opportunity && signal.confidenceScore >= threshold.confidence)));
  for (const [key, lower, upper] of [["60-69", 60, 70], ["70-79", 70, 80], ["80-89", 80, 90], ["90-100", 90, 101]] as const) rows.push(row("score_bucket", key, base.filter(signal => signal.opportunityScore >= lower && signal.opportunityScore < upper)));
  for (const [key, lower, upper] of [["60-69", 60, 70], ["70-79", 70, 80], ["80-89", 80, 90], ["90-100", 90, 101]] as const) rows.push(row("confidence_bucket", key, base.filter(signal => signal.confidenceScore >= lower && signal.confidenceScore < upper)));
  for (const regime of ["RISK ON", "SELECTIVE", "RISK OFF", "UNAVAILABLE"] as const) rows.push(row("regime", regime, base.filter(signal => signal.regime === regime)));
  for (const sector of Array.from(new Set(DEFAULT_ASSET_UNIVERSE.map(asset => asset.sector))).sort()) rows.push(row("sector", sector, base.filter(signal => signal.sector === sector)));
  const selectedMetrics = calculateResearchMetrics(selected);
  const inSample = rows.find(item => item.dimension === "in_sample")!;
  const outOfSample = rows.find(item => item.dimension === "out_of_sample")!;
  const robust = selected.length >= 30 && outOfSample.signalCount >= 30 && (outOfSample.metrics.averageReturn ?? 0) > 0 && (outOfSample.metrics.profitFactor ?? 0) >= 1 && (selectedMetrics.maximumDrawdown ?? Infinity) <= 25;
  return { base, selected, rows, splitAt: ordered[splitIndex]?.entryAt ?? null, currentBestCandidate: robust ? { status: "CANDIDATE", reason: "This selected configuration has sufficient observations, positive later-period return, profit factor at least one, and maximum drawdown no greater than 25%. It remains research-only." } : { status: "NO ROBUST WINNER IDENTIFIED", reason: "No selected configuration passes the declared sample, later-period, profitability, and drawdown criteria." }, timeSplit: { trainPercent: input.trainPercent, inSampleSignals: inSample.signalCount, outOfSampleSignals: outOfSample.signalCount } };
}

function sanitizeError(error: unknown) { return error instanceof Error ? error.message.replace(/https?:\/\/\S+/g, "provider endpoint") : "Research experiment failed."; }

export async function runResearchExperiment(userId: number, input: ResearchExperimentInput, scoringConfiguration: ScoringConfig) {
  const assets = (input.assetIds.length ? input.assetIds : DEFAULT_ASSET_UNIVERSE.map(asset => asset.id)).map(id => DEFAULT_ASSET_UNIVERSE.find(asset => asset.id === id)).filter((asset): asset is typeof DEFAULT_ASSET_UNIVERSE[number] => Boolean(asset));
  if (!assets.length) throw new Error("Select at least one supported research asset.");
  if (!EXPERIMENTS.some(experiment => experiment.id === input.experimentId)) throw new Error("Unsupported experiment.");
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; the research run cannot be persisted.");
  const configuration = { protocolVersion: RESEARCH_PROTOCOL_VERSION, input, scoringConfiguration, experiment: EXPERIMENTS.find(experiment => experiment.id === input.experimentId) };
  const configurationFingerprint = fingerprint(configuration);
  const startedAt = new Date();
  await db.insert(researchExperiments).values({ userId, name: input.name, status: "running", protocolVersion: RESEARCH_PROTOCOL_VERSION, configurationFingerprint, configuration, dataProvenance: { provider: "Binance Futures OHLCV", sourceVersion: "fapi/v1/klines", requestedAt: startedAt.toISOString(), retainedSeries: "completed OHLCV candles only" }, startedAt });
  const experiment = (await db.select().from(researchExperiments).where(and(eq(researchExperiments.userId, userId), eq(researchExperiments.configurationFingerprint, configurationFingerprint))).orderBy(desc(researchExperiments.id)).limit(1))[0];
  if (!experiment) throw new Error("Research experiment creation failed.");
  try {
    const now = Date.now();
    const uniqueSymbols = Array.from(new Set([...assets.map(asset => asset.binanceSymbol), "BTCUSDT"]));
    const primaryEntries = await Promise.all(uniqueSymbols.map(async symbol => {
      const response = await fetchBinanceCandlesForResearch(symbol, input.timeframe, input.candleLimit, input.startAt, input.endAt);
      return [symbol, { ...response, candles: response.candles.filter(candle => candle.closeTime < now) }] as const;
    }));
    const primary = new Map(primaryEntries);
    const high = higherTimeframe[input.timeframe];
    const higherEntries = input.experimentId === "E" && high ? await Promise.all(assets.map(async asset => {
      const response = await fetchBinanceCandlesForResearch(asset.binanceSymbol, high, input.candleLimit, input.startAt, input.endAt);
      return [asset.binanceSymbol, { ...response, candles: response.candles.filter(candle => candle.closeTime < now) }] as const;
    })) : [];
    const higher = new Map(higherEntries);
    const btcCandles = primary.get("BTCUSDT")?.candles ?? [];
    const allSignals = assets.flatMap(asset => buildSignals(asset, primary.get(asset.binanceSymbol)?.candles ?? [], btcCandles, higher.get(asset.binanceSymbol)?.candles, input, scoringConfiguration));
    const result = buildResearchResultRows(allSignals, input);
    const dateRange = primaryEntries.flatMap(([, response]) => response.candles).sort((a, b) => a.openTime - b.openTime);
    const sources = Array.from(new Set(primaryEntries.map(([, response]) => response.source)));
    const dataProvenance = { provider: sources, sourceVersion: "fapi/v1/klines or Binance public completed-candle archive", requestedAt: startedAt.toISOString(), assetsRequested: assets.map(asset => asset.symbol), assetsWithCandles: assets.filter(asset => (primary.get(asset.binanceSymbol)?.candles.length ?? 0) > 0).map(asset => asset.symbol), timeframe: input.timeframe, higherTimeframe: high ?? "unavailable", completedCandleOnly: true, regimeBasis: "BTC same-time trailing 24-hour OHLCV proxy; not production regime reconstruction", sectorBasis: "Current configured static asset taxonomy; point-in-time classification history unavailable" };
    const resultSnapshot = { generatedAt: new Date().toISOString(), selectedMetrics: calculateResearchMetrics(result.selected), allQualifyingSignals: result.selected, timeSplit: result.timeSplit, splitAt: result.splitAt, currentBestCandidate: result.currentBestCandidate, dataLimitations: ["Historical market-cap, CoinGecko market-context, and production sector-model inputs are not reconstructed from present-day values.", "Regime labels are an explicitly separate BTC same-time OHLCV proxy, not the production regime model.", "Sector labels use the configured taxonomy and do not claim historical classification-point-in-time coverage.", "Drawdown is a chronological equal-risk observation series, not a fully capital-constrained portfolio simulation.", "No fees, slippage, funding, or liquidity impact are modeled in this research run."], protocol: RESEARCH_PROTOCOL_VERSION };
    await db.insert(researchExperimentResults).values(result.rows.map(item => ({ experimentId: experiment.id, ...item })));
    await db.update(researchExperiments).set({ status: "completed", completedAt: new Date(), dataStartAt: dateRange[0] ? new Date(dateRange[0].openTime) : null, dataEndAt: dateRange.at(-1) ? new Date(dateRange.at(-1)!.closeTime) : null, dataProvenance, resultSnapshot }).where(eq(researchExperiments.id, experiment.id));
    return { experimentId: experiment.id, configurationFingerprint, input, dataProvenance, resultSnapshot, results: result.rows };
  } catch (error) {
    await db.update(researchExperiments).set({ status: "failed", completedAt: new Date(), errorMessage: sanitizeError(error) }).where(eq(researchExperiments.id, experiment.id));
    throw error;
  }
}

export async function listResearchExperiments(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(researchExperiments).where(eq(researchExperiments.userId, userId)).orderBy(desc(researchExperiments.createdAt));
}

export async function getResearchExperiment(userId: number, experimentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const experiment = (await db.select().from(researchExperiments).where(and(eq(researchExperiments.id, experimentId), eq(researchExperiments.userId, userId))).limit(1))[0];
  if (!experiment) throw new Error("Research experiment not found.");
  const results = await db.select().from(researchExperimentResults).where(eq(researchExperimentResults.experimentId, experimentId));
  return { ...experiment, results };
}

export async function exportResearchExperiment(userId: number, experimentId: number, format: "json" | "csv") {
  const experiment = await getResearchExperiment(userId, experimentId);
  if (format === "json") return { filename: `opportunity-research-${experimentId}.json`, mimeType: "application/json", content: JSON.stringify(experiment, null, 2) };
  const header = ["recordType", "experimentId", "name", "protocolVersion", "configurationFingerprint", "dataStartAt", "dataEndAt", "configurationJson", "dataProvenanceJson", "dimension", "dimensionKey", "signalCount", "evidenceStatus", "reason", "winRate", "averageReturn", "medianReturn", "expectancy", "profitFactor", "maximumDrawdown", "averageR"];
  const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const lines = experiment.results.map(result => {
    const metrics = result.metrics as Partial<ResearchMetrics>;
    return ["result", experiment.id, experiment.name, experiment.protocolVersion, experiment.configurationFingerprint, experiment.dataStartAt?.toISOString(), experiment.dataEndAt?.toISOString(), JSON.stringify(experiment.configuration), JSON.stringify(experiment.dataProvenance), result.dimension, result.dimensionKey, result.signalCount, result.evidenceStatus, result.reason, metrics.winRate, metrics.averageReturn, metrics.medianReturn, metrics.expectancy, metrics.profitFactor, metrics.maximumDrawdown, metrics.averageR].map(escape).join(",");
  });
  return { filename: `opportunity-research-${experimentId}.csv`, mimeType: "text/csv", content: [header.join(","), ...lines].join("\n") };
}
