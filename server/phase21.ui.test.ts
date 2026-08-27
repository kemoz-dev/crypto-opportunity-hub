import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Phase 21 trading intelligence analytics contracts", () => {
  it("shows a server-derived top summary and complete funnel stages", () => {
    const workspace = source("client/src/components/crypto/TradingIntelligenceWorkspace.tsx");
    for (const label of ["Total assets", "Candidates", "Qualified", "Potential", "Watch", "No trade", "Data unavailable", "ALL ASSETS / EVALUATIONS", "CANDIDATES", "AUTO PAPER ELIGIBLE · OBSERVED", "ACTIVE TRIALS", "COMPLETED TRIALS"]) expect(workspace).toContain(label);
    for (const label of ["Candidate → Potential", "Potential → Qualified", "Qualified → Auto Paper", "Auto Paper → Completed"]) expect(workspace).toContain(label);
    expect(workspace).toContain("INSUFFICIENT DATA");
  });

  it("keeps Risk Off Potential visible and explains server rejection evidence", () => {
    const discovery = source("server/crypto/opportunityDiscovery.ts");
    const workspace = source("client/src/components/crypto/TradingIntelligenceWorkspace.tsx");
    expect(discovery).toContain("restrictedByRiskOff");
    expect(workspace).toContain("Potential and Watch setups remain visible below with a regime warning");
    expect(workspace).toContain("Top server rejection reasons");
    expect(workspace).toContain("No server rejection evidence is available");
  });

  it("renders distinct strategy, timeframe, status, direction, regime, and sector analytics", () => {
    const workspace = source("client/src/components/crypto/TradingIntelligenceWorkspace.tsx");
    for (const title of ["Strategy · Scalp vs Swing", "Timeframe · 15M / 1H / 4H / 1D", "Status · Qualified vs Potential vs Watch", "Direction · Long vs Short", "Regime · Risk On / Neutral / Risk Off", "Sector comparison", "Historical coverage"]) expect(workspace).toContain(title);
    expect(workspace).toContain("15M FAST SCALP");
    expect(workspace).toContain("NO HISTORICAL SECTOR SAMPLE");
    expect(workspace).toContain("SECTOR DATA UNAVAILABLE");
  });

  it("uses sample badges and non-promotional empty states instead of fabricated metrics", () => {
    const workspace = source("client/src/components/crypto/TradingIntelligenceWorkspace.tsx");
    for (const badge of ["NO DATA", "VERY SMALL", "SMALL", "DEVELOPING", "MEANINGFUL", "Sample badge"]) expect(workspace).toContain(badge);
    for (const emptyState of ["NOT STARTED", "NO DATA", "INSUFFICIENT DATA", "No persisted Auto Paper observations"]) expect(workspace).toContain(emptyState);
    for (const forbidden of ["BEST", "WINNER", "PROVEN", "Guaranteed", "Certain profit"]) expect(workspace).not.toContain(forbidden);
  });

  it("keeps Auto Paper preset comparison read-only and separate from Manual Paper", () => {
    const workspace = source("client/src/components/crypto/TradingIntelligenceWorkspace.tsx");
    const autoPaper = source("server/crypto/autoPaper.ts");
    for (const preset of ['id: "A"', 'id: "B"', 'id: "C"', 'id: "D"', "QUALIFIED ONLY", "QUALIFIED + POTENTIAL", "15M FAST SCALP", "SWING"]) expect(workspace).toContain(preset);
    expect(workspace).toContain("observed Auto Paper evidence");
    expect(workspace).toContain("no screen open creates a trial or snapshot");
    expect(workspace).toContain("never mixes Manual Paper accounting with Auto Paper");
    expect(autoPaper).toContain('export const AUTO_PAPER_SOURCE = "AUTO_PAPER"');
    expect(autoPaper).toContain("immutableEntrySnapshot");
    expect(workspace).not.toContain("createAutoPaperTrial");
    expect(workspace).not.toContain("useMutation");
  });

  it("provides authenticated read-only journal and funnel exports with provenance fields", () => {
    const workspace = source("client/src/components/crypto/TradingIntelligenceWorkspace.tsx");
    for (const label of ["Export CSV", "Export JSON", "Export Funnel CSV", "aria-label=\"Export journal CSV\"", "aria-label=\"Export funnel CSV\""]) expect(workspace).toContain(label);
    for (const field of ["Trial ID", "Entry", "Stop", "TP1", "TP2", "TP3", "Exit", "Result", "Health", "Regime", "Freshness", "Data Quality", "Provenance", "accountContext", "dataProvenance", "rejectionReasons"]) expect(workspace).toContain(field);
    expect(workspace).toContain("privateEnabled");
    expect(workspace).toContain("OWNER AUTHENTICATION REQUIRED");
    expect(source("server/crypto/autoPaper.ts")).toContain("secretsIncluded");
  });

  it("supports read-only journal filters and asset-detail integration", () => {
    const workspace = source("client/src/components/crypto/TradingIntelligenceWorkspace.tsx");
    for (const label of ["Strategy", "Timeframe", "Status", "Direction", "Regime", "Result"]) expect(workspace).toContain(`label=\"${label}\"`);
    expect(workspace).toContain("Open Asset Detail Workspace");
    expect(workspace).toContain("onInspectAsset");
    expect(workspace).toContain("Journal");
  });

  it("does not add a migration, schedule, provider, scoring, or trading path", () => {
    const todo = source("todo.md");
    const workspace = source("client/src/components/crypto/TradingIntelligenceWorkspace.tsx");
    expect(todo).toContain("no database migration");
    expect(workspace).not.toContain("saveAutoPaperSettings");
    expect(workspace).not.toContain("refreshAutoPaperActive");
    expect(workspace).not.toContain("evaluateAutoPaperTrial");
    expect(workspace).not.toContain("api.binance.com/api/v3/order");
    expect(workspace).not.toContain("placeOrder");
  });
});
