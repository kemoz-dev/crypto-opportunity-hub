import { describe, expect, it } from "vitest";
import { autoPaperSettingsSchema, deriveAutoPaperAccountState } from "./autoPaper";

describe("Phase 16 independent Auto Paper accounting", () => {
  it("defaults Auto Paper OFF with the project-approved paper capital configuration", () => {
    const settings = autoPaperSettingsSchema.parse({});
    expect(settings.enabled).toBe(false);
    expect(settings.mode).toBe("BALANCED");
    expect(settings.riskPercent).toBe(1);
  });

  it("keeps reserved cash and unrealized P/L in a separate account model", () => {
    const state = deriveAutoPaperAccountState({ startingCapital: 100000 }, [
      { status: "HEALTHY", entryPrice: 100, positionSize: 10, realizedPnl: 0, currentPnl: 25 },
      { status: "STOPPED", entryPrice: 200, positionSize: 5, realizedPnl: -40, currentPnl: 0 },
    ]);
    expect(state.reservedCapital).toBe(1000);
    expect(state.realizedPnl).toBe(-40);
    expect(state.unrealizedPnl).toBe(25);
    expect(state.availableCash).toBe(98960);
    expect(state.currentEquity).toBe(99985);
  });

  it("releases exposure after a simulated stop without changing the starting capital", () => {
    const state = deriveAutoPaperAccountState({ startingCapital: 100000 }, [
      { status: "STOPPED", entryPrice: 100, positionSize: 10, realizedPnl: -125, currentPnl: 0 },
    ]);
    expect(state.reservedCapital).toBe(0);
    expect(state.availableCash).toBe(99875);
    expect(state.currentEquity).toBe(99875);
    expect(state.startingCapital).toBe(100000);
  });

  it("keeps unavailable observations reserved but never invents P/L", () => {
    const state = deriveAutoPaperAccountState({ startingCapital: 100000 }, [
      { status: "DATA_UNAVAILABLE", entryPrice: 100, positionSize: 10, realizedPnl: 0, currentPnl: 0 },
    ]);
    expect(state.reservedCapital).toBe(1000);
    expect(state.unrealizedPnl).toBe(0);
    expect(state.availableCash).toBe(99000);
    expect(state.currentEquity).toBe(100000);
  });
});
