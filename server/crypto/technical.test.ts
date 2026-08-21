import { describe, expect, it } from "vitest";
import { DEFAULT_SCORING_CONFIG, type Candle } from "../../shared/crypto";
import { analyzeTimeframe, calculateEma, calculateRsi } from "./technical";

function makeCandles(count: number): Candle[] {
  return Array.from({ length: count }, (_, index) => {
    const close = 100 + index * 0.65 + Math.sin(index / 7) * 1.8;
    return {
      openTime: index * 3_600_000,
      closeTime: (index + 1) * 3_600_000 - 1,
      open: close - 0.35,
      high: close + 1.1,
      low: close - 1.05,
      close,
      volume: 1_000 + index * 12 + (index % 9 === 0 ? 420 : 0),
    };
  });
}

describe("technical indicators", () => {
  it("calculates an EMA only after the seed period and moves toward newer values", () => {
    expect(calculateEma([1, 2, 3], 4)).toEqual([]);
    const ema = calculateEma([1, 2, 3, 4, 5, 6], 3);
    expect(ema.slice(0, 2)).toEqual([Number.NaN, Number.NaN]);
    expect(ema.at(-1)).toBeGreaterThan(4);
    expect(ema.at(-1)).toBeLessThan(6);
  });

  it("returns an overbought RSI for a strictly rising series without dividing by zero", () => {
    const rsi = calculateRsi(Array.from({ length: 30 }, (_, index) => index + 1), 14);
    expect(rsi).toBe(100);
  });

  it("creates a bounded, inspectable multi-indicator timeframe analysis", () => {
    const analysis = analyzeTimeframe(makeCandles(240), "1h", DEFAULT_SCORING_CONFIG);
    expect(analysis).not.toBeNull();
    expect(analysis?.score).toBeGreaterThanOrEqual(0);
    expect(analysis?.score).toBeLessThanOrEqual(10);
    expect(analysis?.reasons.map(reason => reason.key)).toEqual(expect.arrayContaining(["rsi", "macd", "ema", "structure"]));
    expect(analysis?.rsi).not.toBeNull();
    expect(analysis?.volumeExpansion).not.toBeNull();
  });

  it("refuses to score a timeframe when there are insufficient candles for the long EMA", () => {
    expect(analyzeTimeframe(makeCandles(80), "1h", DEFAULT_SCORING_CONFIG)).toBeNull();
  });
});
