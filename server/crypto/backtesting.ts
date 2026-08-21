import { desc, eq } from "drizzle-orm";
import { assets, backtestResults, backtestRuns } from "../../drizzle/schema";
import { DEFAULT_ASSET_UNIVERSE, SUPPORTED_TIMEFRAMES, type Candle, type ScoreReason, type ScoringConfig, type Timeframe } from "../../shared/crypto";
import { getDb } from "../db";
import { fetchBinanceCandles } from "./providers";
import { analyzeTimeframe } from "./technical";

export type BacktestInput = {
  assetId: string;
  timeframe: Timeframe;
  minimumScore: number;
  minimumConfidence: number;
  holdingBars: number;
  riskPercent: number;
  maximumConcurrent: number;
  entryRule: "bullish" | "bullish-volume";
  stopRule: "atr" | "percent";
  stopAtrMultiplier: number;
  stopPercent: number;
  takeProfitRule: "risk-reward" | "holding-close";
  targetRiskReward: number;
  candleLimit: number;
  startAt?: number;
  endAt?: number;
};

type HistoricalSignal = {
  timeframe: Timeframe;
  timestamp: number;
  entryPrice: number;
  exitPrice: number;
  returnPercent: number;
  positionReturnPercent: number;
  opportunityScore: number;
  confidenceScore: number;
  technicalScore: number;
  stopLoss: number;
  takeProfit: number;
  exitReason: "stop-loss" | "take-profit" | "holding-close";
  reasons: ScoreReason[];
  dataCutoffAt: number;
};

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const round = (value: number, decimals = 2) => Number(value.toFixed(decimals));

function metrics(signals: HistoricalSignal[], startingEquity = 100_000) {
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
  signals.forEach(signal => { const pnl = equity * signal.returnPercent / 100; equity += pnl; equityReturns.push(signal.returnPercent / 100); peak = Math.max(peak, equity); maxDrawdown = Math.max(maxDrawdown, (peak - equity) / peak * 100); });
  const mean = equityReturns.length ? equityReturns.reduce((sum, value) => sum + value, 0) / equityReturns.length : 0;
  const variance = equityReturns.length > 1 ? equityReturns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (equityReturns.length - 1) : 0;
  const sharpe = variance > 0 ? mean / Math.sqrt(variance) * Math.sqrt(equityReturns.length) : null;
  return { signalCount: signals.length, winRate: signals.length ? round(wins.length / signals.length * 100) : null, averageReturn: average === null ? null : round(average), medianReturn: median === null ? null : round(median), maximumReturn: returns.length ? round(Math.max(...returns)) : null, maximumDrawdown: round(maxDrawdown), profitFactor: grossLoss > 0 ? round(grossProfit / grossLoss) : grossProfit > 0 ? null : 0, averageR: average === null ? null : round(average), expectancy: average === null ? null : round(average), sharpeRatio: sharpe === null ? null : round(sharpe), endingEquity: round(equity) };
}

export function researchScoreCombinations(signals: HistoricalSignal[]) {
  const groups = new Map<string, HistoricalSignal[]>();
  signals.forEach(signal => {
    const combination = signal.reasons.filter(reason => reason.direction === "positive").map(reason => reason.key).sort().join(" + ") || "No positive confirmation";
    groups.set(combination, [...(groups.get(combination) ?? []), signal]);
  });
  return Array.from(groups.entries()).map(([combination, groupedSignals]) => {
    const outcome = metrics(groupedSignals);
    return { combination, sampleSize: groupedSignals.length, winRate: outcome.winRate, averageReturn: outcome.averageReturn, expectancy: outcome.expectancy, profitFactor: outcome.profitFactor };
  }).sort((left, right) => right.sampleSize - left.sampleSize || (right.averageReturn ?? -Infinity) - (left.averageReturn ?? -Infinity));
}

