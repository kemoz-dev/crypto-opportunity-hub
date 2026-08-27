import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const project = resolve(process.cwd());
const source = (path: string) => readFileSync(resolve(project, path), "utf8");

describe("Phase 31 live opportunity reliability contracts", () => {
  it("uses server-derived live opportunity summary counts", () => {
    const feed = source("client/src/components/crypto/OpportunityFeedWorkspace.tsx");
    for (const marker of [
      "type FeedDiscoverySummary",
      "discovery?.summary",
      "const serverSummary = useMemo",
      "LIVE OPPORTUNITY SUMMARY",
      "SERVER DERIVED",
      "SummaryMetric label=\"Opportunities\"",
      "SummaryMetric label=\"Qualified\"",
      "SummaryMetric label=\"Potential\"",
      "SummaryMetric label=\"Watch\"",
      "SummaryMetric label=\"No Trade\"",
      "SummaryMetric label=\"Data Limited\"",
    ]) expect(feed).toContain(marker);
  });

  it("explains zero qualified states and potential missing evidence from server payloads", () => {
    const feed = source("client/src/components/crypto/OpportunityFeedWorkspace.tsx");
    for (const marker of [
      "WHY NO QUALIFIED TRADES?",
      "serverNoQualifiedReasons",
      "topNoTradeReasons",
      "POTENTIAL SETUPS",
      "potentialDiagnostics",
      "missingEvidence",
      "confirmationRequirements",
      "Only server-returned diagnostic reasons are shown",
    ]) expect(feed).toContain(marker);
    expect(feed).toContain("item.status === \"POTENTIAL\"");
  });

  it("keeps data health, Risk Off, and Last Validated evidence explicit", () => {
    const feed = source("client/src/components/crypto/OpportunityFeedWorkspace.tsx");
    const setup = source("client/src/components/crypto/TradeSetupWorkspace.tsx");
    for (const marker of ["Data Status:", "Last validated:", "RISK OFF", "potential and watch setups remain visible", "dataStatusLabel"]) expect(feed).toContain(marker);
    for (const marker of ["DATA HEALTH ·", "Data status", "Coverage", "Technical evidence", "Plan availability", "Last validated", "WHY NO QUALIFIED TRADES?"]) expect(setup).toContain(marker);
  });

  it("shows isolated Scalp timeframe availability without unsupported substitution", () => {
    const scalp = source("client/src/components/crypto/LowTimeframeScalpingWorkspace.tsx");
    for (const marker of ["TIMEFRAME AVAILABILITY", "label=\"1M\"", "label=\"3M\"", "label=\"5M\"", "label=\"15M FAST SCALP\"", "SEPARATE ESTABLISHED VIEW", "eligibleForScalping", "VIEW 15M FAST SCALP"]) expect(scalp).toContain(marker);
    expect(scalp).toContain("No unsupported timeframe is substituted.");
    expect(scalp).not.toMatch(/resample(?:Candle|Series|Timeframe|Data)|mixTimeframe|mergeTimeframe/i);
  });

  it("preserves status-specific safe boundaries and protected-core behavior", () => {
    const feed = source("client/src/components/crypto/OpportunityFeedWorkspace.tsx");
    const scalp = source("client/src/components/crypto/LowTimeframeScalpingWorkspace.tsx");
    const setup = source("client/src/components/crypto/TradeSetupWorkspace.tsx");
    for (const sourceText of [feed, scalp, setup]) {
      expect(sourceText).not.toMatch(/CREATE TABLE|ALTER TABLE|drizzle\/schema/i);
      expect(sourceText).not.toMatch(/(place|execute|submit)(Order|Trade)/i);
    }
    for (const marker of ["No mutation is available offline", "No Paper Trading action is created", "No fallback, fabricated, resampled, stale, or mixed-provider setup is shown.", "server-derived"]) expect(`${feed}\n${scalp}\n${setup}`).toContain(marker);
  });

  it("keeps mobile accessibility and display-only behavior visible", () => {
    const feed = source("client/src/components/crypto/OpportunityFeedWorkspace.tsx");
    const scalp = source("client/src/components/crypto/LowTimeframeScalpingWorkspace.tsx");
    for (const marker of ["aria-label=\"Live Opportunity Summary\"", "aria-label=\"Why no qualified trades\"", "aria-label=\"Potential setup diagnostics\"", "min-h-11", "aria-live=\"polite\""]) expect(feed).toContain(marker);
    for (const marker of ["aria-label=\"Scalp timeframe availability\"", "min-h-11", "Display-only provider state"]) expect(scalp).toContain(marker);
  });
});
