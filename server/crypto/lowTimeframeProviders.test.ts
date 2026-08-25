import { afterEach, describe, expect, it, vi } from "vitest";
import { clearLowTimeframeProviderCache, fetchValidatedLowTimeframeBundle, normalizeBybitSpotCandles, validateLowTimeframeCandles } from "./lowTimeframeProviders";

function bybitRows(timeframe: "1m" | "3m" | "5m", count = 210, volume = "3") {
  const interval = timeframe === "1m" ? 60_000 : timeframe === "3m" ? 3 * 60_000 : 5 * 60_000;
  const start = Math.floor((Date.now() - (count + 2) * interval) / interval) * interval;
  return Array.from({ length: count }, (_, index) => {
    const price = 100 + index * 0.05;
    return [String(start + index * interval), String(price), String(price + 0.5), String(price - 0.5), String(price + 0.15), volume, String(price * 2)];
  }).reverse();
}

function bybitResponse(timeframe: "1m" | "3m" | "5m", symbol = "BTCUSDT", rows = bybitRows(timeframe)) {
  return new Response(JSON.stringify({ retCode: 0, retMsg: "OK", result: { category: "spot", symbol, list: rows } }), { status: 200, headers: { "Content-Type": "application/json" } });
}

afterEach(() => {
  clearLowTimeframeProviderCache();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Bybit Spot low-timeframe provider contract", () => {
  it("normalizes a documented Bybit Kline shape into true requested completed-candle candidates", () => {
    const candles = normalizeBybitSpotCandles({ retCode: 0, result: { category: "spot", symbol: "BTCUSDT", list: [["120000", "100", "102", "99", "101", "10", "ignored"]] } }, "BTCUSDT", "1m");
    expect(candles).toEqual([{ openTime: 120000, closeTime: 179999, open: 100, high: 102, low: 99, close: 101, volume: 10 }]);
  });

  it("validates one coherent Bybit Spot 1m/3m/5m bundle without calling the existing provider path", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const interval = new URL(String(input)).searchParams.get("interval");
      return bybitResponse(interval === "1" ? "1m" : interval === "3" ? "3m" : "5m");
    });
    vi.stubGlobal("fetch", fetchMock);
    const bundle = await fetchValidatedLowTimeframeBundle("BTC", 202);
    expect(bundle).toMatchObject({ provider: "Bybit Spot", providerSymbol: "BTCUSDT", state: "VALID", coherent: true, eligibleForScalping: true });
    expect(bundle.timeframes.map(item => item.timeframe)).toEqual(["1m", "3m", "5m"]);
    expect(bundle.timeframes.every(item => item.provider === "Bybit Spot" && item.eligibleForScalping && item.candleCount === 202)).toBe(true);
    expect(fetchMock.mock.calls.every(([url]) => String(url).includes("api.bybit.com/v5/market/kline"))).toBe(true);
  });

  it.each([
    ["zero volume", "1m", bybitRows("1m", 210, "0"), "MISSING_VOLUME"],
    ["symbol mismatch", "3m", bybitRows("3m"), "SYMBOL_MAPPING_MISMATCH"],
  ])("returns PARTIAL and no usable bundle for %s", async (_label, affected, rows, expectedError) => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
      const interval = new URL(String(input)).searchParams.get("interval");
      const timeframe = interval === "1" ? "1m" : interval === "3" ? "3m" : "5m";
      return bybitResponse(timeframe, affected === timeframe && expectedError === "SYMBOL_MAPPING_MISMATCH" ? "ETHUSDT" : "BTCUSDT", affected === timeframe ? rows as string[][] : bybitRows(timeframe));
    }));
    const bundle = await fetchValidatedLowTimeframeBundle("BTC", 202);
    expect(bundle).toMatchObject({ state: "PARTIAL", provider: null, coherent: false, eligibleForScalping: false });
    expect(bundle.seriesByTimeframe).toEqual({});
    expect(bundle.timeframes.find(item => item.timeframe === affected)).toMatchObject({ eligibleForScalping: false, errorClass: expectedError });
  });

  it.each([
    [401, "PROVIDER_REQUEST_FAILED"],
    [403, "PROVIDER_REQUEST_FAILED"],
    [429, "PROVIDER_RATE_LIMITED"],
    [451, "PROVIDER_REQUEST_FAILED"],
    [500, "PROVIDER_REQUEST_FAILED"],
  ])("fails closed for upstream HTTP %s without a partial analysis", async (status, errorClass) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("provider failure", { status })));
    const bundle = await fetchValidatedLowTimeframeBundle("BTC", 202);
    expect(bundle).toMatchObject({ state: "MISSING", eligibleForScalping: false, coherent: false, seriesByTimeframe: {} });
    expect(bundle.timeframes).toHaveLength(3);
    expect(bundle.timeframes.every(item => item.state === "MISSING" && item.errorClass === errorClass && item.message?.includes(`HTTP ${status}`))).toBe(true);
  });

  it.each([
    ["empty body", async () => new Response("", { status: 200 })],
    ["malformed JSON", async () => new Response("{not-json", { status: 200 })],
    ["timeout-like abort", async () => { throw new Error("request abort"); }],
  ])("fails closed for %s", async (_label, responseFactory) => {
    vi.stubGlobal("fetch", vi.fn(responseFactory));
    const bundle = await fetchValidatedLowTimeframeBundle("BTC", 202);
    expect(bundle).toMatchObject({ state: "MISSING", eligibleForScalping: false, coherent: false, seriesByTimeframe: {} });
    expect(bundle.timeframes.every(item => item.eligibleForScalping === false && item.state === "MISSING")).toBe(true);
  });

  it("rejects stale, duplicate/gapped, malformed, and future candle data before it can form a setup", () => {
    const now = Date.now();
    const interval = 60_000;
    const staleStart = Math.floor((now - 10 * interval) / interval) * interval;
    const stale = Array.from({ length: 202 }, (_, index) => ({ openTime: staleStart - (201 - index) * interval, closeTime: staleStart - (201 - index) * interval + interval - 1, open: 100, high: 101, low: 99, close: 100.5, volume: 1 }));
    expect(() => validateLowTimeframeCandles(stale, "1m", now, 202)).toThrow(/three-interval freshness/i);
    const good = normalizeBybitSpotCandles({ retCode: 0, result: { category: "spot", symbol: "BTCUSDT", list: bybitRows("1m") } }, "BTCUSDT", "1m");
    const gapped = [...good];
    gapped.splice(20, 1);
    expect(() => validateLowTimeframeCandles(gapped, "1m", now, 202)).toThrow(/duplicate or missing/i);
    expect(() => normalizeBybitSpotCandles({ retCode: 0, result: { category: "spot", symbol: "BTCUSDT", list: [["100", "bad", "2", "1", "1.5", "10"]] } }, "BTCUSDT", "1m")).toThrow(/non-finite/i);
    const future = [...good.slice(-202), { ...good.at(-1)!, openTime: now + interval, closeTime: now + 2 * interval - 1 }];
    expect(() => validateLowTimeframeCandles(future, "1m", now, 202)).toThrow(/future/i);
  });
});