export function runChronologicalBacktest(candles: Candle[], configuration: ScoringConfig, input: Omit<BacktestInput, "assetId" | "candleLimit" | "startAt" | "endAt">) {
  const required = Math.max(configuration.indicator.emaSlow + 2, configuration.indicator.macdSlow + configuration.indicator.macdSignal + 2, 60);
  const signals: HistoricalSignal[] = [];
  const openExitIndices: number[] = [];
  for (let index = required; index + input.holdingBars < candles.length; index += 1) {
    const decisionCandles = candles.slice(0, index + 1);
    const analysis = analyzeTimeframe(decisionCandles, input.timeframe, configuration);
    if (!analysis || analysis.bias !== "bullish") continue;
    if (input.entryRule === "bullish-volume" && (!analysis.volumeExpansion || analysis.volumeExpansion < 1)) continue;
    const technicalScore = analysis.score / 10 * 40;
    const opportunityScore = clamp(analysis.score * 10);
    const confidenceScore = clamp(analysis.score * 8 + (analysis.volumeExpansion && analysis.volumeExpansion >= 1 ? 10 : 0));
    if (opportunityScore < input.minimumScore || confidenceScore < input.minimumConfidence) continue;
    const currentOpen = openExitIndices.filter(exitIndex => exitIndex > index);
    if (currentOpen.length >= input.maximumConcurrent) continue;
    const entry = candles[index].close;
    const atrPercent = analysis.atrPercent ?? 2;
    const stopDistancePercent = input.stopRule === "atr" ? Math.max(atrPercent * input.stopAtrMultiplier, 0.3) : input.stopPercent;
    const stopDistance = entry * stopDistancePercent / 100;
    const stopLoss = entry - stopDistance;
    const takeProfit = entry + stopDistance * input.targetRiskReward;
    let exit = candles[index + input.holdingBars].close;
    let exitReason: HistoricalSignal["exitReason"] = "holding-close";
    for (let futureIndex = index + 1; futureIndex <= index + input.holdingBars; futureIndex += 1) {
      const future = candles[futureIndex];
      if (future.low <= stopLoss) { exit = stopLoss; exitReason = "stop-loss"; break; }
      if (input.takeProfitRule === "risk-reward" && future.high >= takeProfit) { exit = takeProfit; exitReason = "take-profit"; break; }
    }
    const returnPercent = (exit - entry) / entry * 100;
    const positionReturnPercent = returnPercent / stopDistancePercent * input.riskPercent;
    signals.push({ timeframe: input.timeframe, timestamp: candles[index].closeTime, entryPrice: round(entry, 8), exitPrice: round(exit, 8), returnPercent: round(returnPercent), positionReturnPercent: round(positionReturnPercent), opportunityScore: round(opportunityScore), confidenceScore: round(confidenceScore), technicalScore: round(technicalScore), stopLoss: round(stopLoss, 8), takeProfit: round(takeProfit, 8), exitReason, reasons: analysis.reasons, dataCutoffAt: candles[index].closeTime });
    openExitIndices.push(index + input.holdingBars);
  }
  return { metrics: metrics(signals), signals, scoreResearch: researchScoreCombinations(signals), dataCutoff: { model: "Each decision receives candles[0..index] only; stops, targets, and holding exits are evaluated only in later candles after the decision close.", timeframe: input.timeframe, requiredHistory: required, holdingBars: input.holdingBars } };
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
    await db.insert(backtestResults).values({ runId: run.id, assetId: asset.id, metrics: result.metrics, signalSnapshots: { signals: result.signals, scoreResearch: result.scoreResearch, dataCutoff: result.dataCutoff, source: "Binance Futures OHLCV", timeframe: input.timeframe, candlesReturned: candles.length } });
    await db.update(backtestRuns).set({ status: "completed", completedAt: new Date() }).where(eq(backtestRuns.id, run.id));
    return { runId: run.id, asset, input, ...result, candlesReturned: candles.length };
  } catch (error) {
    await db.update(backtestRuns).set({ status: "failed", completedAt: new Date(), errorMessage: error instanceof Error ? error.message : "Backtest failed." }).where(eq(backtestRuns.id, run.id));
    throw error;
  }
}
