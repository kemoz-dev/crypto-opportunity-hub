import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Phase 20 trading intelligence contracts", () => {
  it("keeps the server-derived opportunity funnel and Risk Off visibility contract", () => {
    const discovery = source("server/crypto/opportunityDiscovery.ts");
    const workspace = source("client/src/components/crypto/TradingIntelligenceWorkspace.tsx");
    expect(discovery).toContain('"QUALIFIED" | "POTENTIAL" | "WATCH" | "NO TRADE" | "DATA UNAVAILABLE"');
    expect(discovery).toContain("restrictedByRiskOff");
    expect(discovery).toContain('return finalize("POTENTIAL"');
    expect(workspace).toContain("Opportunity funnel");
    expect(workspace).toContain("A Potential item is not silently converted to No Trade because of RISK OFF");
    expect(workspace).toContain("Setup exists, but market regime is unfavorable");
  });

  it("exposes all Phase 20 display-only filters without changing score inputs", () => {
    const workspace = source("client/src/components/crypto/TradingIntelligenceWorkspace.tsx");
    for (const label of ["Status", "Strategy", "Direction", "Regime", "Health", "Timeframe"]) expect(workspace).toContain(`label=\"${label}\"`);
    for (const value of ["QUALIFIED", "POTENTIAL", "WATCH", "NO TRADE", "DATA UNAVAILABLE", "SCALP", "SWING", "LONG", "SHORT", "RISK OFF", "15M", "1H", "4H", "1D"]) expect(workspace).toContain(`\"${value}\"`);
    expect(workspace).toContain("presentation only");
    expect(workspace).toContain("Filters do not recalculate scores or change eligibility.");
    expect(workspace).toContain('trpc.crypto.tradeSetups.useQuery({ mode: "SCALP" }');
    expect(workspace).toContain('trpc.crypto.tradeSetups.useQuery({ mode: "SWING" }');
  });

  it("documents experiment presets A-D without enabling or saving them automatically", () => {
    const lab = source("client/src/components/crypto/AutoPaperLab.tsx");
    for (const preset of ['id: "A"', 'id: "B"', 'id: "C"', 'id: "D"']) expect(lab).toContain(preset);
    expect(lab).toContain("WHAT WILL BE SIMULATED?");
    expect(lab).toContain("WHAT WILL NOT?");
    expect(lab).toContain("Review preset");
    expect(lab).toContain("It has not been saved or enabled.");
    expect(lab).not.toContain("onClick={() => save(preset.settings)}");
  });

  it("uses existing private Auto Paper history for comparisons and journal without creating trials on open", () => {
    const workspace = source("client/src/components/crypto/TradingIntelligenceWorkspace.tsx");
    const autoPaper = source("server/crypto/autoPaper.ts");
    expect(workspace).toContain("trpc.crypto.autoPaperPerformance.useQuery");
    expect(workspace).toContain("trpc.crypto.autoPaperHistory.useQuery");
    for (const title of ["Scalp vs Swing", "Qualified vs Potential", "Long vs Short", "By Market Regime", "Trading Journal"]) expect(workspace).toContain(title);
    expect(workspace).toContain("No trial is created when this workspace opens");
    expect(workspace).not.toContain("createAutoPaperTrial");
    expect(autoPaper).toContain("byStrategy");
    expect(autoPaper).toContain("byDirection");
    expect(autoPaper).toContain("trialQualification");
    expect(autoPaper).toContain("trialRegime");
  });

  it("preserves Auto Paper safety, accounting isolation, and no real order path", () => {
    const workspace = source("client/src/components/crypto/TradingIntelligenceWorkspace.tsx");
    const autoPaper = source("server/crypto/autoPaper.ts");
    const paper = source("server/crypto/paperTrading.ts");
    expect(workspace).toContain("Manual Paper accounting with Auto Paper");
    expect(workspace).toContain("never sends exchange orders");
    expect(autoPaper).toContain('export const AUTO_PAPER_SOURCE = "AUTO_PAPER"');
    expect(autoPaper).toContain("immutableEntrySnapshot");
    expect(paper).toContain("PaperTradeSnapshot");
    expect(paper).toContain("assertQualifiedPaperTradeContext");
    for (const file of [workspace, autoPaper, paper]) {
      expect(file).not.toContain("createOrder");
      expect(file).not.toContain("placeOrder");
      expect(file).not.toContain("api.binance.com/api/v3/order");
    }
  });

  it("keeps Trading Intelligence secondary on the mobile information architecture", () => {
    const mobile = source("client/src/pwa/PwaMobileNavigation.tsx");
    expect(mobile).toContain('target: "trading-intelligence"');
    expect(mobile).toContain('label: "Trading Intelligence"');
    expect(mobile).toContain('aria-label="More workspaces"');
  });

  it("does not add a Phase 20 database migration or scheduled task", () => {
    const todo = source("todo.md");
    const workspace = source("client/src/components/crypto/TradingIntelligenceWorkspace.tsx");
    expect(todo).toContain("no migration");
    expect(workspace).not.toContain("saveAutoPaperSettings");
    expect(workspace).not.toContain("refreshAutoPaperActive");
    expect(workspace).not.toContain("evaluateAutoPaperTrial");
    expect(workspace).not.toContain("useMutation");
  });
});
