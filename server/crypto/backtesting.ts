import { desc, eq } from "drizzle-orm";
import { assets, backtestResults, backtestRuns } from "../../drizzle/schema";
import { DEFAULT_ASSET_UNIVERSE, SUPPORTED_TIMEFRAMES, type Candle, type ScoreReason, type ScoringConfig, type Timeframe } from "../../shared/crypto";
import { getDb } from "../db";
import { fetchBinanceCandles } from "./providers";
import { analyzeTimeframe } from "./technical";

export type BacktestInput = {
  assetId: string; timeframe: Timeframe; minimumScore: number; minimumConfidence: number; holdingBars: number; riskPercent: number; maximumConcurrent: number;
  entryRule: "bullish" | "bullish-volume"; stopRule: "atr" | "percent"; stopAtrMultiplier: number; stopPercent: number; takeProfitRule: "risk-reward" | "holding-close"; targetRiskReward: number;
  candleLimit: number; startAt?: number; endAt?: number;
};

export type OutcomeHorizon = { label: "24H" | "3D" | "7D" | "30D"; barsAfterEntry: number; returnPercent: number };
export type HistoricalSignal = {
  timeframe: Timeframe; timestamp: number; entryTimestamp: number; entryPrice: number; exitPrice: number; returnPercent: number; positionReturnPercent: number; rMultiple: number;
  opportunityScore: number; confidenceScore: number; technicalScore: number; stopLoss: number; takeProfit: number; exitReason: "stop-loss" | "take-profit" | "holding-close";
  reasons: ScoreReason[]; dataCutoffAt: number; outcomeHorizons: OutcomeHorizon[];
};

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const round = (value: number, decimals = 2) => Number(value.toFixed(decimals));
const timeframeMilliseconds: Record<Timeframe, number> = { "15m": 15 * 60_000, "1h": 60 * 60_000, "4h": 4 * 60 * 60_000, "1d": 24 * 60 * 60_000 };
const outcomeWindows = [{ label: "24H" as const, milliseconds: 24 * 60 * 60_000 }, { label: "3D" as const, milliseconds: 3 * 24 * 60 * 60_000 }, { label: "7D" as const, milliseconds: 7 * 24 * 60 * 60_000 }, { label: "30D" as const, milliseconds: 30 * 24 * 60 * 60_000 }];

export function calculateHistoricalMetrics(signals: HistoricalSignal[], startingEquity = 100_000) {
  const returns = signals.map(signal => signal.positionReturnPercent);
  const wins = returns.filter(value => value > 0);
  const losses = returns.filter(value => value < 0);
  const sorted = [...returns].sort((left, right) => left - right);
  const median = sorted.length ? sorted.length % 2 ? sorted[Math.floor(sorted.length / 2)] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2 : null;
  const average = returns.length ? returns.reduce((sum, value) => sum + value, 0) / returns.length : null;
  const grossProfit = wins.reduce((sum, value) => sum + value, 0);
  const grossLoss = Math.abs(losses.reduce((sum, value) => sum + value, 0));
  let equity = startingEquity;
  let peak = equity;
  let maxDrawdown = 0;
  const equityReturns: number[] = [];
  signals.forEach(signal => { const pnl = equity * signal.positionReturnPercent / 100; equity += pnl; equityReturns.push(signal.positionReturnPercent / 100); peak = Math.max(peak, equity); maxDrawdown = Math.max(maxDrawdown, (peak - equity) / peak * 100); });
  const mean = equityReturns.length ? equityReturns.reduce((sum, value) => sum + value, 0) / equityReturns.length : 0;
  const variance = equityReturns.length > 1 ? equityReturns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (equityReturns.length - 1) : 0;
  const sharpe = variance > 0 ? mean / Math.sqrt(variance) * Math.sqrt(equityReturns.length) : null;
  const averageR = signals.length ? signals.reduce((sum, signal) => sum + signal.rMultiple, 0) / signals.length : null;
  return { signalCount: signals.length, winRate: signals.length ? round(wins.length / signals.length * 100) : null, averageReturn: average === null ? null : round(average), medianReturn: median === null ? null : round(median), maximumReturn: returns.length ? round(Math.max(...returns)) : null, maximumDrawdown: round(maxDrawdown), profitFactor: grossLoss > 0 ? round(grossProfit / grossLoss) : grossProfit > 0 ? null : 0, averageR: averageR === null ? null : round(averageR), expectancy: average === null ? null : round(average), sharpeRatio: sharpe === null ? null : round(sharpe), endingEquity: round(equity) };
}

