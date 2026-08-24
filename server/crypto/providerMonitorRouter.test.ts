import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";

describe("provider monitor route authorization", () => {
  it("allows public current-status inspection but rejects unauthenticated monitor-history access", async () => {
    const ctx = { user: null, req: { headers: {} }, res: {} } as TrpcContext;
    const caller = appRouter.createCaller(ctx);
    await expect(caller.crypto.providerMonitorSummary()).resolves.toBeDefined();
    await expect(caller.crypto.providerMonitorHistory()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
