import { describe, expect, it } from "vitest";
import { normalizeBinanceCandles } from "./providers";

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
