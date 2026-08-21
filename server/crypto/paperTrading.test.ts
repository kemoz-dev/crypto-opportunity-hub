import { describe, expect, it } from "vitest";
import { buildPaperTradeSnapshot, calculatePaperEntryTerms, cloneImmutableEntrySnapshot } from "./paperTrading";
import { DEFAULT_SCORING_CONFIG, type MarketRegime, type ScannerRow } from "../../shared/crypto";

describe("paper trading integrity", () => {
  it("derives symmetric 2R long and short terms from a recorded entry and ATR", () => {
    const long = calculatePaperEntryTerms(100, 2, "long", 100_000, 1);
    const short = calculatePaperEntryTerms(100, 2, "short", 100_000, 1);
    expect(long.stopLoss).toBeLessThan(100);
    expect(long.takeProfit).toBeGreaterThan(100);
    expect(short.stopLoss).toBeGreaterThan(100);
    expect(short.takeProfit).toBeLessThan(100);
    expect(long.rewardRisk).toBe(2);
    expect(short.rewardRisk).toBe(2);
  });

  it("copies the full entry context so later in-memory mutations cannot alter the recorded snapshot", () => {
    const source = { score: 72, reasons: ["volume confirmation"], nested: { regime: "RISK ON" } };
    const snapshot = cloneImmutableEntrySnapshot(source);
    source.score = 10;
    source.reasons.push("later mutation");
    source.nested.regime = "RISK OFF";
    expect(snapshot).toEqual({ score: 72, reasons: ["volume confirmation"], nested: { regime: "RISK ON" } });
  });

  it("records the full live evidence required to audit a paper-trade observation", () => {
    const row = {
      asset: { id: "bitcoin", symbol: "BTC", name: "Bitcoin", sector: "Large Cap", price: 100, change24h: 1, marketCap: 1_000, volume24h: 500 },
      score: { score: 76, confidence: 81, technicalScore: 31, setupType: "Breakout", reasons: [{ key: "ema", label: "EMA alignment", score: 2, maxScore: 2, direction: "positive", detail: "Aligned." }], missingConditions: ["No catalyst source."], technicalByTimeframe: [{ timeframe: "1h", score: 8, maxScore: 10, bias: "bullish", rsi: 58, macdHistogram: 0.1, atrPercent: 2, volumeExpansion: 1.5, priceStructure: ["Breakout"], reasons: [] }] },
      dataStatus: [],
    } as unknown as ScannerRow;
    const marketRegime: MarketRegime = { score: 72, classification: "RISK ON", reasons: [], btcDominance: 50, breadth: 60 };
    const snapshot = buildPaperTradeSnapshot(row, marketRegime, 123, DEFAULT_SCORING_CONFIG, { stopLoss: 97, takeProfit: 106 });
    expect(snapshot.observation).toMatchObject({ timestamp: 123, asset: "BTC", sector: "Large Cap", timeframes: ["1h"], opportunityScore: 76, confidenceScore: 81, technicalScore: 31, setupType: "Breakout", entryPrice: 100, stopLoss: 97, target: 106 });
    expect(snapshot.observation.exactScoringComponents).toHaveLength(1);
    expect(snapshot.observation.missingConditions).toEqual(["No catalyst source."]);
  });
});
