import { describe, expect, it } from "vitest";
import { DEFAULT_SCORING_CONFIG, type Candle } from "../../shared/crypto";
import { buildValidationResearch, runChronologicalBacktest, type HistoricalSignal } from "./backtesting";

function candles(count: number): Candle[] {
  return Array.from({ length: count }, (_, index) => {
    const close = 100 + index * 0.11 + Math.sin(index / 4) * 2.1 + Math.sin(index / 11) * 1.2;
    return { openTime: index * 3_600_000, closeTime: (index + 1) * 3_600_000 - 1, open: close - 0.4, high: close + 1.1, low: close - 1.05, close, volume: 1_000 + (index % 17) * 90 };
  });
}

function input(overrides: Partial<Parameters<typeof runChronologicalBacktest>[2]> = {}) {
  return { timeframe: "1h" as const, minimumScore: 0, minimumConfidence: 0, holdingBars: 8, riskPercent: 1, maximumConcurrent: 3, entryRule: "bullish" as const, stopRule: "atr" as const, stopAtrMultiplier: 1.5, stopPercent: 2, takeProfitRule: "holding-close" as const, targetRiskReward: 2, ...overrides };
}

function evidenceSignal(overrides: Partial<HistoricalSignal> = {}): HistoricalSignal {
  return { timeframe: "1h", timestamp: 1, entryTimestamp: 2, entryPrice: 100, exitPrice: 101, returnPercent: 1, positionReturnPercent: 1, rMultiple: 1, opportunityScore: 80, confidenceScore: 75, technicalScore: 30, stopLoss: 98, takeProfit: 104, exitReason: "holding-close", reasons: [{ key: "rsi", label: "RSI", score: 2, maxScore: 2, direction: "positive", detail: "test" }, { key: "macd", label: "MACD", score: 2, maxScore: 2, direction: "positive", detail: "test" }, { key: "ema", label: "EMA", score: 2, maxScore: 2, direction: "positive", detail: "test" }, { key: "band-volume", label: "Volume", score: 2, maxScore: 2, direction: "positive", detail: "test" }], dataCutoffAt: 1, outcomeHorizons: [], ...overrides };
}

describe("chronological backtesting", () => {
  it("labels every historical decision with the exact candle data cut-off and evaluates the exit afterward", () => {
    const source = candles(360);
    const output = runChronologicalBacktest(source, DEFAULT_SCORING_CONFIG, input({ timeframe: "4h" }));
    expect(output.dataCutoff.model).toContain("candles[0..index]");
    output.signals.forEach(signal => {
      const entryIndex = source.findIndex(candle => candle.closeTime === signal.timestamp);
      expect(signal.dataCutoffAt).toBe(signal.timestamp);
      expect(signal.timeframe).toBe("4h");
      expect(entryIndex).toBeGreaterThanOrEqual(output.dataCutoff.requiredHistory);
      expect(["stop-loss", "take-profit", "holding-close"]).toContain(signal.exitReason);
      expect(entryIndex + output.dataCutoff.holdingBars).toBeLessThan(source.length);
    });
  });

  it("does not construct a signal until the long-EMA history is available", () => {
    const output = runChronologicalBacktest(candles(205), DEFAULT_SCORING_CONFIG, input({ holdingBars: 2, maximumConcurrent: 1 }));
    expect(output.signals.every(signal => signal.timestamp >= candles(205)[output.dataCutoff.requiredHistory].closeTime)).toBe(true);
  });

  it("reports score-combination evidence from historical decision-time reasons", () => {
    const output = runChronologicalBacktest(candles(360), DEFAULT_SCORING_CONFIG, input({ holdingBars: 4 }));
    expect(output.scoreResearch.length).toBeGreaterThan(0);
    expect(output.scoreResearch.every(row => row.sampleSize > 0)).toBe(true);
  });

  it("applies the configured account-risk percentage to historical portfolio outcomes", () => {
    const source = candles(360);
    const onePercent = runChronologicalBacktest(source, DEFAULT_SCORING_CONFIG, input({ riskPercent: 1, stopRule: "percent", stopPercent: 2 }));
    const twoPercent = runChronologicalBacktest(source, DEFAULT_SCORING_CONFIG, input({ riskPercent: 2, stopRule: "percent", stopPercent: 2 }));
    expect(onePercent.signals.length).toBeGreaterThan(0);
    expect(twoPercent.metrics.averageReturn).toBeCloseTo((onePercent.metrics.averageReturn ?? 0) * 2, 1);
  });

  it("records the selected entry, stop, and target-rule effects in each trade snapshot", () => {
    const output = runChronologicalBacktest(candles(360), DEFAULT_SCORING_CONFIG, input({ entryRule: "bullish-volume", stopRule: "percent", stopPercent: 1, takeProfitRule: "risk-reward", targetRiskReward: 1 }));
    output.signals.forEach(signal => {
      expect(signal.stopLoss).toBeLessThan(signal.entryPrice);
      expect(signal.takeProfit).toBeGreaterThan(signal.entryPrice);
      expect(["stop-loss", "take-profit", "holding-close"]).toContain(signal.exitReason);
    });
  });

  it("records post-entry outcome windows only when subsequent candle coverage exists", () => {
    const source = candles(360);
    const output = runChronologicalBacktest(source, DEFAULT_SCORING_CONFIG, input({ timeframe: "1h" }));
    output.signals.forEach(signal => {
      const entryIndex = source.findIndex(candle => candle.openTime === signal.entryTimestamp);
      expect(entryIndex).toBeGreaterThan(0);
      expect(signal.entryTimestamp).toBeGreaterThan(signal.timestamp);
      signal.outcomeHorizons.forEach(outcome => expect(entryIndex + outcome.barsAfterEntry).toBeLessThan(source.length));
    });
  });

  it("labels comparisons with missing point-in-time context as insufficient rather than inventing evidence", () => {
    const output = runChronologicalBacktest(candles(360), DEFAULT_SCORING_CONFIG, input());
    expect(output.validationResearch.combinations.find(item => item.id === "D")?.status).toBe("INSUFFICIENT DATA");
    expect(output.validationResearch.combinations.find(item => item.id === "E")?.status).toBe("INSUFFICIENT DATA");
    expect(output.validationResearch.regimeComparison.status).toBe("INSUFFICIENT DATA");
    expect(output.validationResearch.sectorComparison.status).toBe("INSUFFICIENT DATA");
  });

  it("labels robust and adverse threshold evidence deterministically while preserving the insufficient sector baseline", () => {
    const supported = buildValidationResearch(Array.from({ length: 30 }, () => evidenceSignal()), "L1");
    expect(supported.thresholds.opportunity.find(item => item.threshold === 80)?.status).toBe("SUPPORTED");
    expect(supported.thresholds.confidence.find(item => item.threshold === 70)?.status).toBe("SUPPORTED");
    expect(supported.thresholds.joint.status).toBe("SUPPORTED");
    expect(supported.sectorComparison.status).toBe("INSUFFICIENT DATA");
    const unsupported = buildValidationResearch(Array.from({ length: 30 }, () => evidenceSignal({ exitPrice: 99, returnPercent: -1, positionReturnPercent: -1, rMultiple: -1 })), "L1");
    expect(unsupported.thresholds.opportunity.find(item => item.threshold === 80)?.status).toBe("UNSUPPORTED");
  });
});
