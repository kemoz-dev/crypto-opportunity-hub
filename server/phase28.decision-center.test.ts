import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("Phase 28 Decision Center contracts", () => {
  const decision = read("client/src/components/crypto/DecisionCenterWorkspace.tsx");
  const home = read("client/src/pages/Home.tsx");
  const mobile = read("client/src/pwa/PwaMobileNavigation.tsx");
  const feed = read("client/src/components/crypto/OpportunityFeedWorkspace.tsx");
  const app = read("client/src/App.tsx");
  const worker = read("client/public/sw.js");

  it("provides the decision surface and server-derived opportunity evidence", () => {
    for (const label of ["DECISION CENTER", "MARKET STATE", "DECISION SUMMARY", "WHY THIS SETUP?", "RISK / WARNINGS", "OPPORTUNITY REVIEW", "VIEW FULL ANALYSIS", "VIEW AUTO PAPER", "Data status", "Last validated"]) expect(decision).toContain(label);
    for (const query of ["tradeSetups.useQuery", "scanner.useQuery", "autoPaperSettings.useQuery", "autoPaperEligibilitySummary.useQuery"]) expect(decision).toContain(query);
    for (const field of ["opportunityScore", "setupReadiness", "readinessPlan", "invalidationExplanation", "freshness", "validationStatus"]) expect(decision).toContain(field);
  });

  it("keeps deterministic ranking and display-only filters", () => {
    for (const filter of ["QUALIFIED", "POTENTIAL", "WATCH", "NO TRADE", "DATA UNAVAILABLE", "SCALP", "SWING", "LONG", "SHORT", "HEALTHY", "WARNING", "RISK OFF"]) expect(decision).toContain(filter);
    expect(decision).toContain("toSorted");
    expect(decision).toContain("Presentation only");
    expect(decision).toContain("opportunityScore");
    for (const forbidden of ["createAutoPaperTrial", "evaluateAndCreateAutoPaperTrial", "placeOrder", "createOrder", "exchange.order"]) expect(decision).not.toContain(forbidden);
  });

  it("preserves URL filters and browser history state", () => {
    for (const marker of ["URLSearchParams", "status", "strategy", "popstate", "pushState", "window.history"]) expect(decision).toContain(marker);
    expect(app).toContain('path="/decision"');
    expect(home).toContain('workspace=decision-center');
  });

  it("uses the existing authenticated, online-only Watchlist contract", () => {
    for (const marker of ["watchlist.useQuery", "addWatchlistAsset.useMutation", "removeWatchlistAsset.useMutation", "isAuthenticated", "online", "ADDED TO WATCHLIST", "REMOVED", "invalidate"]) expect(decision).toContain(marker);
    expect(decision).not.toContain("createAutoPaperTrial");
    expect(decision).not.toContain("evaluateAndCreateAutoPaperTrial");
  });

  it("keeps Auto Paper read-only and private", () => {
    for (const marker of ["autoPaperSettings", "autoPaperEligibilitySummary", "privateEnabled", "Owner authentication is required", "OFF · simulation disabled", "VIEW AUTO PAPER", "never changes scoring, creates trades, or enables Auto Paper"]) expect(decision).toContain(marker);
    for (const marker of ["autoPaperHistory", "autoPaperPerformance", "autoPaperEvents"]) expect(feed).toContain(marker);
  });

  it("keeps canonical asset deep-links and mobile IA boundaries", () => {
    expect(decision).toContain("onInspectAsset");
    expect(app).toContain('path="/asset/:assetId"');
    for (const label of ["Home", "Opportunities", "Watchlist", "Auto Paper", "More", "Decision Center", "Asset Intelligence", "Scalp", "Swing", "Intelligence", "Research", "Settings"]) expect(mobile).toContain(label);
    expect(mobile).toContain("min-h-11");
  });

  it("preserves PWA cache boundaries and no-real-trading semantics", () => {
    expect(worker).toContain("isApiRequest");
    expect(worker).toContain("request.method !== \"GET\"");
    for (const marker of ["BUY", "SELL", "placeOrder", "createOrder", "exchange.order", "ccxt"]) expect(decision).not.toContain(marker);
    expect(app).toContain("PwaStatusProvider");
  });
});
