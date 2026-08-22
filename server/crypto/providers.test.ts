import { afterEach, describe, expect, it, vi } from "vitest";
import { strToU8, zipSync } from "fflate";
import { fetchBinanceHistoricalArchiveRange, normalizeBinanceCandles } from "./providers";

function archiveResponse(fileName: string, csv: string) {
  return new Response(zipSync({ [fileName]: strToU8(csv) }), { status: 200, headers: { "Content-Type": "application/zip" } });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Binance candle normalization", () => {
  it("maps a valid raw kline record into the canonical analytical candle shape", () => {
    const normalized = normalizeBinanceCandles([[1_000, "100.1", "101.5", "99.8", "100.8", "420.5", 1_999, "ignored"]]);
    expect(normalized).toEqual([{ openTime: 1_000, closeTime: 1_999, open: 100.1, high: 101.5, low: 99.8, close: 100.8, volume: 420.5 }]);
  });

  it("rejects malformed or non-finite exchange rows instead of constructing a candle", () => {
    expect(normalizeBinanceCandles([[1, "bad", "2", "1", "1.5", "10", 2], { invalid: true }])).toEqual([]);
    expect(normalizeBinanceCandles({ data: [] })).toEqual([]);
  });
});

describe("Binance public archive range fallback", () => {
  it("uses a recent daily futures archive when the current monthly archive is not yet published", async () => {
    const start = Date.UTC(2026, 7, 21, 0, 0, 0);
    const close = start + 15 * 60_000 - 1;
    vi.spyOn(Date, "now").mockReturnValue(Date.UTC(2026, 7, 22, 12, 0, 0));
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("/monthly/")) return new Response("", { status: 404 });
      return archiveResponse("ETHUSDT-15m-2026-08-21.csv", `${start},100,102,99,101,5,${close}\n`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchBinanceHistoricalArchiveRange("ETHUSDT", "15m", "perpetual", start, close, 2);

    expect(result.candles).toEqual([{ openTime: start, open: 100, high: 102, low: 99, close: 101, volume: 5, closeTime: close }]);
    expect(result.unavailableMonths).toEqual([]);
    expect(result.dailyFallbackDays).toEqual(["2026-08-21"]);
    expect(result.unavailableDays).toEqual([]);
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toContain("https://data.binance.vision/data/futures/um/daily/klines/ETHUSDT/15m/ETHUSDT-15m-2026-08-21.zip");
  });

  it("retains explicit unavailable daily evidence and does not widen an old missing month into daily requests", async () => {
    const recentStart = Date.UTC(2026, 7, 21, 0, 0, 0);
    const recentEnd = recentStart + 15 * 60_000 - 1;
    vi.spyOn(Date, "now").mockReturnValue(Date.UTC(2026, 7, 22, 12, 0, 0));
    const fetchMock = vi.fn(async () => new Response("", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    const recent = await fetchBinanceHistoricalArchiveRange("PEPEUSDT", "15m", "perpetual", recentStart, recentEnd, 2);
    expect(recent.unavailableMonths).toEqual(["2026-08"]);
    expect(recent.dailyFallbackDays).toEqual(["2026-08-21"]);
    expect(recent.unavailableDays).toEqual(["2026-08-21"]);

    fetchMock.mockClear();
    const oldStart = Date.UTC(2025, 7, 1, 0, 0, 0);
    const oldEnd = Date.UTC(2025, 7, 1, 0, 14, 59);
    const old = await fetchBinanceHistoricalArchiveRange("PEPEUSDT", "15m", "perpetual", oldStart, oldEnd, 2);
    expect(old.unavailableMonths).toEqual(["2025-08"]);
    expect(old.dailyFallbackDays).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uses the spot daily archive route and normalizes post-2025 microsecond timestamps", async () => {
    const start = Date.UTC(2026, 7, 21, 0, 0, 0);
    const close = start + 60 * 60_000 - 1;
    vi.spyOn(Date, "now").mockReturnValue(Date.UTC(2026, 7, 22, 12, 0, 0));
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("/monthly/")) return new Response("", { status: 404 });
      return archiveResponse("SOLUSDT-1h-2026-08-21.csv", `${start * 1_000},200,205,198,203,9,${close * 1_000}\n`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchBinanceHistoricalArchiveRange("SOLUSDT", "1h", "spot", start, close, 2);

    expect(result.candles).toEqual([{ openTime: start, open: 200, high: 205, low: 198, close: 203, volume: 9, closeTime: close }]);
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toContain("https://data.binance.vision/data/spot/daily/klines/SOLUSDT/1h/SOLUSDT-1h-2026-08-21.zip");
  });
});
