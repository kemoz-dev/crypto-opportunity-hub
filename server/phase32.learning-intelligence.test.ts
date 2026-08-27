import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getAutoPaperIntelligenceSampleLabel } from "./crypto/autoPaper";

const root = resolve(process.cwd());
const autoPaper = readFileSync(resolve(root, "server/crypto/autoPaper.ts"), "utf8");
const lab = readFileSync(resolve(root, "client/src/components/crypto/AutoPaperLab.tsx"), "utf8");
const intelligence = readFileSync(resolve(root, "client/src/components/crypto/AutoPaperIntelligencePanel.tsx"), "utf8");
const schema = readFileSync(resolve(root, "drizzle/schema.ts"), "utf8");

describe("Phase 32 Auto Paper learning intelligence", () => {
  it("uses conservative sample-quality language", () => {
    expect(getAutoPaperIntelligenceSampleLabel(0)).toBe("VERY SMALL SAMPLE");
    expect(getAutoPaperIntelligenceSampleLabel(4)).toBe("VERY SMALL SAMPLE");
    expect(getAutoPaperIntelligenceSampleLabel(5)).toBe("SMALL SAMPLE");
    expect(getAutoPaperIntelligenceSampleLabel(20)).toBe("MODERATE SAMPLE");
    expect(getAutoPaperIntelligenceSampleLabel(50)).toBe("GOOD SAMPLE");
    expect(getAutoPaperIntelligenceSampleLabel(100)).toBe("STRONG SAMPLE");
  });

  it("exposes the required derived intelligence dimensions from existing trial evidence", () => {
    for (const marker of ["intelligence", "strategy", "timeframe", "direction", "regime", "qualification", "setupQuality", "dataQuality", "provider", "targetLadder", "exits", "failures", "rDistribution", "sampleQuality"]) expect(autoPaper).toContain(marker);
    expect(autoPaper).toContain("dataUnavailableCount");
    expect(autoPaper).toContain("averagePnl");
    expect(autoPaper).toContain("totalPnl");
    expect(autoPaper).toContain("TARGET_NOT_REACHED");
  });

  it("keeps absent samples honest instead of rendering fabricated zero-performance claims", () => {
    expect(intelligence).toContain("NO SAMPLE");
    expect(intelligence).toContain("INSUFFICIENT SAMPLE");
    expect(intelligence).toContain("VERY SMALL SAMPLE");
    expect(intelligence).not.toContain("GUARANTEED");
    expect(intelligence).not.toContain('>BUY<');
    expect(intelligence).not.toContain('>SELL<');
  });

  it("keeps Auto Paper Lab read-only on open and preserves explicit simulation boundaries", () => {
    expect(lab).toContain("SIMULATION ONLY");
    expect(lab).toContain("Opening this workspace is read-only");
    expect(lab).toContain("No real orders");
    expect(intelligence).toContain("Read-only analytics");
    expect(intelligence).toContain("does not enable or disable Auto Paper");
    expect(intelligence).toContain("never generates BUY, SELL");
  });

  it("does not add a Phase 32 schema migration", () => {
    expect(schema).not.toContain("phase32");
    expect(schema).not.toContain("autoPaperIntelligence");
  });
});
