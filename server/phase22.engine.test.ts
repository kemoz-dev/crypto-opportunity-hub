import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Phase 22 Auto Paper live simulation contracts", () => {
  it("keeps Auto Paper explicit, OFF by default, and confirmation-gated", () => {
    const lab = source("client/src/components/crypto/AutoPaperLab.tsx");
    const autoPaper = source("server/crypto/autoPaper.ts");
    for (const text of ["enabled: false", "AUTO PAPER SIMULATION", "This will automatically simulate eligible setups", "No real orders will be sent", "Enable Auto Paper", "Cancel", "onCheckedChange={requestEnabled}"]) expect(lab).toContain(text);
    expect(autoPaper).toContain("if (!settings.enabled) throw new Error(\"Auto Paper is disabled for this user.\")");
    expect(lab).toContain("No Trial is created while Auto Paper is OFF");
  });

  it("uses protected server-derived eligibility states and does not create trials while checking", () => {
    const autoPaper = source("server/crypto/autoPaper.ts");
    const router = source("server/routers/crypto.ts");
    const intelligence = source("client/src/components/crypto/TradingIntelligenceWorkspace.tsx");
    for (const state of ["ELIGIBLE", "NOT_ELIGIBLE", "DATA_UNAVAILABLE", "REQUIRES_CONFIRMATION", "DUPLICATE"]) expect(autoPaper).toContain(state);
    expect(autoPaper).toContain("export async function getAutoPaperEligibilitySummary");
    expect(autoPaper).toContain("eligibleCount: counts.ELIGIBLE + counts.REQUIRES_CONFIRMATION");
    expect(router).toContain("autoPaperEligibilitySummary: protectedProcedure");
    expect(intelligence).toContain("autoPaperEligibilitySummary.useQuery");
    expect(intelligence).not.toContain("createAutoPaperTrial");
  });

  it("preserves the existing mode and strategy boundaries", () => {
    const autoPaper = source("server/crypto/autoPaper.ts");
    const lab = source("client/src/components/crypto/AutoPaperLab.tsx");
    for (const text of ["QUALIFIED ONLY", "QUALIFIED + POTENTIAL", "SCALP ONLY", "SWING ONLY", "15M Fast Scalp lens", "1H / 4H / 1D"]) expect(lab).toContain(text);
    expect(autoPaper).toContain('strategies: z.array(z.enum(["SCALP", "SWING", "15M FAST SCALP"]))');
    expect(autoPaper).toContain('const requestedModes = settings.strategies.includes("SWING")');
  });

  it("preserves server-side entry, sizing, max positions, cash, and duplicate protection", () => {
    const autoPaper = source("server/crypto/autoPaper.ts");
    for (const text of ["const entry = plan.entryZone.preferred", "positionSize(entry, stop, account.currentEquity, settings.riskPercent)", "reservedCapital > account.availableCash", "existing.status", "setupIdentity", "maximum number of simultaneous Auto Paper positions"]) expect(autoPaper).toContain(text);
    expect(autoPaper).not.toContain("window.localStorage");
    expect(autoPaper).not.toContain("api.binance.com/api/v3/order");
  });

  it("keeps lifecycle monitoring data-safe, direction-aware, idempotent, and resumable", () => {
    const autoPaper = source("server/crypto/autoPaper.ts");
    for (const state of ["HEALTHY", "WARNING", "REVERSAL_RISK", "DATA_UNAVAILABLE", "TARGET_1_REACHED", "TARGET_2_REACHED", "TARGET_3_REACHED", "STOP_REACHED", "SETUP_DETECTED", "ENTRY_SIMULATED", "STOP_LOSS"]) expect(autoPaper).toContain(state);
    for (const text of ["recordEventIfAbsent", "eventKey", "currentSnapshot", "ACTIVE_TRIAL_STATUSES", "RESUMED", "without closing or repricing"]) expect(autoPaper).toContain(text);
    expect(autoPaper).toContain("DATA_UNAVAILABLE");
  });

  it("keeps independent accounting and equity snapshot boundaries", () => {
    const autoPaper = source("server/crypto/autoPaper.ts");
    for (const text of ["autoPaperAccounts", "autoPaperEquitySnapshots", "deriveAutoPaperAccountState", "persistAutoPaperEquitySnapshot", "realizedPnl", "unrealizedPnl", "availableCash"]) expect(autoPaper).toContain(text);
    expect(autoPaper).toContain('source: AUTO_PAPER_SOURCE');
  });

  it("preserves cron-only authentication and no real trading", () => {
    const handler = source("server/crypto/autoPaperHandler.ts");
    const router = source("server/routers/crypto.ts");
    for (const text of ["authenticateRequest", "user.isCron", "user.taskUid", "AUTO_PAPER_REFRESH_FAILED"]) expect(handler).toContain(text);
    expect(router).toContain("refreshAutoPaperActive: protectedProcedure");
    for (const forbidden of ["placeOrder", "createExchangeOrder", "realOrder", "api.binance.com/api/v3/order"]) {
      expect(source("server/crypto/autoPaper.ts")).not.toContain(forbidden);
      expect(source("client/src/components/crypto/AutoPaperLab.tsx")).not.toContain(forbidden);
    }
  });

  it("keeps PWA and production testing honest", () => {
    const pwa = source("client/src/pwa/PwaMobileNavigation.tsx");
    const lab = source("client/src/components/crypto/AutoPaperLab.tsx");
    expect(pwa).toContain("Auto Paper Lab");
    expect(lab).toContain("Server-authoritative research only");
    expect(lab).toContain("No real orders");
    expect(lab).not.toContain("create synthetic");
  });
});
