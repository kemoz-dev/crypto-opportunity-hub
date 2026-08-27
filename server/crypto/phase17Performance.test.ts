import { describe, expect, it } from "vitest";
import { calculateAutoPaperMaximumDrawdown, calculateAutoPaperRMultiple, getAutoPaperSampleLabel } from "./autoPaper";

describe("Phase 17 Auto Paper performance intelligence", () => {
  it("uses honest sample labels and does not imply significance for small samples", () => {
    expect(getAutoPaperSampleLabel(0)).toBe("LIMITED SAMPLE");
    expect(getAutoPaperSampleLabel(5)).toBe("LIMITED SAMPLE");
    expect(getAutoPaperSampleLabel(50)).toBe("EARLY EVIDENCE");
    expect(getAutoPaperSampleLabel(500)).toBe("LARGER SAMPLE");
  });

  it("calculates R multiples from realized P/L and bounded risk amount", () => {
    expect(calculateAutoPaperRMultiple(200, 100)).toBe(2);
    expect(calculateAutoPaperRMultiple(-50, 100)).toBe(-0.5);
    expect(calculateAutoPaperRMultiple(25, 0)).toBe(25);
  });

  it("calculates peak-to-trough maximum drawdown deterministically", () => {
    expect(calculateAutoPaperMaximumDrawdown([100000, 101000, 99000, 99500, 97000, 102000])).toBe(4000);
    expect(calculateAutoPaperMaximumDrawdown([])).toBe(0);
    expect(calculateAutoPaperMaximumDrawdown([100, 110, 120])).toBe(0);
  });
});