function evidenceStatus(signals: HistoricalSignal[]) {
  const metrics = calculateHistoricalMetrics(signals);
  if (signals.length < 30) return { status: "INSUFFICIENT DATA" as const, reason: "Fewer than 30 historical observations are available for this comparison.", metrics };
  if ((metrics.averageReturn ?? 0) > 0 && (metrics.winRate ?? 0) >= 50) return { status: "SUPPORTED" as const, reason: "The available sample has a positive risk-sized average return and at least a 50% win rate.", metrics };
  if ((metrics.averageReturn ?? 0) > 0 || (metrics.winRate ?? 0) >= 50) return { status: "WEAK EVIDENCE" as const, reason: "The available sample is directionally mixed and needs more independent observations.", metrics };
  return { status: "UNSUPPORTED" as const, reason: "The available sample does not meet the positive-return and win-rate evidence rule.", metrics };
}

function summarizeHorizon(signals: HistoricalSignal[], label: OutcomeHorizon["label"]) {
  const values = signals.flatMap(signal => signal.outcomeHorizons.filter(outcome => outcome.label === label).map(outcome => outcome.returnPercent));
  if (!values.length) return { label, observationCount: 0, averageReturn: null, medianReturn: null };
  const sorted = [...values].sort((left, right) => left - right);
  const median = sorted.length % 2 ? sorted[Math.floor(sorted.length / 2)] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  return { label, observationCount: values.length, averageReturn: round(values.reduce((sum, value) => sum + value, 0) / values.length), medianReturn: round(median) };
}

function hasPositiveReasons(signal: HistoricalSignal, keys: string[]) {
  const positive = new Set(signal.reasons.filter(reason => reason.direction === "positive").map(reason => reason.key));
  return keys.every(key => positive.has(key));
}

export function researchScoreCombinations(signals: HistoricalSignal[]) {
  const groups = new Map<string, HistoricalSignal[]>();
  signals.forEach(signal => {
    const combination = signal.reasons.filter(reason => reason.direction === "positive").map(reason => reason.key).sort().join(" + ") || "No positive confirmation";
    groups.set(combination, [...(groups.get(combination) ?? []), signal]);
  });
  return Array.from(groups.entries()).map(([combination, groupedSignals]) => {
    const outcome = calculateHistoricalMetrics(groupedSignals);
    return { combination, sampleSize: groupedSignals.length, winRate: outcome.winRate, averageReturn: outcome.averageReturn, expectancy: outcome.expectancy, profitFactor: outcome.profitFactor };
  }).sort((left, right) => right.sampleSize - left.sampleSize || (right.averageReturn ?? -Infinity) - (left.averageReturn ?? -Infinity));
}

