import { afterEach, describe, expect, it, vi } from "vitest";

const providerMocks = vi.hoisted(() => ({ fetchValidatedLiveOhlcv: vi.fn(), getApprovedKrakenMappings: vi.fn(() => ({ mappings: { BTC: "BTC/USD", ETH: "ETH/USD" }, intervals: { "15m": 15, "1h": 60, "4h": 240, "1d": 1440 }, historicalDepth: "UP_TO_720_RECENT_CANDLES", freshnessLimit: "VALIDATED_BY_COMPLETE_CANDLE_TIMESTAMP", requestConstraint: "UNKNOWN" })) }));

vi.mock("./providers", () => providerMocks);

import { executeProviderMonitorCheck, providerMonitorCheckRows } from "./providerMonitor";

function validSeries(provider: "Binance Futures" | "Kraken Spot" = "Binance Futures") {
  const now = Date.now();
  return { provider, symbol: provider === "Binance Futures" ? "BTCUSDT" : "BTC/USD", timeframe: "15m" as const, retrievedAt: now, normalizationVersion: "live-ohlcv-normalization-v1" as const, dataQuality: "VALID" as const, candles: Array.from({ length: 202 }, (_, index) => ({ openTime: now - (203 - index) * 15 * 60_000, closeTime: now - (202 - index) * 15 * 60_000 - 1, open: 100, high: 102, low: 99, close: 101, volume: 3 })) };
}

afterEach(() => vi.clearAllMocks());

describe("provider monitor checks", () => {
  it("records a valid Binance primary OHLCV check with a fresh complete series", async () => {
    providerMocks.fetchValidatedLiveOhlcv.mockResolvedValue({ series: validSeries(), statuses: [{ provider: "Binance Futures", status: "live" }] });
    const check = await executeProviderMonitorCheck("15m");
    expect(check).toMatchObject({ provider: "Binance Futures", status: "live", fallbackUsed: false, dataQuality: "VALID", capability: "OHLCV" });
    expect(check.details).toMatchObject({ controlCase: "BINANCE_PRIMARY", fresh: true, mappingValidated: true });
  });

  it("records controlled Binance 451-to-Kraken fallback success without fabricating a candle", async () => {
    providerMocks.fetchValidatedLiveOhlcv.mockResolvedValue({ series: validSeries("Kraken Spot"), statuses: [{ provider: "Binance Futures", status: "unavailable", errorClass: "PROVIDER_UNAVAILABLE_REGION_RESTRICTION", message: "HTTP 451" }, { provider: "Kraken Spot", status: "live" }] });
    const check = await executeProviderMonitorCheck("15m", { forceBinance451: true }, "FORCED_BINANCE_451_KRAKEN_VALID");
    expect(check).toMatchObject({ provider: "Kraken Spot", status: "live", fallbackUsed: true, dataQuality: "VALID", classification: "PROVIDER_UNAVAILABLE_REGION_RESTRICTION" });
    expect(providerMocks.fetchValidatedLiveOhlcv).toHaveBeenCalledWith("BTC", "15m", 202, 240, { forceBinance451: true });
  });

  it("records the controlled invalid/unavailable fallback branch as final UNAVAILABLE", async () => {
    providerMocks.fetchValidatedLiveOhlcv.mockResolvedValue({ series: null, statuses: [{ provider: "Binance Futures", status: "unavailable", errorClass: "PROVIDER_UNAVAILABLE_REGION_RESTRICTION", message: "HTTP 451" }, { provider: "Kraken Spot", status: "unavailable", errorClass: "VALIDATION_FAILED" }] });
    const check = await executeProviderMonitorCheck("15m", { forceBinance451: true, forceKrakenUnavailable: true }, "FORCED_BINANCE_451_KRAKEN_UNAVAILABLE");
    expect(check).toMatchObject({ status: "unavailable", dataQuality: "UNAVAILABLE", expectedUnavailable: true, classification: "VALIDATION_FAILED" });
  });

  it("labels an otherwise valid but stale completed candle window as stale rather than live", async () => {
    const series = validSeries();
    series.candles = series.candles.map(candle => ({ ...candle, openTime: candle.openTime - 10 * 24 * 60 * 60_000, closeTime: candle.closeTime - 10 * 24 * 60 * 60_000 }));
    providerMocks.fetchValidatedLiveOhlcv.mockResolvedValue({ series, statuses: [{ provider: "Binance Futures", status: "live" }] });
    const check = await executeProviderMonitorCheck("15m");
    expect(check).toMatchObject({ status: "stale", dataQuality: "VALID", fallbackUsed: false });
  });

  it("retains immutable monitoring persistence fields including latency, classification, fallback usage, mappings, and expected-unavailable evidence", () => {
    const rows = providerMonitorCheckRows(99, [{ provider: "Kraken Spot", capability: "OHLCV", status: "unavailable", httpStatus: 451, classification: "PROVIDER_UNAVAILABLE_REGION_RESTRICTION", latencyMs: 12, timeframe: "15m", symbolsTested: ["BTC", "ETH"], fallbackUsed: true, dataQuality: "UNAVAILABLE", expectedUnavailable: true, details: { controlCase: "FORCED_BINANCE_451_KRAKEN_UNAVAILABLE" } }]);
    expect(rows).toEqual([expect.objectContaining({ executionId: 99, provider: "Kraken Spot", latencyMs: 12, fallbackUsed: true, dataQuality: "UNAVAILABLE", details: { controlCase: "FORCED_BINANCE_451_KRAKEN_UNAVAILABLE", expectedUnavailable: true } })]);
  });
});
