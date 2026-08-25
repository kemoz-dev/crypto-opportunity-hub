import { DEFAULT_SCORING_CONFIG, type MarketRegime, type ScannerRow } from "../../shared/crypto";
import type { LiveOhlcvBundle } from "./providers";
import { buildTradeHealth, buildTradeSetupPlan, summarizeDiagnostics } from "./tradeSetup";
import { describe, expect, it } from "vitest";

const analysis = (timeframe: "15m" | "1h" | "4h" | "1d", bias: "bullish" | "neutral" | "bearish") => ({ timeframe, score: 8, maxScore: 10, bias, rsi: 58, macdHistogram: 1, ema20: 139, ema50: 135, ema200: 120, bollinger: null, atrPercent: 2, volumeExpansion: 1.2, priceStructure: ["Higher low"], reasons: [{ key: "ema", label: "Bullish EMA alignment", score: 2, maxScore: 2, direction: "positive" as const, detail: "Validated alignment." }] });

const row = (): ScannerRow => ({
  asset: { id: "solana", symbol: "SOL", name: "Solana", sector: "Layer 1", price: 140, marketCap: 1, marketCapRank: 1, volume24h: 1, change1h: 1, change24h: 1, change7d: 1, lastUpdatedAt: 1, provider: "CoinGecko" },
  score: { score: 74, confidence: 72, technicalScore: 30, momentumScore: 15, sectorScore: 8, riskScore: 8, setupType: "Momentum", direction: "bullish", riskLevel: "moderate", technicalByTimeframe: [analysis("15m", "bullish"), analysis("1h", "bullish"), analysis("4h", "bullish"), analysis("1d", "bullish")], multiTimeframeScore: 20, reasons: [], missingConditions: [], explanation: "Validated inputs." },
  dataStatus: [], fundingRate: null, openInterest: null,
});

const regime: MarketRegime = { score: 70, classification: "RISK ON", reasons: [], btcDominance: 50, breadth: 60 };
const candles = Array.from({ length: 80 }, (_, index) => ({ openTime: index * 900_000, closeTime: index * 900_000 + 899_999, open: 140, high: 150, low: index === 70 ? 130 : 135, close: 140, volume: 100 }));
const bundle = (): LiveOhlcvBundle => ({
  symbol: "SOL", requiredTimeframes: ["15m", "1h", "4h"], provider: "Binance Futures", providerSymbol: "SOLUSDT", state: "VALID", coherent: true, eligibleForScoring: true, statusMessage: "All required timeframes were validated from Binance Futures.", seriesByTimeframe: {}, statuses: [],
  timeframes: ["15m", "1h", "4h"].map(timeframe => ({ timeframe: timeframe as "15m" | "1h" | "4h", provider: "Binance Futures", symbol: "SOLUSDT", state: "VALID", status: "live", fetchedAt: 123, candleCount: 202, oldestCandleAt: 1, newestCandleAt: 2, freshnessMs: 500, eligibleForScoring: true, message: null, errorClass: null })),
});

describe("trade setup intelligence", () => {
  it("creates a separate, explainable 15M scalp plan from validated technical inputs without changing the Opportunity score", () => {
    const plan = buildTradeSetupPlan("SCALP", row(), regime, candles, "Binance Futures", 123, bundle());
    expect(plan.minimumValidatedTimeframe).toContain("15M");
    expect(plan.timeframes).toEqual({ execution: "15m", confirmation: "1h", context: "4h" });
    expect(plan.opportunityScore).toBe(74);
    expect(plan.actionable).toBe(true);
    expect(plan.tradeSetupQuality).not.toBeNull();
    expect(plan.stop?.price).toBeLessThan(plan.entryZone!.preferred);
    expect(plan.targets[0]?.price).toBeGreaterThan(plan.entryZone!.preferred);
    expect(plan.dataBundle).toMatchObject({ provider: "Binance Futures", coherent: true, eligibleForScoring: true, state: "VALID" });
    expect(plan.diagnostics.find(condition => condition.key === "provider_bundle")).toMatchObject({ status: "PASSED" });
  });

  it("returns NO TRADE rather than inventing a plan when structure cannot yield a valid target", () => {
    const unavailable = buildTradeSetupPlan("SCALP", row(), regime, candles.map(candle => ({ ...candle, high: 141, low: 139 })), "Binance Futures", 123);
    expect(unavailable.actionable).toBe(false);
    expect(unavailable.direction).toBe("NO TRADE");
    expect(unavailable.targets).toEqual([]);
    expect(unavailable.diagnostics.find(condition => condition.key === "structural_stop")?.status).toBe("PASSED");
    expect(unavailable.diagnostics.find(condition => condition.key === "risk_reward")).toMatchObject({ status: "FAILED" });
    expect(unavailable.diagnostics.find(condition => condition.key === "risk_reward")?.required).toContain("1:1");
  });

  it("explains an existing neutral-direction rejection without changing the rejection", () => {
    const neutral = row();
    neutral.score!.direction = "neutral";
    const plan = buildTradeSetupPlan("SCALP", neutral, regime, candles, "Binance Futures", 123);
    expect(plan.actionable).toBe(false);
    expect(plan.direction).toBe("NO TRADE");
    expect(plan.diagnostics.find(condition => condition.key === "opportunity_direction")).toMatchObject({ status: "FAILED", actual: "Existing Opportunity direction is neutral." });
    expect(plan.diagnostics.find(condition => condition.key === "entry_zone")?.status).toBe("UNAVAILABLE");
  });

  it("aggregates actual diagnostic states across plans without creating a setup", () => {
    const neutral = row();
    neutral.score!.direction = "neutral";
    const neutralPlan = buildTradeSetupPlan("SCALP", neutral, regime, candles, "Binance Futures", 123, bundle());
    const unavailablePlan = buildTradeSetupPlan("SCALP", row(), regime, candles.map(candle => ({ ...candle, high: 141, low: 139 })), "Binance Futures", 123, bundle());
    const summary = summarizeDiagnostics([neutralPlan, unavailablePlan]);
    expect(summary).toMatchObject({ evaluatedAssets: 2, noTradeAssets: 2 });
    expect(summary.byCondition.find(condition => condition.key === "opportunity_direction")?.failed).toBe(1);
    expect(summary.topNoTradeReasons.length).toBeGreaterThan(0);
    expect(summary.classification).toEqual({ lackOfMarketSetups: 1, missingData: 0, staleData: 0, existingSetupRequirement: 1 });
  });

  it("keeps current Trade Health separate from immutable entry evidence and never implies auto-close", () => {
    const plan = buildTradeSetupPlan("SCALP", row(), regime, candles, "Binance Futures", 123);
    const health = buildTradeHealth(plan, { price: plan.invalidation!.price - 1, execution: analysis("15m", "bearish"), confirmation: analysis("1h", "bearish"), context: analysis("4h", "bullish"), generatedAt: 456 });
    expect(health.state).toBe("INVALIDATED");
    expect(health.reversalWarning).toContain("Potential reversal warning");
    expect(health.targetProgress[0]).toMatchObject({ label: "TP1", reached: false });
  });

  it("does not create a health label from a legacy trade without an immutable setup plan", () => {
    const health = buildTradeHealth(undefined, { price: 140, execution: analysis("15m", "bullish"), confirmation: analysis("1h", "bullish"), context: analysis("4h", "bullish"), generatedAt: 456 });
    expect(health.state).toBe("DATA UNAVAILABLE");
  });
});
