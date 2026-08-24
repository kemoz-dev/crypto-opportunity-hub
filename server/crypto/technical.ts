import type { Candle, ScoreReason, Timeframe, TimeframeAnalysis } from "../../shared/crypto";
import type { ScoringConfig } from "../../shared/crypto";

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const round = (value: number, decimals = 2) => Number(value.toFixed(decimals));

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function calculateEma(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const seed = average(values.slice(0, period));
  if (seed === null) return [];
  const multiplier = 2 / (period + 1);
  const result = Array<number>(period - 1).fill(Number.NaN);
  result.push(seed);
  let previous = seed;
  for (let index = period; index < values.length; index += 1) {
    previous = (values[index] - previous) * multiplier + previous;
    result.push(previous);
  }
  return result;
}

export function calculateRsi(closes: number[], period = 14): number | null {
  if (closes.length <= period) return null;
  const changes = closes.slice(1).map((close, index) => close - closes[index]);
  let avgGain = changes.slice(0, period).reduce((sum, value) => sum + Math.max(value, 0), 0) / period;
  let avgLoss = changes.slice(0, period).reduce((sum, value) => sum + Math.max(-value, 0), 0) / period;
  for (let index = period; index < changes.length; index += 1) {
    avgGain = (avgGain * (period - 1) + Math.max(changes[index], 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-changes[index], 0)) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

function calculateRsiSeries(closes: number[], period: number): Array<number | null> {
  return closes.map((_, index) => index <= period ? null : calculateRsi(closes.slice(0, index + 1), period));
}

export function calculateAtr(candles: Candle[], period = 14): number | null {
  if (candles.length <= period) return null;
  const trueRanges = candles.slice(1).map((candle, index) => {
    const previousClose = candles[index].close;
    return Math.max(candle.high - candle.low, Math.abs(candle.high - previousClose), Math.abs(candle.low - previousClose));
  });
  let atr = average(trueRanges.slice(0, period));
  if (atr === null) return null;
  for (let index = period; index < trueRanges.length; index += 1) atr = (atr * (period - 1) + trueRanges[index]) / period;
  return atr;
}

function calculateMacd(closes: number[], fast = 12, slow = 26, signal = 9) {
  const fastEma = calculateEma(closes, fast);
  const slowEma = calculateEma(closes, slow);
  if (fastEma.length === 0 || slowEma.length === 0) return null;
  const lineSeries = closes.map((_, index) => Number.isFinite(fastEma[index]) && Number.isFinite(slowEma[index]) ? fastEma[index] - slowEma[index] : Number.NaN);
  const compactLine = lineSeries.filter(Number.isFinite);
  const signalEma = calculateEma(compactLine, signal);
  if (signalEma.length === 0) return null;
  const currentLine = compactLine.at(-1);
  const previousLine = compactLine.at(-2);
  const currentSignal = signalEma.at(-1);
  const previousSignal = signalEma.at(-2);
  if ([currentLine, previousLine, currentSignal, previousSignal].some(value => value === undefined)) return null;
  return {
    line: currentLine!,
    signal: currentSignal!,
    histogram: currentLine! - currentSignal!,
    previousHistogram: previousLine! - previousSignal!,
    bullishCross: previousLine! <= previousSignal! && currentLine! > currentSignal!,
    bearishCross: previousLine! >= previousSignal! && currentLine! < currentSignal!,
    lineSeries,
  };
}

export type TechnicalChartPoint = Candle & {
  ema20: number | null;
  ema50: number | null;
  ema200: number | null;
  rsi: number | null;
  macdLine: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
};

/** Presentation-only overlay series. It reuses the same indicator parameters and completed candles used by the existing technical engine. */
export function buildTechnicalChartSeries(candles: Candle[], config: ScoringConfig, limit = 120): TechnicalChartPoint[] {
  const closes = candles.map(candle => candle.close);
  const ema20 = calculateEma(closes, config.indicator.emaFast);
  const ema50 = calculateEma(closes, config.indicator.emaMedium);
  const ema200 = calculateEma(closes, config.indicator.emaSlow);
  const rsi = calculateRsiSeries(closes, config.indicator.rsiPeriod);
  const fastEma = calculateEma(closes, config.indicator.macdFast);
  const slowEma = calculateEma(closes, config.indicator.macdSlow);
  const macdLine = closes.map((_, index) => Number.isFinite(fastEma[index]) && Number.isFinite(slowEma[index]) ? fastEma[index] - slowEma[index] : Number.NaN);
  const compactMacd = macdLine.filter(Number.isFinite);
  const signalSeries = calculateEma(compactMacd, config.indicator.macdSignal);
  let compactIndex = -1;
  return candles.map((candle, index) => {
    const line = macdLine[index];
    const signal = Number.isFinite(line) ? signalSeries[++compactIndex] : Number.NaN;
    const nullable = (value: number | undefined) => value !== undefined && Number.isFinite(value) ? round(value, 6) : null;
    return {
      ...candle,
      ema20: nullable(ema20[index]),
      ema50: nullable(ema50[index]),
      ema200: nullable(ema200[index]),
      rsi: nullable(rsi[index] ?? undefined),
      macdLine: nullable(line),
      macdSignal: nullable(signal),
      macdHistogram: Number.isFinite(line) && Number.isFinite(signal) ? round(line - signal, 6) : null,
    };
  }).slice(-limit);
}

function calculateBollinger(closes: number[], period = 20) {
  if (closes.length < period) return null;
  const window = closes.slice(-period);
  const middle = average(window);
  if (middle === null) return null;
  const variance = window.reduce((sum, value) => sum + (value - middle) ** 2, 0) / period;
  const deviation = Math.sqrt(variance);
  const upper = middle + deviation * 2;
  const lower = middle - deviation * 2;
  return { middle, upper, lower, width: middle === 0 ? 0 : (upper - lower) / middle };
}

function pivotIndices(candles: Candle[], kind: "low" | "high", lookback = 48): number[] {
  const start = Math.max(2, candles.length - lookback);
  const pivots: number[] = [];
  for (let index = start; index < candles.length - 2; index += 1) {
    const value = kind === "low" ? candles[index].low : candles[index].high;
    const before = kind === "low" ? candles[index - 1].low : candles[index - 1].high;
    const after = kind === "low" ? candles[index + 1].low : candles[index + 1].high;
    const beforeTwo = kind === "low" ? candles[index - 2].low : candles[index - 2].high;
    const afterTwo = kind === "low" ? candles[index + 2].low : candles[index + 2].high;
    if (kind === "low" ? value <= before && value <= after && value <= beforeTwo && value <= afterTwo : value >= before && value >= after && value >= beforeTwo && value >= afterTwo) pivots.push(index);
  }
  return pivots;
}

function bullishDivergence(candles: Candle[], oscillator: Array<number | null>): boolean {
  const lows = pivotIndices(candles, "low").filter(index => oscillator[index] !== null && Number.isFinite(oscillator[index]));
  if (lows.length < 2) return false;
  const [previous, current] = lows.slice(-2);
  return candles[current].low < candles[previous].low && (oscillator[current] ?? 0) > (oscillator[previous] ?? 0);
}

function bearishDivergence(candles: Candle[], oscillator: Array<number | null>): boolean {
  const highs = pivotIndices(candles, "high").filter(index => oscillator[index] !== null && Number.isFinite(oscillator[index]));
  if (highs.length < 2) return false;
  const [previous, current] = highs.slice(-2);
  return candles[current].high > candles[previous].high && (oscillator[current] ?? 0) < (oscillator[previous] ?? 0);
}

function detectPriceStructure(candles: Candle[]): string[] {
  if (candles.length < 30) return [];
  const current = candles.at(-1)!;
  const previous = candles.at(-2)!;
  const lookback = candles.slice(-21, -1);
  const priorHigh = Math.max(...lookback.map(candle => candle.high));
  const priorLow = Math.min(...lookback.map(candle => candle.low));
  const short = candles.slice(-10, -1);
  const shortHigh = Math.max(...short.map(candle => candle.high));
  const shortLow = Math.min(...short.map(candle => candle.low));
  const wider = candles.slice(-31, -11);
  const priorSwingHigh = Math.max(...wider.map(candle => candle.high));
  const priorSwingLow = Math.min(...wider.map(candle => candle.low));
  const structure: string[] = [];

  if (current.close > priorHigh) structure.push("Break of structure higher", "Resistance breakout");
  if (current.close < priorLow) structure.push("Break of structure lower");
  if (current.high > shortHigh && current.close > previous.close) structure.push("Higher high");
  if (current.low > shortLow && current.close > previous.close) structure.push("Higher low");
  if (current.low < shortLow && current.close < previous.close) structure.push("Lower low");
  if (current.high < shortHigh && current.close < previous.close) structure.push("Lower high");
  if (previous.close < priorLow && current.close > priorLow) structure.push("Failed breakdown", "Support reclaim");
  if (previous.high > priorHigh && current.low <= priorHigh * 1.012 && current.close > priorHigh) structure.push("Breakout retest");
  if (priorSwingLow < shortLow && current.close > shortHigh) structure.push("Change of character bullish");
  if (priorSwingHigh > shortHigh && current.close < shortLow) structure.push("Change of character bearish");
  const recentRange = (shortHigh - shortLow) / Math.max(previous.close, Number.EPSILON);
  if (recentRange < 0.04 && current.close > priorHigh) structure.push("Consolidation breakout");
  return Array.from(new Set(structure));
}

export function analyzeTimeframe(candles: Candle[], timeframe: Timeframe, config: ScoringConfig): TimeframeAnalysis | null {
  const requiredCandles = Math.max(config.indicator.emaSlow + 2, config.indicator.macdSlow + config.indicator.macdSignal + 2, 60);
  if (candles.length < requiredCandles) return null;
  const closes = candles.map(candle => candle.close);
  const rsiSeries = calculateRsiSeries(closes, config.indicator.rsiPeriod);
  const rsi = rsiSeries.at(-1) ?? null;
  const macd = calculateMacd(closes, config.indicator.macdFast, config.indicator.macdSlow, config.indicator.macdSignal);
  const ema20Series = calculateEma(closes, config.indicator.emaFast);
  const ema50Series = calculateEma(closes, config.indicator.emaMedium);
  const ema200Series = calculateEma(closes, config.indicator.emaSlow);
  const ema20 = ema20Series.at(-1);
  const ema50 = ema50Series.at(-1);
  const ema200 = ema200Series.at(-1);
  const previousEma20 = ema20Series.at(-2);
  const previousEma50 = ema50Series.at(-2);
  const previousEma200 = ema200Series.at(-2);
  const bollinger = calculateBollinger(closes, config.indicator.bollingerPeriod);
  const previousBollinger = calculateBollinger(closes.slice(0, -1), config.indicator.bollingerPeriod);
  const historicalWidths = Array.from({ length: 20 }, (_, index) => calculateBollinger(closes.slice(0, closes.length - 1 - index), config.indicator.bollingerPeriod)?.width).filter((value): value is number => value !== undefined);
  const averageWidth = average(historicalWidths);
  const atr = calculateAtr(candles, config.indicator.atrPeriod);
  const current = candles.at(-1)!;
  const previous = candles.at(-2)!;
  const averageVolume = average(candles.slice(-(config.indicator.volumePeriod + 1), -1).map(candle => candle.volume));
  const volumeExpansion = averageVolume && averageVolume > 0 ? current.volume / averageVolume : null;
  const priceStructure = detectPriceStructure(candles);
  const reasons: ScoreReason[] = [];

  if (rsi !== null) {
    const recentlyOversold = rsiSeries.slice(-7, -1).some(value => value !== null && value < 30);
    const rsiBullishDivergence = bullishDivergence(candles, rsiSeries);
    const rsiBearishDivergence = bearishDivergence(candles, rsiSeries);
    if (recentlyOversold && rsi > 30) reasons.push({ key: "rsi", label: "RSI recovery from oversold", score: 1.75, maxScore: 2, direction: "positive", detail: `RSI recovered to ${round(rsi)} after a sub-30 reading in the recent confirmation window.${rsiBullishDivergence ? " Price and RSI also show bullish divergence." : ""}` });
    else if (rsiBullishDivergence) reasons.push({ key: "rsi", label: "RSI bullish divergence", score: 1.6, maxScore: 2, direction: "positive", detail: `Price made a lower swing low while RSI made a higher swing low; current RSI is ${round(rsi)}.` });
    else if (rsiBearishDivergence) reasons.push({ key: "rsi", label: "RSI bearish divergence", score: 0.1, maxScore: 2, direction: "negative", detail: `Price made a higher swing high while RSI made a lower swing high; current RSI is ${round(rsi)}.` });
    else if (rsi >= 50 && rsi <= 72) reasons.push({ key: "rsi", label: "RSI constructive", score: 1.5, maxScore: 2, direction: "positive", detail: `RSI is ${round(rsi)}, above the 50 midpoint without an overbought reading.` });
    else if (rsi < 30) reasons.push({ key: "rsi", label: "RSI oversold", score: 0.5, maxScore: 2, direction: "neutral", detail: `RSI is ${round(rsi)}; oversold conditions need confirmation rather than being treated as bullish.` });
    else if (rsi > 78) reasons.push({ key: "rsi", label: "RSI extended", score: 0, maxScore: 2, direction: "negative", detail: `RSI is ${round(rsi)}, an extended condition that receives no positive momentum credit.` });
    else reasons.push({ key: "rsi", label: "RSI neutral", score: 0.75, maxScore: 2, direction: "neutral", detail: `RSI is ${round(rsi)} and does not currently show a strong directional condition.` });
  }

  if (macd) {
    const macdBullishDivergence = bullishDivergence(candles, macd.lineSeries);
    const macdBearishDivergence = bearishDivergence(candles, macd.lineSeries);
    const positive = macd.line > macd.signal && macd.histogram > macd.previousHistogram;
    const macdScore = macd.bullishCross || macdBullishDivergence ? 2 : positive ? 1.5 : macd.bearishCross || macdBearishDivergence ? 0 : 0.6;
    const label = macd.bullishCross ? "MACD bullish crossover" : macd.bearishCross ? "MACD bearish crossover" : macdBullishDivergence ? "MACD bullish divergence" : macdBearishDivergence ? "MACD bearish divergence" : "MACD momentum";
    reasons.push({ key: "macd", label, score: macdScore, maxScore: 2, direction: macdScore >= 1.5 ? "positive" : macdScore === 0 ? "negative" : "neutral", detail: `Histogram is ${round(macd.histogram, 4)} and ${macd.histogram >= macd.previousHistogram ? "expanding" : "contracting"}; MACD is ${macd.line >= 0 ? "above" : "below"} its zero line.` });
  }

  if (ema20 && ema50 && ema200 && previousEma20 && previousEma50) {
    const bullishAlignment = current.close > ema20 && ema20 > ema50 && ema50 > ema200;
    const bearishAlignment = current.close < ema20 && ema20 < ema50 && ema50 < ema200;
    const bullishCross = previousEma20 <= previousEma50 && ema20 > ema50;
    const bearishCross = previousEma20 >= previousEma50 && ema20 < ema50;
    const emaScore = bullishCross || bullishAlignment ? 2 : bearishCross || bearishAlignment ? 0 : current.close > ema50 ? 1 : 0.5;
    const label = bullishCross ? "EMA bullish crossover" : bearishCross ? "EMA bearish crossover" : bullishAlignment ? "Bullish EMA alignment" : bearishAlignment ? "Bearish EMA alignment" : "Mixed EMA structure";
    reasons.push({ key: "ema", label, score: emaScore, maxScore: 2, direction: emaScore >= 1.5 ? "positive" : emaScore === 0 ? "negative" : "neutral", detail: `Price is ${current.close > ema20 ? "above" : "below"} EMA 20; EMA 200 slope is ${previousEma200 && ema200 > previousEma200 ? "positive" : "non-positive"}.` });
  }

  const bandPosition = bollinger && bollinger.upper !== bollinger.lower ? (current.close - bollinger.lower) / (bollinger.upper - bollinger.lower) : null;
  if (bollinger && volumeExpansion !== null) {
    const breakout = current.close > bollinger.upper && volumeExpansion >= 1.2;
    const squeeze = averageWidth !== null && bollinger.width < averageWidth * 0.72;
    const upperRejection = current.high >= bollinger.upper && current.close < bollinger.upper && current.close < previous.close;
    const lowerReclaim = current.low <= bollinger.lower && current.close > bollinger.lower;
    const bandScore = breakout ? 1.5 : lowerReclaim && volumeExpansion >= 1 ? 1.25 : upperRejection ? 0.1 : bandPosition !== null && bandPosition > 0.5 && volumeExpansion >= 1 ? 1 : 0.5;
    const label = breakout ? "Volume-confirmed band breakout" : upperRejection ? "Upper-band rejection" : lowerReclaim ? "Lower-band reclaim" : squeeze ? "Bollinger squeeze" : "Band and volume context";
    reasons.push({ key: "band-volume", label, score: bandScore, maxScore: 2, direction: bandScore >= 1 ? "positive" : upperRejection ? "negative" : "neutral", detail: `Band width is ${round(bollinger.width * 100)}%${previousBollinger ? ` versus ${round(previousBollinger.width * 100)}% in the prior bar` : ""}; volume is ${round(volumeExpansion)}× its ${config.indicator.volumePeriod}-period average.` });
  }

  if (priceStructure.length > 0) {
    const positive = priceStructure.some(item => /higher|breakout|reclaim|Break of structure higher|Failed breakdown|bullish/i.test(item));
    const negative = priceStructure.some(item => /lower|bearish/i.test(item));
    reasons.push({ key: "structure", label: "Price structure", score: positive ? 2 : negative ? 0 : 0.75, maxScore: 2, direction: positive ? "positive" : negative ? "negative" : "neutral", detail: priceStructure.join("; ") + "." });
  } else reasons.push({ key: "structure", label: "Price structure", score: 0.75, maxScore: 2, direction: "neutral", detail: "No decisive break, reclaim, retest, or swing structure was detected in the current lookback window." });

  const rawScore = reasons.reduce((sum, reason) => sum + reason.score, 0);
  const score = clamp(rawScore, 0, 10);
  const bias = score >= 6.2 ? "bullish" : score <= 3.4 ? "bearish" : "neutral";
  return { timeframe, score: round(score), maxScore: 10, bias, rsi: rsi === null ? null : round(rsi), macdHistogram: macd ? round(macd.histogram, 4) : null, ema20: ema20 === undefined ? null : round(ema20, 6), ema50: ema50 === undefined ? null : round(ema50, 6), ema200: ema200 === undefined ? null : round(ema200, 6), bollinger: bollinger ? { middle: round(bollinger.middle, 6), upper: round(bollinger.upper, 6), lower: round(bollinger.lower, 6), width: round(bollinger.width, 6) } : null, atrPercent: atr === null ? null : round((atr / current.close) * 100), volumeExpansion: volumeExpansion === null ? null : round(volumeExpansion), priceStructure, reasons };
}
