import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";

describe("Execution Cost Lab protected routes", () => {
  it("rejects unauthenticated list and preview access", async () => {
    const ctx = { user: null, req: { headers: {} }, res: {} } as TrpcContext;
    const caller = appRouter.createCaller(ctx);
    await expect(caller.crypto.executionCostStudies()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.crypto.previewExecutionCostStudy({ name: "Denied preview", datasetId: 1, assetId: "bitcoin", timeframe: "1h", instrumentType: "spot", side: "long", entryAt: 1_700_000_000_000, exitAt: 1_700_003_600_000, tradeSizeUsd: 1_000, fee: { entryKind: "taker", entryPercent: 0.1, exitKind: "taker", exitPercent: 0.1, source: "Scenario" }, slippage: { entryBps: 0, exitBps: 0, source: "Scenario" }, liquidityImpact: { enabled: false, lookbackHours: 24, participationCoefficient: 0, capBps: 0, source: "None" }, funding: { mode: "EXCLUDED", assumedPercent: null, source: null } })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
