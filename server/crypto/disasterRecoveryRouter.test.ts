import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";

describe("Disaster Recovery protected routes", () => {
  it("rejects unauthenticated archive list, creation, and download access", async () => {
    const caller = appRouter.createCaller({ user: null, req: { headers: {} }, res: {} } as TrpcContext);
    await expect(caller.crypto.disasterRecoveryArchives()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.crypto.createDisasterRecoveryArchive()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.crypto.disasterRecoveryArchiveDownload({ archiveId: 1 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
