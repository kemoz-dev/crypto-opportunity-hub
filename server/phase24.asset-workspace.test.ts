import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { clampWindow } from "../client/src/components/crypto/InteractiveCandlestickChart";

const source = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Phase 24 asset trade investigation workspace contracts", () => {
  it("keeps the asset detail full-screen and evidence-first", () => {
    const asset = source("client/src/components/crypto/AssetIntelligencePanel.tsx");
    for (const label of ["Asset Detail Workspace", "Opportunity Score", "Provenance", "Trade Plan", "Original plan", "Current state", "Simulation only"]) {
      expect(asset).toContain(label);
    }
    expect(asset).toContain("aria-label=\"Asset trade investigation summary\"");
    expect(asset).toContain("readinessPlan");
    expect(asset).toContain("UNAVAILABLE");
  });

  it("uses the validated chart and only valid server-derived plan overlays", () => {
    const asset = source("client/src/components/crypto/AssetIntelligencePanel.tsx");
    const chart = source("client/src/components/crypto/InteractiveCandlestickChart.tsx");
    expect(asset).toContain("chartOverlay");
    expect(asset).toContain("overlay={chartOverlay}");
    expect(asset).toContain("!plan.entryZone");
    expect(asset).toContain("!plan.invalidation");
    expect(asset).toContain("!plan.targets.length");
    for (const interaction of ["onWheel", "onPointerMove", "onPointerDown", "onPointerUp", "VOLUME", 'label: "ENTRY"', 'label: "SL"']) {
      expect(chart).toContain(interaction);
    }
    expect(chart).not.toContain("TradingView");
    expect(chart).not.toMatch(/(create|place|execute)(Order|Trade)/i);
  });

  it("keeps Auto Paper evidence owner-scoped and read-only on investigation open", () => {
    const asset = source("client/src/components/crypto/AssetIntelligencePanel.tsx");
    expect(asset).toContain("useAuth");
    expect(asset).toContain("trpc.crypto.autoPaperActive.useQuery");
    expect(asset).toContain("trpc.crypto.autoPaperEvents.useQuery");
    expect(asset).toContain("auth.isAuthenticated");
    expect(asset).toContain("enabled: Boolean(activeTrial)");
    expect(asset).toContain("OWNER-ONLY");
    expect(asset).toContain("NO ACTIVE TRIAL");
    expect(asset).toContain("does not create a trial");
    expect(asset).toContain("not look-ahead results");
  });

  it("preserves original-versus-current and lifecycle provenance language", () => {
    const asset = source("client/src/components/crypto/AssetIntelligencePanel.tsx");
    for (const label of ["immutable snapshot", "server re-evaluation", "Chronological event timeline", "server events", "Provider / freshness", "Data quality", "R:R"]) {
      expect(asset).toContain(label);
    }
    expect(asset).toContain("currentSnapshot");
    expect(asset).toContain("provenance");
    expect(asset).toContain("freshness");
    expect(asset).toContain("No exchange, broker, or real-order endpoint is connected");
  });

  it("keeps chart navigation bounded to the validated candle window", () => {
    expect(clampWindow(-10, 200, 120)).toEqual([0, 120]);
    expect(clampWindow(0, 4, 120)).toEqual([0, 18]);
    expect(clampWindow(95, 120, 120)).toEqual([95, 120]);
  });
});
