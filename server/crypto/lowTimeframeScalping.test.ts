import { describe, expect, it } from "vitest";
import { DEFAULT_ASSET_UNIVERSE, DEFAULT_SCORING_CONFIG, type Candle } from "../../shared/crypto";
import { analyzeLowTimeframe, buildLowTimeframeScalpingPlan, buildLowTimeframeTradeHealth } from "./lowTimeframeScalping";
import type { LowTimeframeBundle } from "./lowTimeframeProviders";

function candles(timeframe: "1m" | "3m" | "5m", direction: "up" | "down", count = 240): Candle[] {
  const interval = timeframe === "1m" ? 60_000 : timeframe === "3m" ? 3 * 60_000 : 5 * 60_000;
  const start = Math.floor((Date.now() - (count + 3) * interval) / interval) * interval;
  return Array.from({ length: count }, (_, index) => {
    const trend = direction === "up" ? index * 0.025 : -index * 0.025;
    const oscillation = (direction === "up" ? 1 : -1) * Math.sin((index - count + 1) / 4) * 1.2;
    const open = 100 + trend + oscillation * 0.8;
    const close = 100 + trend + oscillation;
    return { openTime: start + index * interval, closeTime: start + (index + 1) * interval - 1, open, high: Math.max(open, close) + 0.45, low: Math.min(open, close) - 0.45, close, volume: index === count - 1 ? 10 : 3 };
  });
}

function qualifiedCandles(timeframe: "1m" | "3m" | "5m", count = 240): Candle[] {
  const interval = timeframe === "1m" ? 60_000 : timeframe === "3m" ? 3 * 60_000 : 5 * 60_000;
  const start = Math.floor((Date.now() - (count + 3) * interval) / interval) * interval;
  return Array.from({ length: count }, (_, index) => {
    const close = index < 214 ? 100 + index * 0.02 : index < 238 ? 104.5 : index === 238 ? 104.7 : 104.8;
    const open = index === 0 ? close - 0.02 : close - 0.02;
    const high = index === 211 ? 105.4 : Math.max(open, close) + 0.1;
    const low = Math.min(open, close) - 0.1;
    return { openTime: start + index * interval, closeTime: start + (index + 1) * interval - 1, open, high, low, close, volume: index === count - 1 ? 10 : 3 };
  });
}

function bundle(direction: "up" | "down", overrides: Partial<LowTimeframeBundle> = {}): LowTimeframeBundle {
  const now = Date.now();
  const build = (timeframe: "1m" | "3m" | "5m") => ({ provider: "Bybit Spot" as const, symbol: "BTCUSDT", timeframe, retrievedAt: now, normalizationVersion: "low-timeframe-bybit-spot-v1" as const, candles: candles(timeframe, direction) });
  const seriesByTimeframe = { "1m": build("1m"), "3m": build("3m"), "5m": build("5m") };
  return { assetSymbol: "BTC", requiredTimeframes: ["1m", "3m", "5m"], provider: "Bybit Spot", providerSymbol: "BTCUSDT", state: "VALID", coherent: true, eligibleForScalping: true, statusMessage: "validated", capturedAt: now, seriesByTimeframe, timeframes: (["1m", "3m", "5m"] as const).map(timeframe => ({ timeframe, provider: "Bybit Spot" as const, symbol: "BTCUSDT", state: "VALID" as const, status: "live" as const, fetchedAt: now, candleCount: 202, oldestCandleAt: null, newestCandleAt: now - 1, freshnessMs: 1, eligibleForScalping: true, message: null, errorClass: null })), ...overrides };
}

