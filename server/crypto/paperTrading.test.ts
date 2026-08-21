import { describe, expect, it } from "vitest";
import { calculatePaperEntryTerms, cloneImmutableEntrySnapshot } from "./paperTrading";

describe("paper trading integrity", () => {
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
});
