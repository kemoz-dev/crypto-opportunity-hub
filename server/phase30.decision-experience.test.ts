import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const project = resolve(process.cwd());
const source = (path: string) => readFileSync(resolve(project, path), "utf8");

describe("Phase 30 trading decision experience contracts", () => {
  it("uses the existing asset workspace as the Opportunity Workspace", () => {
    const asset = source("client/src/components/crypto/AssetIntelligencePanel.tsx");
    for (const marker of [
      "OPPORTUNITY WORKSPACE · decision experience",
      "Decision status, plan, risk, data, and technical evidence",
      "Asset trade investigation summary",
      "BACK TO OPPORTUNITIES",
      "SummaryMetric label=\"Direction\"",
      "SummaryMetric label=\"Strategy / TF\"",
    ]) expect(asset).toContain(marker);
  });

  it("keeps status-specific and plan-unavailable presentation honest", () => {
    const asset = source("client/src/components/crypto/AssetIntelligencePanel.tsx");
    const card = source("client/src/components/crypto/OpportunityCard.tsx");
    for (const status of ["QUALIFIED", "POTENTIAL", "WATCH", "NO TRADE", "DATA UNAVAILABLE", "TRADE PLAN UNAVAILABLE"]) expect(asset).toContain(status);
    expect(card).toContain("No valid level is returned by the server.");
    expect(asset).toContain("Potential and Watch remain monitoring states");
    expect(asset).toContain("not a trade instruction");
    expect(asset).toContain("Entry zone, targets, and invalidation remain unavailable");
  });

  it("keeps server-derived plan levels and chart overlays gated", () => {
    const asset = source("client/src/components/crypto/AssetIntelligencePanel.tsx");
    const chart = source("client/src/components/crypto/InteractiveCandlestickChart.tsx");
    for (const field of ["entryZone", "invalidation", "targets", "rewardRisk", "sourcePlan", "readinessPlan"]) expect(asset).toContain(field);
    for (const label of ["ENTRY", "SL", "TP1", "TP2", "TP3", "ENTRY ZONE"]) expect(chart).toContain(label);
    expect(asset).toContain("if (!plan || plan.availability === \"UNAVAILABLE\"");
    expect(chart).toContain("No validated current candle window is available");
    expect(chart).toContain("Scroll to zoom · drag to pan");
    expect(chart).toContain("min-h-11");
  });

  it("presents risk, warning, technical, data, freshness, and provenance evidence", () => {
    const asset = source("client/src/components/crypto/AssetIntelligencePanel.tsx");
    for (const marker of ["RISK · HEALTH & PLAN", "RISK · MARKET CONTEXT", "RISK OFF", "WHY · SCORE EVIDENCE", "TECHNICAL · INDICATORS", "DATA · PROVIDER & QUALITY", "Freshness", "Data quality", "PROVENANCE · SOURCE EVIDENCE", "Last validated"]) expect(asset).toContain(marker);
    expect(asset).toContain("no verified catalyst, fact, signal, or rumor source is persisted");
    expect(asset).toContain("UNAVAILABLE is not bearish");
  });

  it("keeps Auto Paper evidence owner-scoped and read-only", () => {
    const asset = source("client/src/components/crypto/AssetIntelligencePanel.tsx");
    for (const marker of ["OWNER-ONLY", "NO ACTIVE TRIAL", "does not create a trial", "Simulation only", "No exchange, broker, or real-order endpoint is connected", "autoPaperSettings.useQuery", "autoPaperEligibilitySummary.useQuery", "autoPaperPerformance.useQuery"]) expect(asset).toContain(marker);
    expect(asset).not.toMatch(/(create|save|mutate|refreshAutoPaper)(AutoPaper|Trial)/i);
  });

  it("preserves navigation context from Feed through Decision to Asset", () => {
    const home = source("client/src/pages/Home.tsx");
    const decision = source("client/src/components/crypto/DecisionCenterWorkspace.tsx");
    const feed = source("client/src/components/crypto/OpportunityFeedWorkspace.tsx");
    expect(home).toContain("onInspectAsset={(assetId, returnTo) => openAssetWorkspace(assetId, returnTo)}");
    expect(home).toContain("nextUrl.searchParams.set(\"returnTo\", context)");
    expect(decision).toContain("onInspectAsset: (assetId: string, returnTo?: string) => void");
    expect(decision).toContain("const returnContext");
    expect(feed).toContain("VIEW DECISION");
    expect(feed).toContain("VIEW FULL ANALYSIS");
    expect(feed).toContain("QUICK VIEW");
    expect(feed).toContain("OPEN FULL ANALYSIS");
  });

  it("provides mobile Quick View, disclosures, and accessible controls", () => {
    const feed = source("client/src/components/crypto/OpportunityFeedWorkspace.tsx");
    const asset = source("client/src/components/crypto/AssetIntelligencePanel.tsx");
    for (const marker of ["Sheet open={quickViewItem !== null}", "w-full overflow-y-auto", "VIEW DECISION", "OPEN FULL ANALYSIS", "aria-live=\"polite\""]) expect(feed).toContain(marker);
    expect(asset).toContain("function ResponsiveDisclosure");
    expect(asset).toContain("defaultOpen = false");
    expect(asset).toContain("min-h-11");
    expect(asset).toContain("overflow-x-hidden");
  });

  it("does not add schema, persistence, provider, scheduler, or real-order behavior", () => {
    const feed = source("client/src/components/crypto/OpportunityFeedWorkspace.tsx");
    const asset = source("client/src/components/crypto/AssetIntelligencePanel.tsx");
    expect(feed).not.toMatch(/drizzle\/schema|CREATE TABLE|ALTER TABLE/i);
    expect(feed).not.toMatch(/(place|execute|submit)(Order|Trade)/i);
    expect(asset).not.toMatch(/(place|execute|submit)(Order|Trade)/i);
    expect(feed).toContain("No mutation is available offline");
    expect(asset).toContain("online && auth.isAuthenticated");
  });
});
