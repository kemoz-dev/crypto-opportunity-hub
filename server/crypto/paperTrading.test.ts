import { describe, expect, it } from "vitest";
import { assertQualifiedPaperTradeContext, buildPaperPortfolioPresentation, buildPaperTradeSnapshot, calculatePaperEntryTerms, cloneImmutableEntrySnapshot } from "./paperTrading";
import { DEFAULT_SCORING_CONFIG, type MarketRegime, type ScannerRow } from "../../shared/crypto";
import type { TradeSetupPlan } from "./tradeSetup";
import type { LowTimeframeScalpingPlan } from "./lowTimeframeScalping";

describe("paper trading integrity", () => {
  it("requires an explicit qualified setup context before a simulated position can be opened", () => {
    expect(() => assertQualifiedPaperTradeContext()).toThrow("current qualified setup context");
    expect(assertQualifiedPaperTradeContext("SWING")).toBe("SWING");
    expect(assertQualifiedPaperTradeContext("SCALP")).toBe("SCALP");
  });

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
    expect(snapshot.dataStatus).toEqual([]);
    expect(snapshot.observation.exactScoringComponents).toHaveLength(1);
    expect(snapshot.observation.missingConditions).toEqual(["No catalyst source."]);
  });

  it("keeps an optional validated setup plan immutable inside the entry snapshot", () => {
    const row = {
      asset: { id: "solana", symbol: "SOL", name: "Solana", sector: "Layer 1", price: 100, change24h: 1, marketCap: 1_000, volume24h: 500 },
      score: { score: 76, confidence: 81, technicalScore: 31, setupType: "Momentum", reasons: [], missingConditions: [], technicalByTimeframe: [] },
      dataStatus: [],
    } as unknown as ScannerRow;
    const marketRegime: MarketRegime = { score: 72, classification: "RISK ON", reasons: [], btcDominance: 50, breadth: 60 };
    const plan = { mode: "SCALP", actionable: true, symbol: "SOL", entryZone: { low: 99, high: 101, preferred: 100, reason: "Validated zone" }, stop: { price: 95 }, targets: [{ label: "TP1", price: 110, reason: "Validated structure" }], provider: "Binance Futures", dataTimestamp: 123 } as unknown as TradeSetupPlan;
    const snapshot = buildPaperTradeSnapshot(row, marketRegime, 123, DEFAULT_SCORING_CONFIG, { stopLoss: 97, takeProfit: 106 }, plan);
    plan.targets[0]!.price = 999;
    expect(snapshot.setupPlan).toMatchObject({ mode: "SCALP", entryZone: { preferred: 100 }, stop: { price: 95 }, targets: [{ label: "TP1", price: 110 }] });
  });

  it("keeps an optional verified 1m/3m/5m Scalping snapshot immutable without changing canonical paper-entry terms", () => {
    const row = {
      asset: { id: "bitcoin", symbol: "BTC", name: "Bitcoin", sector: "Large Cap", price: 100, change24h: 1, marketCap: 1_000, volume24h: 500 },
      score: { score: 76, confidence: 81, technicalScore: 31, setupType: "Momentum", reasons: [], missingConditions: [], technicalByTimeframe: [] },
      dataStatus: [],
    } as unknown as ScannerRow;
    const lowPlan = { assetId: "bitcoin", symbol: "BTC", actionable: true, presentationStatus: "QUALIFIED", direction: "LONG", provider: "Bybit Spot", dataTimestamp: 123, entryZone: { low: 99, high: 101, preferred: 100, reason: "1m/3m EMA timing", state: "READY" }, stop: { label: "STOP", price: 98, reason: "5m structure" }, invalidation: { label: "INVALIDATION", price: 98 }, targets: [{ label: "TP1", price: 103, rewardRisk: 1.5, reason: "5m structure" }], dataBundle: { state: "VALID", coherent: true, timeframes: [{ timeframe: "1m", state: "VALID" }, { timeframe: "3m", state: "VALID" }, { timeframe: "5m", state: "VALID" }] } } as unknown as LowTimeframeScalpingPlan;
    const marketRegime: MarketRegime = { score: 72, classification: "RISK ON", reasons: [], btcDominance: 50, breadth: 60 };
    const terms = { stopLoss: 97, takeProfit: 106 };
    const snapshot = buildPaperTradeSnapshot(row, marketRegime, 123, DEFAULT_SCORING_CONFIG, terms, undefined, lowPlan);
    lowPlan.targets[0]!.price = 999;
    expect(snapshot.observation).toMatchObject({ entryPrice: 100, stopLoss: 97, target: 106 });
    expect(snapshot.lowTimeframeScalpingPlan).toMatchObject({ provider: "Bybit Spot", direction: "LONG", entryZone: { preferred: 100 }, stop: { price: 98 }, targets: [{ label: "TP1", price: 103 }], dataBundle: { state: "VALID", coherent: true } });
  });

  it("derives portfolio P&L, cash estimate, win/loss metrics, and an equity curve from immutable trade records", () => {
    const at = new Date("2026-08-24T00:00:00Z");
    const presentation = buildPaperPortfolioPresentation(1_000, [
      { id: 1, assetId: "btc", status: "closed", side: "long", entryPrice: 100, positionSize: 2, realizedPnl: 40, exitPrice: 120, entryAt: at, exitAt: new Date("2026-08-24T01:00:00Z") },
      { id: 2, assetId: "eth", status: "closed", side: "short", entryPrice: 50, positionSize: 2, realizedPnl: -20, exitPrice: 60, entryAt: at, exitAt: new Date("2026-08-24T02:00:00Z") },
      { id: 3, assetId: "sol", status: "open", side: "long", entryPrice: 10, positionSize: 10, realizedPnl: null, exitPrice: null, entryAt: at, exitAt: null },
    ], new Map([["sol", 12]]));
    expect(presentation.realizedPnl).toBe(20);
    expect(presentation.unrealizedPnl).toBe(20);
    expect(presentation.totalPnl).toBe(40);
    expect(presentation.availableCash).toBe(920);
    expect(presentation.averageWin).toBe(40);
    expect(presentation.averageLoss).toBe(-20);
    expect(presentation.equityCurve.map(point => point.kind)).toEqual(["INITIAL", "CLOSED_TRADE", "CLOSED_TRADE", "CURRENT"]);
  });

  it("does not invent an open-position mark when the current price is unavailable", () => {
    const presentation = buildPaperPortfolioPresentation(1_000, [{ assetId: "sol", status: "open", side: "long", entryPrice: 10, positionSize: 10, realizedPnl: null, exitPrice: null, entryAt: new Date(), exitAt: null }], new Map());
    expect(presentation.unrealizedPnl).toBe(0);
    expect(presentation.equityCurve).toHaveLength(2);
    expect(presentation.equityCurve.at(-1)?.equity).toBe(1_000);
  });
});
