import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Phase 29 Opportunity Feed 2.0 contracts", () => {
  it("exposes a canonical Feed route and URL-persisted display filters", () => {
    const app = read("client/src/App.tsx");
    const home = read("client/src/pages/Home.tsx");
    const feed = read("client/src/components/crypto/OpportunityFeedWorkspace.tsx");
    expect(app).toContain('path="/opportunities"');
    expect(home).toContain('window.location.pathname === "/opportunities"');
    for (const marker of ["readFeedFilters", "feedFiltersUrl", "pushState", "popstate", "status", "strategy", "direction", "health", "regime"]) expect(feed).toContain(marker);
  });

  it("keeps server-derived default ranking and handles honest filtered empty states", () => {
    const feed = read("client/src/components/crypto/OpportunityFeedWorkspace.tsx");
    expect(feed).toContain("opportunityScore");
    expect(feed).toContain("toSorted");
    expect(feed).toContain("NO MATCHING OPPORTUNITIES");
    expect(feed).toContain("CLEAR FILTERS");
    expect(feed).toContain("Market State:");
    expect(feed).toContain("Data Status:");
    expect(feed).not.toContain("calculateOpportunityScore");
    expect(feed).not.toContain("Math.random");
  });

  it("provides mobile-first filter-sheet controls with accessible touch targets", () => {
    const feed = read("client/src/components/crypto/OpportunityFeedWorkspace.tsx");
    for (const marker of ["Sheet", "SheetContent", "Apply updates the URL", "RESET", "CLOSE", "APPLY", "aria-pressed", "min-h-11", "Status", "Strategy", "Direction", "Health", "Market regime", "WATCHLIST ONLY"]) expect(feed).toContain(marker);
    expect(feed).toContain("lg:hidden");
    expect(feed).toContain("lg:flex");
  });

  it("keeps plan fields honest and surfaces both decision and full-analysis bridges", () => {
    const card = read("client/src/components/crypto/OpportunityCard.tsx");
    const feed = read("client/src/components/crypto/OpportunityFeedWorkspace.tsx");
    expect(card).toContain("PLAN UNAVAILABLE");
    expect(card).toContain("hasPlanEvidence");
    expect(card).toContain("No valid level");
    expect(card).toContain("TP1/TP2/TP3");
    expect(feed).toContain("VIEW DECISION");
    expect(feed).toContain("VIEW FULL ANALYSIS");
    expect(feed).toContain("returnTo");
    expect(read("client/src/pages/Home.tsx")).toContain("safeReturn");
  });

  it("keeps Watchlist authenticated, online-only, owner-scoped, and presentation-only", () => {
    const feed = read("client/src/components/crypto/OpportunityFeedWorkspace.tsx");
    for (const marker of ["watchlist.useQuery", "addWatchlistAsset", "removeWatchlistAsset", "isAuthenticated", "online", "WATCHLIST ONLY", "ADD TO WATCHLIST", "IN WATCHLIST"]) expect(feed).toContain(marker);
    expect(feed).not.toContain("createTrial");
    expect(feed).not.toContain("saveAutoPaperSettings");
    expect(feed).not.toContain("createPaperTrade");
    expect(feed).not.toContain("real trading");
  });

  it("preserves the static-shell-only PWA boundary and no scheduled behavior changes", () => {
    const worker = read("client/public/sw.js");
    const feed = read("client/src/components/crypto/OpportunityFeedWorkspace.tsx");
    expect(worker).toContain("isApiRequest");
    expect(worker).toContain("return;");
    expect(feed).not.toContain("setInterval");
    expect(feed).not.toContain("setTimeout");
    expect(feed).toContain("read only");
  });
});
