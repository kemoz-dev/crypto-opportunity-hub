import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "./_core/context";

const { listAlertExecutions, getAlertExecution } = vi.hoisted(() => ({ listAlertExecutions: vi.fn(), getAlertExecution: vi.fn() }));

vi.mock("./crypto/alerts", async importOriginal => {
  const actual = await importOriginal<typeof import("./crypto/alerts")>();
  return { ...actual, listAlertExecutions, getAlertExecution };
});

import { appRouter } from "./routers";

function context(user: TrpcContext["user"]): TrpcContext {
  return { user, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

const user = { id: 7, openId: "history-user", email: null, name: "History User", loginMethod: "manus", role: "user" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };
const otherUser = { ...user, id: 8, openId: "other-history-user", name: "Other User" };

describe("crypto execution-history protected routes", () => {
  beforeEach(() => vi.resetAllMocks());

  it("scopes list and detail retrieval to the authenticated user", async () => {
    listAlertExecutions.mockResolvedValue([{ id: 10, alertId: 1, alertName: "Private alert", outcomeStatus: "NO_MATCH" }]);
    getAlertExecution.mockResolvedValue({ id: 10, alertId: 1, alertName: "Private alert", outcomeStatus: "NO_MATCH" });
    const caller = appRouter.createCaller(context(user));
    await expect(caller.crypto.alertExecutions({ alertId: 1 })).resolves.toHaveLength(1);
    await expect(caller.crypto.alertExecution({ alertId: 1, executionId: 10 })).resolves.toMatchObject({ alertName: "Private alert" });
    expect(listAlertExecutions).toHaveBeenCalledWith(7, 1);
    expect(getAlertExecution).toHaveBeenCalledWith(7, 1, 10);
  });

  it("rejects unauthenticated callers before any history service access", async () => {
    const caller = appRouter.createCaller(context(null));
    await expect(caller.crypto.alertExecutions({ alertId: 1 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.crypto.alertExecution({ alertId: 1, executionId: 10 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(listAlertExecutions).not.toHaveBeenCalled();
    expect(getAlertExecution).not.toHaveBeenCalled();
  });

  it("denies a different authenticated user access to another user's alert history", async () => {
    listAlertExecutions.mockImplementation(async userId => {
      if (userId !== 7) throw new TRPCError({ code: "NOT_FOUND", message: "Alert not found" });
      return [];
    });
    getAlertExecution.mockImplementation(async userId => {
      if (userId !== 7) throw new TRPCError({ code: "NOT_FOUND", message: "Alert execution not found" });
      return { id: 10 };
    });
    const caller = appRouter.createCaller(context(otherUser));
    await expect(caller.crypto.alertExecutions({ alertId: 1 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller.crypto.alertExecution({ alertId: 1, executionId: 10 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(listAlertExecutions).toHaveBeenCalledWith(8, 1);
    expect(getAlertExecution).toHaveBeenCalledWith(8, 1, 10);
  });
});
