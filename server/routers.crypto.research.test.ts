import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const { listResearchExperiments, getResearchExperiment, exportResearchExperiment } = vi.hoisted(() => ({ listResearchExperiments: vi.fn(), getResearchExperiment: vi.fn(), exportResearchExperiment: vi.fn() }));

vi.mock("./crypto/researchLab", async importOriginal => {
  const actual = await importOriginal<typeof import("./crypto/researchLab")>();
  return { ...actual, listResearchExperiments, getResearchExperiment, exportResearchExperiment };
});

import { appRouter } from "./routers";

const user = { id: 7, openId: "research-user", email: null, name: "Research User", loginMethod: "manus", role: "user" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };
const otherUser = { ...user, id: 8, openId: "other-research-user" };
function context(currentUser: TrpcContext["user"]): TrpcContext { return { user: currentUser, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] }; }

describe("crypto Research Lab protected routes", () => {
  beforeEach(() => vi.resetAllMocks());

  it("scopes research history and export retrieval to the authenticated user", async () => {
    listResearchExperiments.mockResolvedValue([{ id: 9, userId: 7, name: "Private research" }]);
    getResearchExperiment.mockResolvedValue({ id: 9, userId: 7, results: [] });
    exportResearchExperiment.mockResolvedValue({ filename: "private.csv", mimeType: "text/csv", content: "dimension" });
    const caller = appRouter.createCaller(context(user));
    await expect(caller.crypto.researchExperiments()).resolves.toHaveLength(1);
    await expect(caller.crypto.researchExperiment({ experimentId: 9 })).resolves.toMatchObject({ id: 9 });
    await expect(caller.crypto.exportResearchExperiment({ experimentId: 9, format: "csv" })).resolves.toMatchObject({ filename: "private.csv" });
    expect(listResearchExperiments).toHaveBeenCalledWith(7);
    expect(getResearchExperiment).toHaveBeenCalledWith(7, 9);
    expect(exportResearchExperiment).toHaveBeenCalledWith(7, 9, "csv");
  });

  it("rejects unauthenticated Research Lab history requests before service access", async () => {
    const caller = appRouter.createCaller(context(null));
    await expect(caller.crypto.researchExperiments()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.crypto.exportResearchExperiment({ experimentId: 9, format: "json" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(listResearchExperiments).not.toHaveBeenCalled();
    expect(exportResearchExperiment).not.toHaveBeenCalled();
  });

  it("denies a different authenticated user access to another user's research", async () => {
    getResearchExperiment.mockImplementation(async userId => { if (userId !== 7) throw new TRPCError({ code: "NOT_FOUND", message: "Research experiment not found" }); return { id: 9 }; });
    exportResearchExperiment.mockImplementation(async userId => { if (userId !== 7) throw new TRPCError({ code: "NOT_FOUND", message: "Research experiment not found" }); return { filename: "private.json" }; });
    const caller = appRouter.createCaller(context(otherUser));
    await expect(caller.crypto.researchExperiment({ experimentId: 9 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller.crypto.exportResearchExperiment({ experimentId: 9, format: "json" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(getResearchExperiment).toHaveBeenCalledWith(8, 9);
    expect(exportResearchExperiment).toHaveBeenCalledWith(8, 9, "json");
  });
});
