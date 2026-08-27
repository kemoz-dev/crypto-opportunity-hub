import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const read = (relativePath: string) => readFileSync(resolve(root, relativePath), "utf8");
const home = read("client/src/pages/Home.tsx");
const feed = read("client/src/components/crypto/OpportunityFeedWorkspace.tsx");
const decision = read("client/src/components/crypto/DecisionCenterWorkspace.tsx");
const asset = read("client/src/components/crypto/AssetIntelligencePanel.tsx");
const pwa = read("client/src/pwa/PwaMobileNavigation.tsx");
const schema = read("drizzle/schema.ts");

const between = (source: string, first: string, second: string) => source.indexOf(first) < source.indexOf(second);

describe("Phase 33 — Command Center and Opportunity Decision UX", () => {
  it("orders the live Command Center around market state, summary, discovery, private evidence, and secondary workspaces", () => {
    expect(between(home, "<RegimeBanner scan={scan} />", "<CommandCenterDiscovery")) .toBe(true);
    expect(between(home, "<CommandCenterDiscovery", "<ControlCenter")) .toBe(true);
    expect(between(home, "<WatchlistSummaryCard", "<AutoPaperSummaryCard")) .toBe(true);
    expect(between(home, "<AutoPaperSummaryCard", "<RecentSimulationIntelligence")) .toBe(true);
    expect(home).toContain("Live decision surface");
    expect(home).toContain("Recent simulation intelligence");
  });

  it("normalizes missing or scalar server timeframes without crashing or fabricating values", () => {
    expect(home).toContain("Array.isArray(serverTop?.timeframes)");
    expect(home).toContain("typeof serverTop?.timeframes === \"string\"");
    expect(home).toContain("Timeframe unavailable");
    expect(home).toContain("topTimeframes.join(\" · \")");
  });

  it("uses existing server discovery summaries and preserves honest top/no-qualified states", () => {
    expect(home).toContain("trpc.crypto.tradeSetups.useQuery({ mode: \"SCALP\" }");
    expect(home).toContain("trpc.crypto.tradeSetups.useQuery({ mode: \"SWING\" }");
    expect(home).toContain("serverTop = summary.qualified > 0");
    expect(home).toContain("Top opportunity");
    expect(home).toContain("Top potential");
    expect(home).toContain("NO QUALIFIED TRADES");
    expect(home).toContain("Missing:");
    expect(home).toContain("Last validated");
    expect(home).toContain("does not recalculate scores or ranking");
  });

  it("keeps plan, regime, data, and decision actions server-evidence-safe", () => {
    expect(home).toContain("sourcePlan?.entryZone?.preferred");
    expect(home).toContain("sourcePlan?.stop?.price");
    expect(home).toContain("sourcePlan?.targets?.[0]?.price");
    expect(home).toContain("sourcePlan?.rewardRisk");
    expect(home).toContain("View Decision");
    expect(home).toContain("View Full Analysis");
    expect(home).toContain("RISK OFF");
    expect(home).toContain("Caution only");
    expect(feed).toContain("PLAN UNAVAILABLE");
    expect(decision).toContain("WHY THIS SETUP?");
    expect(decision).toContain("RISK / WARNINGS");
    expect(decision).toContain("DATA");
    expect(asset).toContain("PLAN");
    expect(asset).toContain("TRADE PLAN UNAVAILABLE");
  });

  it("keeps Watchlist and simulation evidence read-only and owner-scoped", () => {
    expect(home).toContain("trpc.crypto.watchlist.useQuery");
    expect(home).toContain("owner-scoped assets");
    expect(home).toContain("trpc.crypto.autoPaperPerformance.useQuery");
    expect(home).toContain("Read-only observation");
    expect(home).toContain("does not change the current Opportunity Score");
    expect(home).not.toMatch(/createAutoPaper|enableAutoPaper|openPosition|placeOrder|executeOrder/);
    expect(feed).toContain("ADD TO WATCHLIST");
  });

  it("preserves mobile/PWA/auth boundaries and does not add persistence", () => {
    expect(home).toContain("min-h-11");
    expect(pwa).toContain("Home");
    expect(pwa).toContain("Opportunities");
    expect(pwa).toContain("Watchlist");
    expect(pwa).toContain("Auto Paper");
    expect(schema).not.toContain("phase33");
    expect(schema).not.toContain("command_center");
    expect(feed).toContain("enabled: privateEnabled");
    expect(decision).toContain("enabled: privateEnabled");
  });
});
