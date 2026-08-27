import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Phase 25 trade investigation polish contracts", () => {
  it("supports a canonical read-only asset deep link without a new data route", () => {
    const app = source("client/src/App.tsx");
    const home = source("client/src/pages/Home.tsx");
    expect(app).toContain("path=\"/asset/:assetId\"");
    expect(home).toContain("/^\\/asset\\/([^/]+)$/");
    expect(home).toContain("window.history.replaceState(null, \"\", `/asset/${encodeURIComponent(assetId)}`)");
    expect(home).toContain("function initialAssetWorkspaceOpen");
    expect(home).toContain("function identityFallbackRow");
    expect(home).toContain("price: null");
    expect(home).toContain("provider: \"UNAVAILABLE\"");
  });

  it("keeps the investigation hierarchy summary-first and responsive", () => {
    const asset = source("client/src/components/crypto/AssetIntelligencePanel.tsx");
    for (const label of ["Summary · Opportunity Score", "Chart · validated market view", "Trade Plan · server-derived only", "WHY", "RISK", "DATA", "PROVENANCE", "LIFECYCLE · AUTO PAPER", "Performance"]) expect(asset).toContain(label);
    expect(asset).toContain("function ResponsiveDisclosure");
    expect(asset).toContain("defaultOpen = false");
    expect(asset).toContain("min-h-11");
    expect(asset).toContain("h-[calc(100dvh-80px)]");
  });

  it("keeps the chart compact, mobile-safe, and truthful about available levels", () => {
    const chart = source("client/src/components/crypto/InteractiveCandlestickChart.tsx");
    for (const label of ["PRICE / CANDLES", "ENTRY ZONE", "STOP LOSS", "EMA20", "EMA50", "EMA200", "VOLUME", 'label: "ENTRY"', 'label: "SL"']) expect(chart).toContain(label);
    for (const label of ["TP1", "TP2", "TP3", "direction", "entryZone"]) expect(chart).toContain(label);
    expect(chart).toContain("overflow-hidden");
    expect(chart).toContain("h-auto w-full select-none touch-none");
    expect(chart).not.toContain("TradingView");
    expect(chart).not.toMatch(/(create|place|execute)(Order|Trade)/i);
  });

  it("keeps Original and Current plan provenance separated", () => {
    const asset = source("client/src/components/crypto/AssetIntelligencePanel.tsx");
    expect(asset).toContain("ORIGINAL PLAN · IMMUTABLE SNAPSHOT");
    expect(asset).toContain("CURRENT STATE · SERVER RE-EVALUATION");
    expect(asset).toContain("sourcePlan");
    expect(asset).toContain("readinessPlan");
    expect(asset).toContain("Original values are read from the server-returned setup snapshot");
    expect(asset).toContain("Current values are server-returned lifecycle evidence");
    expect(asset).toContain("UNAVAILABLE");
  });

  it("keeps Auto Paper private, read-only, and attached only to existing owner data", () => {
    const asset = source("client/src/components/crypto/AssetIntelligencePanel.tsx");
    for (const query of ["autoPaperSettings.useQuery", "autoPaperEligibilitySummary.useQuery", "autoPaperPerformance.useQuery", "autoPaperActive.useQuery", "autoPaperEvents.useQuery"]) expect(asset).toContain(query);
    for (const guard of ["auth.isAuthenticated", "enabled: Boolean(activeTrial)", "OWNER-ONLY", "NO ACTIVE TRIAL", "does not create a trial", "No exchange, broker, or real-order endpoint is connected"]) expect(asset).toContain(guard);
    expect(asset).not.toMatch(/(create|save|mutate|refreshAutoPaper)(AutoPaper|Trial)/i);
  });

  it("exposes lifecycle event filters without fabricating event rows", () => {
    const asset = source("client/src/components/crypto/AssetIntelligencePanel.tsx");
    for (const filter of ["ALL", "SETUP", "ENTRY", "HEALTH", "TARGET", "STOP LOSS", "INVALIDATION", "DATA UNAVAILABLE", "RESUMED", "COMPLETED"]) expect(asset).toContain(filter);
    expect(asset).toContain("filteredEvents");
    expect(asset).toContain("SERVER EVENTS");
    expect(asset).toContain("No event rows are currently returned");
  });

  it("uses the existing performance contract and honest sample labels", () => {
    const asset = source("client/src/components/crypto/AssetIntelligencePanel.tsx");
    for (const field of ["netPnl", "averageR", "wins", "losses", "maximumDrawdown", "t1Hit", "t2Hit", "t3Hit", "completed", "currentEquity", "returnPercent", "sampleLabel"]) expect(asset).toContain(field);
    for (const label of ["P&L", "Average R", "Win / Loss", "Drawdown", "Target completion", "Completed trials", "SAMPLE:", "NO COMPLETED TRIALS", "No performance claim is a guarantee"]) expect(asset).toContain(label);
  });

  it("preserves data-quality, PWA, and real-trading boundaries", () => {
    const asset = source("client/src/components/crypto/AssetIntelligencePanel.tsx");
    const chart = source("client/src/components/crypto/InteractiveCandlestickChart.tsx");
    expect(asset).toContain("online && auth.isAuthenticated");
    expect(asset).toContain("Simulation only");
    expect(asset).toContain("server-derived");
    expect(asset).toContain("UNAVAILABLE");
    expect(chart).not.toMatch(/(create|place|execute)(Order|Trade)/i);
  });
});
