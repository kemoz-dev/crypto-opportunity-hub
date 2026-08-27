import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Phase 23 Auto Paper Control Center contracts", () => {
  it("keeps the Control Center explicit, simulation-only, and owner scoped", () => {
    const lab = source("client/src/components/crypto/AutoPaperLab.tsx");
    const router = source("server/routers/crypto.ts");
    for (const text of ["AUTO PAPER CONTROL CENTER", "AUTO PAPER ACTIVE", "AUTO PAPER OFF", "SIMULATION ONLY", "Account equity", "Available cash", "Active trials", "Completed", "Eligible now", "DATA LIMITED", "PAUSED BY USER"]) expect(lab).toContain(text);
    expect(lab).toContain("No real orders, exchange credentials, or real money.");
    expect(lab).toContain("does not create a trial, snapshot, alert, or schedule");
    expect(router).toContain("autoPaperEligibilitySummary: protectedProcedure");
    expect(router).toContain("autoPaperSettings: protectedProcedure");
  });

  it("renders server-derived live eligibility details without inventing setup levels", () => {
    const autoPaper = source("server/crypto/autoPaper.ts");
    const lab = source("client/src/components/crypto/AutoPaperLab.tsx");
    for (const state of ["ELIGIBLE", "NOT_ELIGIBLE", "DATA_UNAVAILABLE", "REQUIRES_CONFIRMATION", "DUPLICATE"]) expect(autoPaper).toContain(state);
    for (const field of ["primaryReason", "additionalReasons", "dataBlock", "strategyBlock", "setupReadiness", "entryZone", "stop", "targets", "rewardRisk", "regime", "health", "provider", "freshness", "dataQuality", "dataValid", "setupValid", "qualificationCounts", "regimeCounts", "funnel"]) expect(autoPaper).toContain(field);
    for (const text of ["LIVE ELIGIBILITY", "Primary reason", "Additional reasons", "DATA BLOCK", "STRATEGY BLOCK", "Entry zone", "Stop", "TP1", "R:R", "Provider", "Freshness", "Quality", "Qualified", "Potential", "No Trade", "Risk Off", "FUNNEL · SERVER DERIVED", "ALL DISCOVERED", "DATA VALID", "SETUP VALID", "AUTO PAPER ACCEPTED"]) expect(lab).toContain(text);
    expect(lab).toContain("OWNER AUTHENTICATION REQUIRED");
    expect(lab).toContain("No server-returned eligibility rows are available");
  });

  it("preserves required mode and strategy separation", () => {
    const lab = source("client/src/components/crypto/AutoPaperLab.tsx");
    const autoPaper = source("server/crypto/autoPaper.ts");
    for (const text of ["15M FAST SCALP", "SWING", "SCALP ONLY", "SWING ONLY", "Target path", "Original plan · immutable", "Current plan · server observation"]) expect(lab).toContain(text);
    expect(autoPaper).toContain('const requestedModes = settings.strategies.includes("SWING")');
    expect(autoPaper).toContain("plan.timeframes.execution");
  });

  it("keeps event timeline filters and data-unavailable resume semantics visible", () => {
    const lab = source("client/src/components/crypto/AutoPaperLab.tsx");
    const autoPaper = source("server/crypto/autoPaper.ts");
    for (const event of ["SETUP_DETECTED", "ENTRY_SIMULATED", "HEALTH_CHANGED", "TARGET_1_REACHED", "TARGET_2_REACHED", "TARGET_3_REACHED", "STOP_LOSS", "INVALIDATED", "DATA_UNAVAILABLE", "RESUMED", "COMPLETED"]) {
      expect(lab).toContain(event);
      expect(autoPaper).toContain(event);
    }
    expect(lab).toContain("EVENT TIMELINE");
    expect(lab).toContain("Last validated");
    expect(lab).toContain("aria-label=\"Event filters\"");
    expect(lab).toContain("Monitoring remains open");
    expect(autoPaper).toContain("recordEventIfAbsent");
    expect(autoPaper).toContain("RESUMED");
  });

  it("keeps journal and Auto Paper evidence read-only while preserving Manual Paper separation", () => {
    const lab = source("client/src/components/crypto/AutoPaperLab.tsx");
    const autoPaper = source("server/crypto/autoPaper.ts");
    const card = source("client/src/components/crypto/OpportunityCard.tsx");
    for (const text of ["JOURNAL · COMPLETED TRIALS", "Exit", "R", "P/L", "Result", "Qualification", "Regime", "Read-only history"]) expect(lab).toContain(text);
    for (const text of ["autoPaperAccounts", "autoPaperEquitySnapshots", "realizedPnl", "unrealizedPnl", "availableCash"]) expect(autoPaper).toContain(text);
    expect(lab).toContain("Manual Paper");
    expect(card).toContain("autoPaperState");
    expect(card).toContain("AUTO PAPER");
    expect(lab).not.toContain("createAutoPaperTrial");
    expect(lab).not.toContain("placeOrder");
    expect(autoPaper).not.toContain("api.binance.com/api/v3/order");
  });

  it("does not add schema or schedule behavior for the presentation release", () => {
    const lab = source("client/src/components/crypto/AutoPaperLab.tsx");
    const handler = source("server/crypto/autoPaperHandler.ts");
    const todo = source("todo.md");
    expect(todo.toLowerCase()).toContain("no migration");
    expect(handler).toContain("authenticateRequest");
    expect(handler).toContain("user.isCron");
    expect(lab).toContain("schedule");
    expect(lab).not.toContain("createSchedule");
    expect(lab).not.toContain("cron.schedule");
  });
});
