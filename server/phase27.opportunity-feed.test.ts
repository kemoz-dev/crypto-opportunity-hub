import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Phase 27 opportunity feed contracts", () => {
  it("combines the existing Scalp and Swing discovery responses", () => {
    const source = read("client/src/components/crypto/OpportunityFeedWorkspace.tsx");
    expect(source).toContain('tradeSetups.useQuery({ mode: "SCALP" }');
    expect(source).toContain('tradeSetups.useQuery({ mode: "SWING" }');
    expect(source).toContain("OpportunityCard");
    expect(source).toContain("SCALP");
    expect(source).toContain("SWING");
  });

  it("keeps ranking server-authoritative and never creates a replacement score", () => {
    const source = read("client/src/components/crypto/OpportunityFeedWorkspace.tsx");
    expect(source).toContain("opportunityScore");
    expect(source).toContain("rank");
    expect(source).toContain("toSorted");
    expect(source).not.toContain("Math.random");
    expect(source).not.toContain("calculateOpportunityScore");
    expect(source).not.toContain("newOpportunityScore");
  });

  it("exposes display-only filters, grouped states, and Risk Off visibility", () => {
    const source = read("client/src/components/crypto/OpportunityFeedWorkspace.tsx");
    for (const label of ["ALL", "QUALIFIED", "POTENTIAL", "WATCH", "NO TRADE", "DATA UNAVAILABLE", "SCALP", "SWING", "LONG", "SHORT", "HEALTHY", "WARNING", "DATA LIMITED", "RISK OFF"]) {
      expect(source).toContain(label);
    }
    for (const label of ["TOP OPPORTUNITIES", "SCALP", "SWING", "WATCH", "DATA LIMITED", "RISK OFF"]) {
      expect(source).toContain(label);
    }
    expect(source).toContain("filter");
    expect(source).toContain("RISK OFF");
  });

  it("renders honest plan and data states and canonical analysis actions", () => {
    const source = read("client/src/components/crypto/OpportunityFeedWorkspace.tsx");
    for (const label of ["entryZone", "stop", "targets", "rewardRisk", "WARNING", "Freshness", "dataQuality", "VIEW FULL ANALYSIS", "PLAN UNAVAILABLE", "Last validated"]) {
      expect(source).toContain(label);
    }
    const card = read("client/src/components/crypto/OpportunityCard.tsx");
    for (const label of ["Entry", "Stop", "R:R", "TP${index + 1}"]) expect(card).toContain(label);
    expect(source).toContain("onInspectAsset");
    expect(source).toContain("autoPaperState");
    expect(source).not.toContain("createTrial");
    expect(source).not.toContain("saveAutoPaperSettings");
  });

  it("keeps private Auto Paper observation owner-scoped and read-only", () => {
    const source = read("client/src/components/crypto/OpportunityFeedWorkspace.tsx");
    expect(source).toContain("useAuth");
    expect(source).toContain("autoPaperEligibilitySummary");
    expect(source).toContain("autoPaperHistory");
    expect(source).toContain("autoPaperPerformance");
    expect(source).toContain("autoPaperEvents");
    for (const field of ["t1Hit", "t2Hit", "t3Hit", "maximumDrawdown", "todayEntries"]) expect(source).toContain(field);
    for (const label of ["LIVE OBSERVATION", "Active Trials", "Today's simulated entries", "Completed trials", "Targets reached", "Stops", "Invalidated", "Data unavailable", "Resumed", "Journal", "Sample Quality"]) {
      expect(source).toContain(label);
    }
    expect(source).toContain("privateEnabled");
    expect(source).not.toContain("useMutation");
    expect(source).not.toContain("mutate(");
  });

  it("integrates the feed into existing lazy workspace navigation", () => {
    const home = read("client/src/pages/Home.tsx");
    expect(home).toContain("LazyOpportunityFeedWorkspace");
    expect(home).toContain("openOpportunityFeedWorkspace");
    expect(home).toContain("opportunity-feed");
    expect(home).toContain("onInspectAsset");
  });

  it("preserves static-shell-only PWA caching and no look-ahead markers", () => {
    const worker = read("client/public/sw.js");
    expect(worker).toContain("isApiRequest");
    expect(worker).toContain("return;");
    const source = read("client/src/components/crypto/OpportunityFeedWorkspace.tsx");
    expect(source).toContain("server-derived");
    expect(source).not.toContain("future candles");
    expect(source).not.toContain("Date.now()")
  });
});