describe("isolated low-timeframe Scalping Intelligence", () => {
  it("derives bullish and bearish low-timeframe states without touching the shared timeframe union", () => {
    expect(analyzeLowTimeframe(candles("1m", "up"), "1m", DEFAULT_SCORING_CONFIG)?.bias).toBe("bullish");
    expect(analyzeLowTimeframe(candles("1m", "down"), "1m", DEFAULT_SCORING_CONFIG)?.bias).toBe("bearish");
  });

  it("returns a single-provider qualified plan with entry, structure stop, technical targets, target path, and separate quality when all three timeframes agree", () => {
    const coherent = bundle("up");
    (["1m", "3m", "5m"] as const).forEach(timeframe => { coherent.seriesByTimeframe[timeframe] = { ...coherent.seriesByTimeframe[timeframe]!, candles: qualifiedCandles(timeframe) }; });
    const plan = buildLowTimeframeScalpingPlan(DEFAULT_ASSET_UNIVERSE[0], coherent, DEFAULT_SCORING_CONFIG);
    expect(plan.alignment).toBe("STRONG");
    expect(plan.direction).toBe("LONG");
    expect(plan.entryZone).not.toBeNull();
    expect(plan.stop).not.toBeNull();
    expect(plan.targets.length).toBeGreaterThanOrEqual(1);
    expect(plan.targets.every(target => target.price > plan.entryZone!.preferred && target.rewardRisk !== null)).toBe(true);
    expect(plan.targetPath[0]).toMatchObject({ label: "ENTRY", status: "CURRENT" });
    expect(plan.setupQuality.label).toBe("Scalping Setup Quality");
  });

  it("returns WATCH or NO TRADE for conflicted timeframes and never derives levels from an incoherent bundle", () => {
    const conflicted = bundle("up");
    conflicted.seriesByTimeframe["5m"] = { ...conflicted.seriesByTimeframe["5m"]!, candles: candles("5m", "down") };
    const plan = buildLowTimeframeScalpingPlan(DEFAULT_ASSET_UNIVERSE[0], conflicted, DEFAULT_SCORING_CONFIG);
    expect(plan.presentationStatus).not.toBe("QUALIFIED");
    expect(plan.entryZone).toBeNull();
    expect(plan.noTradeReasons.join(" ")).toMatch(/conflicted|confirmation|neutral/i);
    const unavailable = buildLowTimeframeScalpingPlan(DEFAULT_ASSET_UNIVERSE[0], bundle("up", { state: "PARTIAL", coherent: false, eligibleForScalping: false, provider: null, providerSymbol: null, seriesByTimeframe: {} }), DEFAULT_SCORING_CONFIG);
    expect(unavailable).toMatchObject({ presentationStatus: "NO TRADE", direction: "NO TRADE" });
    expect(unavailable.noTradeReasons[0]).toMatch(/DATA UNAVAILABLE/i);
  });

  it("keeps health manual, maps weakening to WARNING/DANGER, and returns HEALTH UNKNOWN when the current provider bundle is stale", () => {
    const entry = buildLowTimeframeScalpingPlan(DEFAULT_ASSET_UNIVERSE[0], bundle("up"), DEFAULT_SCORING_CONFIG);
    expect(entry.actionable || entry.presentationStatus === "NO TRADE").toBe(true);
    const qualifiedEntry = { ...entry, actionable: true, direction: "LONG" as const, entryZone: { low: 100, high: 101, preferred: 100.5, reason: "fixture", state: "READY" as const }, invalidation: { label: "INVALIDATION" as const, price: 99, distancePercent: null, rewardRisk: null, reason: "fixture", priority: "PRIMARY" as const }, targets: [{ label: "TP1" as const, price: 102, distancePercent: 1.5, rewardRisk: 1.5, reason: "fixture", priority: "PRIMARY" as const }] };
    const healthy = buildLowTimeframeTradeHealth(qualifiedEntry, { ...qualifiedEntry, currentPrice: 101 });
    expect(["HEALTHY", "WARNING"]).toContain(healthy.state);
    const dangerCurrent = { ...qualifiedEntry, timeframeStates: qualifiedEntry.timeframeStates.map(state => state.timeframe === "3m" ? { ...state, bias: "bearish" as const } : state) };
    expect(buildLowTimeframeTradeHealth(qualifiedEntry, dangerCurrent).state).toBe("DANGER");
    const invalidated = buildLowTimeframeTradeHealth(qualifiedEntry, { ...qualifiedEntry, currentPrice: 98.5 });
    expect(invalidated.state).toBe("INVALIDATED");
    expect(buildLowTimeframeTradeHealth(qualifiedEntry, { ...qualifiedEntry, dataBundle: { ...qualifiedEntry.dataBundle, state: "STALE" as const } }).state).toBe("HEALTH UNKNOWN");
  });
});