export function buildValidationResearch(signals: HistoricalSignal[], sector: string) {
  const combinationDefinitions = [
    { id: "A", label: "RSI + MACD", keys: ["rsi", "macd"] },
    { id: "B", label: "RSI + MACD + EMA", keys: ["rsi", "macd", "ema"] },
    { id: "C", label: "RSI + MACD + EMA + Volume", keys: ["rsi", "macd", "ema", "band-volume"] },
  ];
  const combinations = combinationDefinitions.map(definition => {
    const filtered = signals.filter(signal => hasPositiveReasons(signal, definition.keys));
    return { id: definition.id, label: definition.label, ...evidenceStatus(filtered), horizons: outcomeWindows.map(window => summarizeHorizon(filtered, window.label)) };
  });
  const unavailableCombination = (id: string, label: string, reason: string) => ({ id, label, status: "INSUFFICIENT DATA" as const, reason, metrics: calculateHistoricalMetrics([]), horizons: outcomeWindows.map(window => summarizeHorizon([], window.label)) });
  combinations.push(unavailableCombination("D", "RSI + MACD + EMA + Volume + Relative Strength", "The engine does not retain point-in-time relative-strength observations, so this comparison cannot be reconstructed safely."));
  combinations.push(unavailableCombination("E", "RSI + MACD + EMA + Volume + Relative Strength + Multi-Timeframe", "The engine does not retain a point-in-time multi-timeframe and relative-strength series, so this comparison cannot be reconstructed safely."));
  const opportunity = [60, 70, 80, 90].map(threshold => ({ threshold, ...evidenceStatus(signals.filter(signal => signal.opportunityScore >= threshold)) }));
  const confidence = [60, 70, 80].map(threshold => ({ threshold, ...evidenceStatus(signals.filter(signal => signal.confidenceScore >= threshold)) }));
  const joint = { opportunity: 80, confidence: 70, ...evidenceStatus(signals.filter(signal => signal.opportunityScore >= 80 && signal.confidenceScore >= 70)) };
  return {
    combinations,
    thresholds: { opportunity, confidence, joint },
    sectorComparison: { sector, status: "INSUFFICIENT DATA" as const, reason: "Generic-versus-sector comparison needs point-in-time sector data and a parallel generic baseline; those inputs are not retained in the current historical series." },
    regimeComparison: { status: "INSUFFICIENT DATA" as const, reason: "Historical market-regime inputs are not retained point-in-time, so regime segmentation would leak present-day context." },
    dataLimitations: ["No point-in-time relative-strength history is retained for combinations D and E.", "No point-in-time historical market-regime series is retained, so regime comparisons are not calculated.", "Sector hypotheses are not labeled Supported or Unsupported until a generic baseline and exact historical sector inputs can be run in parallel.", "Outcome windows are reported only when the required subsequent candles exist after entry."],
  };
}

export function runChronologicalBacktest(candles: Candle[], configuration: ScoringConfig, input: Omit<BacktestInput, "assetId" | "candleLimit" | "startAt" | "endAt">) {
  const required = Math.max(configuration.indicator.emaSlow + 2, configuration.indicator.macdSlow + configuration.indicator.macdSignal + 2, 60);
  const signals: HistoricalSignal[] = [];
  const openExitIndices: number[] = [];
  for (let index = required; index + input.holdingBars + 1 < candles.length; index += 1) {
    const decisionCandles = candles.slice(0, index + 1);
    const analysis = analyzeTimeframe(decisionCandles, input.timeframe, configuration);
    if (!analysis || analysis.bias !== "bullish") continue;
    if (input.entryRule === "bullish-volume" && (!analysis.volumeExpansion || analysis.volumeExpansion < 1)) continue;
    const technicalScore = analysis.score / 10 * 40;
    const opportunityScore = clamp(analysis.score * 10);
    const confidenceScore = clamp(analysis.score * 8 + (analysis.volumeExpansion && analysis.volumeExpansion >= 1 ? 10 : 0));
    if (opportunityScore < input.minimumScore || confidenceScore < input.minimumConfidence) continue;
    if (openExitIndices.filter(exitIndex => exitIndex > index).length >= input.maximumConcurrent) continue;
    const entryIndex = index + 1;
    const entryCandle = candles[entryIndex];
    const entry = entryCandle.open;
    const atrPercent = analysis.atrPercent ?? 2;
    const stopDistancePercent = input.stopRule === "atr" ? Math.max(atrPercent * input.stopAtrMultiplier, 0.3) : input.stopPercent;
    const stopDistance = entry * stopDistancePercent / 100;
    const stopLoss = entry - stopDistance;
    const takeProfit = entry + stopDistance * input.targetRiskReward;
    let exit = candles[index + input.holdingBars + 1].close;
    let exitReason: HistoricalSignal["exitReason"] = "holding-close";
    for (let futureIndex = entryIndex; futureIndex <= index + input.holdingBars + 1; futureIndex += 1) {
      const future = candles[futureIndex];
      if (future.low <= stopLoss) { exit = stopLoss; exitReason = "stop-loss"; break; }
      if (input.takeProfitRule === "risk-reward" && future.high >= takeProfit) { exit = takeProfit; exitReason = "take-profit"; break; }
    }
    const returnPercent = (exit - entry) / entry * 100;
    const rMultiple = returnPercent / stopDistancePercent;
    const positionReturnPercent = rMultiple * input.riskPercent;
    const outcomeHorizons = outcomeWindows.flatMap(window => {
      const barsAfterEntry = Math.ceil(window.milliseconds / timeframeMilliseconds[input.timeframe]);
      const outcomeCandle = candles[entryIndex + barsAfterEntry];
      return outcomeCandle ? [{ label: window.label, barsAfterEntry, returnPercent: round((outcomeCandle.close - entry) / entry * 100) }] : [];
    });
    signals.push({ timeframe: input.timeframe, timestamp: candles[index].closeTime, entryTimestamp: entryCandle.openTime, entryPrice: round(entry, 8), exitPrice: round(exit, 8), returnPercent: round(returnPercent), positionReturnPercent: round(positionReturnPercent), rMultiple: round(rMultiple), opportunityScore: round(opportunityScore), confidenceScore: round(confidenceScore), technicalScore: round(technicalScore), stopLoss: round(stopLoss, 8), takeProfit: round(takeProfit, 8), exitReason, reasons: analysis.reasons, dataCutoffAt: candles[index].closeTime, outcomeHorizons });
    openExitIndices.push(index + input.holdingBars + 1);
  }
  const validationResearch = buildValidationResearch(signals, "Not applicable to standalone timeframe analysis");
  return { metrics: calculateHistoricalMetrics(signals), signals, scoreResearch: researchScoreCombinations(signals), validationResearch, dataCutoff: { model: "Each score is computed from candles[0..index] only. The entry is the next bar open; stops, targets, and holding exits are evaluated only from that entry bar forward. If a bar crosses both stop and target, the stop is selected conservatively.", timeframe: input.timeframe, requiredHistory: required, holdingBars: input.holdingBars } };
}

