import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const card = readFileSync(resolve(root, "client/src/components/crypto/OpportunityCard.tsx"), "utf8");
const feed = readFileSync(resolve(root, "client/src/components/crypto/OpportunityFeedWorkspace.tsx"), "utf8");
const decision = readFileSync(resolve(root, "client/src/components/crypto/DecisionCenterWorkspace.tsx"), "utf8");
const discovery = readFileSync(resolve(root, "server/crypto/opportunityDiscovery.ts"), "utf8");


describe("Phase 34 opportunity quality and decision contracts", () => {
  it("keeps quality independent from the primary score and server-derived", () => {
    expect(discovery).toContain("opportunityQuality");
    expect(discovery).toContain("does not replace the Opportunity Score");
    expect(feed).toContain("item.opportunityQuality ?? item.adaptive?.quality ?? null");
    expect(decision).toContain("item.opportunityQuality ?? item.adaptive?.quality ?? null");
  });

  it("uses explicit safe state language", () => {
    expect(card).toContain("POTENTIAL — REVIEW REQUIRED");
    expect(card).toContain("WATCH — MONITOR EVIDENCE");
    expect(card).toContain("NO TRADE — DIAGNOSTIC STATE");
    expect(card).toContain("DATA LIMITED — PLAN NOT VALIDATED");
    expect(feed).toContain("POTENTIAL — REVIEW REQUIRED");
    expect(card).toContain("Quality");
  });

  it("keeps plan numbers conditional and exposes simulation evidence read-only", () => {
    expect(card).toContain("PLAN UNAVAILABLE");
    expect(card).toContain("SIMULATION EVIDENCE");
    expect(feed).toContain("NO MATCHING SAMPLE");
    expect(decision).toContain("NO MATCHING SAMPLE");
    expect(feed).toContain("Auto Paper");
    expect(decision).toContain("Auto Paper");
    expect(card).not.toContain("createTrial");
    expect(card).not.toContain("placeOrder");
  });

  it("preserves display-only filters and protected action boundaries", () => {
    expect(feed).toContain("Filters are display-only");
    expect(feed).toContain("history.pushState");
    expect(decision).toContain("display filters do not re-score");
    expect(decision).not.toContain("createTrial");
    expect(decision).not.toContain("placeOrder");
  });
});
