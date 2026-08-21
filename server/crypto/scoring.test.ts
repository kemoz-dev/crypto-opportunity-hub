import { describe, expect, it } from "vitest";
import { DEFAULT_SCORING_CONFIG, type MarketAsset, type TimeframeAnalysis } from "../../shared/crypto";
import { buildOpportunityScore, calculateMarketRegime } from "./scoring";

const btc: MarketAsset = {
  id: "bitcoin", symbol: "BTC", name: "Bitcoin", binanceSymbol: "BTCUSDT", sector: "Large Cap", price: 100_000, marketCap: 2_000_000_000_000,
  marketCapRank: 1, volume24h: 100_000_000_000, change1h: 1, change24h: 3, change7d: 5, lastUpdatedAt: 1_700_000_000_000, provider: "CoinGecko",
};

const asset: MarketAsset = {
  id: "sample", symbol: "SMP", name: "Sample", binanceSymbol: "SMPUSDT", sector: "L1", price: 50, marketCap: 20_000_000_000,
  marketCapRank: 12, volume24h: 1_000_000_000, change1h: 2, change24h: 8, change7d: 16, lastUpdatedAt: 1_700_000_000_000, provider: "CoinGecko",
};

function analysis(timeframe: TimeframeAnalysis["timeframe"], bias: TimeframeAnalysis["bias"] = "bullish"): TimeframeAnalysis {
  return {
    timeframe, bias, score: bias === "bullish" ? 8 : 4, maxScore: 10, rsi: 58, macdHistogram: 1.2, atrPercent: 2.5, volumeExpansion: 1.4,
    priceStructure: bias === "bullish" ? ["Higher low"] : [],
    reasons: [{ key: "ema", label: "Bullish EMA alignment", score: bias === "bullish" ? 2 : 0.5, maxScore: 2, direction: bias === "bullish" ? "positive" : "neutral", detail: "Test fixture" }],
  };
}

describe("explainable opportunity scoring", () => {
  it("keeps market regime within its stated 0–100 range and classifies it", () => {
    const regime = calculateMarketRegime(btc, [btc, asset], { btcDominance: 52, totalMarketChange24h: 2, updatedAt: Date.now() });
    expect(regime).not.toBeNull();
    expect(regime?.score).toBeGreaterThanOrEqual(0);
    expect(regime?.score).toBeLessThanOrEqual(100);
    expect(regime?.classification).toBe("RISK ON");
  });

  it("returns score components, timeframe contributions, and non-invented missing conditions", () => {
    const regime = calculateMarketRegime(btc, [btc, asset], { btcDominance: 52, totalMarketChange24h: 2, updatedAt: Date.now() });
    const result = buildOpportunityScore({ asset, analyses: [analysis("15m"), analysis("1h"), analysis("4h"), analysis("1d")], universe: [btc, asset], btc, marketRegime: regime, config: DEFAULT_SCORING_CONFIG });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.technicalByTimeframe).toHaveLength(4);
    expect(result.reasons.some(reason => reason.key === "technical")).toBe(true);
    expect(result.explanation).toContain("SMP");
  });

  it("reports incomplete timeframe confirmation instead of assuming missing data is bullish", () => {
    const regime = calculateMarketRegime(btc, [btc, asset], { btcDominance: 52, totalMarketChange24h: 2, updatedAt: Date.now() });
    const result = buildOpportunityScore({ asset, analyses: [analysis("4h")], universe: [btc, asset], btc, marketRegime: regime, config: DEFAULT_SCORING_CONFIG });
    expect(result.missingConditions).toContain("One or more enabled timeframes did not have sufficient current OHLCV data.");
  });
});
