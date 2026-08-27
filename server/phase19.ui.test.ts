import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { clampWindow } from "../client/src/components/crypto/InteractiveCandlestickChart";

const source = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Phase 19 terminal UI contracts", () => {
  it("exposes the seven primary mobile workspaces", () => {
    const mobile = source("client/src/pwa/PwaMobileNavigation.tsx");
    for (const label of ["Home", "Markets", "Opportunities", "Scalp", "Swing", "Monitor", "Paper"]) {
      expect(mobile).toContain(`label: \"${label}\"`);
    }
    expect(mobile).toContain('aria-label="Mobile workspace navigation"');
    expect(mobile).toContain("min-h-14");
    expect(source("client/src/contexts/ThemeContext.tsx")).toContain('ThemeMode = Theme | "system"');
    expect(mobile).toContain('setTheme("system")');
  });

  it("keeps chart navigation bounded to validated candles", () => {
    expect(clampWindow(-10, 200, 120)).toEqual([0, 120]);
    expect(clampWindow(0, 4, 120)).toEqual([0, 18]);
    expect(clampWindow(95, 120, 120)).toEqual([95, 120]);
  });

  it("declares interactive chart behavior and server-plan overlays", () => {
    const chart = source("client/src/components/crypto/InteractiveCandlestickChart.tsx");
    expect(chart).toContain("onWheel");
    expect(chart).toContain("onPointerMove");
    expect(chart).toContain("onPointerDown");
    expect(chart).toContain("onPointerUp");
    expect(chart).toContain('label: "ENTRY"');
    expect(chart).toContain('label: "SL"');
    expect(chart).toContain("targets");
    expect(chart).toContain("VOLUME");
    expect(chart).not.toContain("TradingView");
    expect(chart).not.toContain("createOrder");
  });

  it("standardizes the card evidence hierarchy without inventing values", () => {
    const card = source("client/src/components/crypto/OpportunityCard.tsx");
    for (const label of ["WHY", "RISK", "WARNING", "DATA"]) expect(card).toContain(`label=\"${label}\"`);
    expect(card).toContain("No additional warning returned by the server.");
    expect(card).toContain("Required validated source data is unavailable.");
    expect(card).toContain("No valid level");
  });

  it("uses the interactive chart in the asset detail workspace with server-derived plan data", () => {
    const asset = source("client/src/components/crypto/AssetIntelligencePanel.tsx");
    expect(asset).toContain("InteractiveCandlestickChart");
    expect(asset).toContain("chartOverlay");
    expect(asset).toContain("readinessPlan");
    expect(asset).toContain("Asset Detail Workspace");
  });
});
