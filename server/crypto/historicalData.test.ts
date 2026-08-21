import { describe, expect, it } from "vitest";
import { auditHistoricalCandles, summarizeQuality, validateHistoricalCandle } from "./historicalData";

const candle = (openTime: number, close = 100) => ({ openTime, closeTime: openTime + 60 * 60_000 - 1, open: close, high: close + 2, low: close - 2, close, volume: 10 });

describe("historical candle integrity", () => {
  it("rejects malformed OHLC geometry before persistence", () => {
    expect(validateHistoricalCandle({ ...candle(0), low: 103, high: 101 })).toBe("inconsistent OHLC geometry");
    expect(validateHistoricalCandle({ ...candle(0), volume: -1 })).toBe("non-positive OHLCV value");
  });

  it("deduplicates equal source revisions and finds exact interval gaps", () => {
    const audit = auditHistoricalCandles([candle(0), candle(60 * 60_000), candle(60 * 60_000), candle(3 * 60 * 60_000)], "1h");
    expect(audit.valid).toHaveLength(3);
    expect(audit.internalDuplicates).toHaveLength(1);
    expect(audit.gaps).toEqual([{ startMs: 2 * 60 * 60_000, endMs: 2 * 60 * 60_000, expectedMissingCount: 1 }]);
  });

  it("labels stale and partial coverage without manufacturing current data", () => {
    const stale = auditHistoricalCandles([candle(0), candle(60 * 60_000)], "1h");
    expect(summarizeQuality(stale.valid, stale, "1h", 10 * 60 * 60_000).status).toBe("STALE");
    const partial = auditHistoricalCandles([candle(0), candle(2 * 60 * 60_000)], "1h");
    expect(summarizeQuality(partial.valid, partial, "1h", 3 * 60 * 60_000).status).toBe("PARTIAL");
  });
});
