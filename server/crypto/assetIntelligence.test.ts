import { describe, expect, it } from "vitest";
import { DEFAULT_SCORING_CONFIG, type ScannerResponse, type ScannerRow } from "../../shared/crypto";
import { buildExplainabilityPresentation } from "./assetIntelligence";

const now = 1_720_000_000_000;
const candles = Array.from({ length: 205 }, (_, index) => ({ openTime: now - (206 - index) * 3_600_000, closeTime: now - (205 - index) * 3_600_000 - 1, open: 100 + index, high: 102 + index, low: 99 + index, close: 101 + index, volume: 10 + index }));
const row: ScannerRow = {
  asset: { id: "solana", symbol: "SOL", name: "Solana", binanceSymbol: "SOLUSDT", sector: "L1", price: 150, marketCap: 1_000_000_000, marketCapRank: 5, volume24h: 200_000_000, change1h: 1, change24h: 2, change7d: 3, lastUpdatedAt: now, provider: "CoinGecko" },
  score: { score: 72, confidence: 75, technicalScore: 30, momentumScore: 14, sectorScore: 61, riskScore: 70, setupType: "Trend Continuation", direction: "bullish", riskLevel: "low", multiTimeframeScore: 75, explanation: "Existing score explanation.", missingConditions: ["No additional condition."], reasons: [{ key: "technical", label: "Technical aggregation", score: 30, maxScore: 40, direction: "positive", detail: "Existing engine detail." }, { key: "risk", label: "Risk", score: 70, maxScore: 100, direction: "negative", detail: "Existing risk detail." }], technicalByTimeframe: ["15m", "1h", "4h", "1d"].map(timeframe => ({ timeframe: timeframe as "15m" | "1h" | "4h" | "1d", score: 8, maxScore: 10, bias: "bullish" as const, rsi: 58, macdHistogram: 0.4, ema20: 100, ema50: 95, ema200: 90, bollinger: null, atrPercent: 2, volumeExpansion: 1.2, priceStructure: ["Higher low"], reasons: [{ key: "ema", label: "Bullish EMA alignment", score: 2, maxScore: 2, direction: "positive" as const, detail: "Existing timeframe reason." }] })) },
  dataStatus: [{ source: "Binance Futures OHLCV", provider: "Binance Futures", status: "live", fetchedAt: now, capability: "OHLCV", timeframe: "4h", dataQuality: "VALID" }], fundingRate: null, openInterest: null,
};
const scan: ScannerResponse = { generatedAt: now, dataStatus: [{ source: "CoinGecko markets", status: "live", fetchedAt: now }], marketRegime: { score: 60, classification: "SELECTIVE", btcDominance: 50, breadth: 55, reasons: [] }, rows: [row], note: "Existing scanner note." };
const chart = { series: { provider: "Binance Futures" as const, symbol: "SOLUSDT", timeframe: "4h" as const, retrievedAt: now, normalizationVersion: "live-ohlcv-normalization-v1" as const, dataQuality: "VALID" as const, candles }, statuses: [{ source: "Binance Futures OHLCV", provider: "Binance Futures", status: "live" as const, fetchedAt: now, capability: "OHLCV" as const, timeframe: "4h" as const, dataQuality: "VALID" as const }] };

describe("Asset Intelligence presentation", () => {
  it("preserves the existing score object and dynamically groups existing evidence without a second score", () => {
    const presentation = buildExplainabilityPresentation(scan, row, "4h", chart, DEFAULT_SCORING_CONFIG);
    expect(presentation.score).toBe(row.score);
    expect(presentation.explainability.positive).toEqual([row.score!.reasons[0]]);
    expect(presentation.explainability.risk).toEqual([row.score!.reasons[1]]);
    expect(presentation.technical.matrix).toHaveLength(4);
    expect(presentation.technical.matrix.every(item => item.state !== "UNAVAILABLE")).toBe(true);
  });

  it("marks missing timeframe, risk levels, and catalyst evidence unavailable instead of inventing a value", () => {
    const unavailableChart = { series: null, statuses: [{ source: "Binance Futures OHLCV", status: "unavailable" as const, fetchedAt: now, capability: "OHLCV" as const, errorClass: "PROVIDER_UNAVAILABLE_REGION_RESTRICTION" as const, dataQuality: "UNAVAILABLE" as const }] };
    const partial = { ...row, score: { ...row.score!, technicalByTimeframe: row.score!.technicalByTimeframe.slice(0, 1) } };
    const presentation = buildExplainabilityPresentation({ ...scan, rows: [partial] }, partial, "4h", unavailableChart, DEFAULT_SCORING_CONFIG);
    expect(presentation.header.ohlcvState).toBe("UNAVAILABLE");
    expect(presentation.technical.matrix.find(item => item.timeframe === "4h")?.state).toBe("UNAVAILABLE");
    expect(presentation.risk.support).toBeNull();
    expect(presentation.context.catalyst.state).toBe("UNAVAILABLE");
  });

  it("returns chart overlays derived from the same validated candles and retains source provenance", () => {
    const presentation = buildExplainabilityPresentation(scan, row, "4h", chart, DEFAULT_SCORING_CONFIG);
    expect(presentation.technical.chart.candles).toHaveLength(120);
    expect(presentation.technical.chart.candles.at(-1)?.close).toBe(candles.at(-1)?.close);
    expect(presentation.technical.chart.provider).toBe("Binance Futures");
    expect(presentation.provenance.dataStatuses.some(status => status.provider === "Binance Futures")).toBe(true);
  });
});