export async function runAndPersistBacktest(userId: number, input: BacktestInput, configuration: ScoringConfig) {
  if (!SUPPORTED_TIMEFRAMES.includes(input.timeframe)) throw new Error("Unsupported backtest timeframe.");
  const asset = DEFAULT_ASSET_UNIVERSE.find(item => item.id === input.assetId);
  if (!asset) throw new Error("Selected asset is not in the supported research universe.");
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; the backtest cannot be persisted.");
  await db.insert(assets).values({ id: asset.id, symbol: asset.symbol, name: asset.name, binanceSymbol: asset.binanceSymbol, sector: asset.sector, isActive: true }).onDuplicateKeyUpdate({ set: { updatedAt: new Date() } });
  const createdAt = new Date();
  await db.insert(backtestRuns).values({ userId, status: "running", configuration: { input, scoring: configuration }, dataCutoffAt: createdAt, startedAt: createdAt });
  const run = (await db.select().from(backtestRuns).where(eq(backtestRuns.userId, userId)).orderBy(desc(backtestRuns.id)).limit(1))[0];
  if (!run) throw new Error("Backtest run creation failed.");
  try {
    const candles = await fetchBinanceCandles(asset.binanceSymbol, input.timeframe, input.candleLimit, input.startAt, input.endAt);
    const result = runChronologicalBacktest(candles, configuration, input);
    const validationResearch = buildValidationResearch(result.signals, asset.sector);
    await db.insert(backtestResults).values({ runId: run.id, assetId: asset.id, metrics: result.metrics, signalSnapshots: { signals: result.signals, scoreResearch: result.scoreResearch, validationResearch, dataCutoff: result.dataCutoff, source: "Binance Futures OHLCV", timeframe: input.timeframe, candlesReturned: candles.length } });
    await db.update(backtestRuns).set({ status: "completed", completedAt: new Date() }).where(eq(backtestRuns.id, run.id));
    return { runId: run.id, asset, input, ...result, validationResearch, candlesReturned: candles.length };
  } catch (error) {
    await db.update(backtestRuns).set({ status: "failed", completedAt: new Date(), errorMessage: error instanceof Error ? error.message : "Backtest failed." }).where(eq(backtestRuns.id, run.id));
    throw error;
  }
}
