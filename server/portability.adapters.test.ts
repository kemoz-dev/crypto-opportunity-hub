import { describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  exchangeCodeForToken: vi.fn(),
  getUserInfo: vi.fn(),
  createSessionToken: vi.fn(),
  createHeartbeatJob: vi.fn(),
  updateHeartbeatJob: vi.fn(),
  deleteHeartbeatJob: vi.fn(),
  listHeartbeatJobs: vi.fn(),
  storagePut: vi.fn(),
  storageGet: vi.fn(),
  storageGetSignedUrl: vi.fn(),
  notifyOwner: vi.fn(),
}));

vi.mock("./_core/sdk", () => ({
  sdk: {
    authenticateRequest: mocked.authenticateRequest,
    exchangeCodeForToken: mocked.exchangeCodeForToken,
    getUserInfo: mocked.getUserInfo,
    createSessionToken: mocked.createSessionToken,
  },
}));
vi.mock("./_core/heartbeat", () => ({
  createHeartbeatJob: mocked.createHeartbeatJob,
  updateHeartbeatJob: mocked.updateHeartbeatJob,
  deleteHeartbeatJob: mocked.deleteHeartbeatJob,
  listHeartbeatJobs: mocked.listHeartbeatJobs,
}));
vi.mock("./storage", () => ({
  storagePut: mocked.storagePut,
  storageGet: mocked.storageGet,
  storageGetSignedUrl: mocked.storageGetSignedUrl,
}));
vi.mock("./_core/notification", () => ({ notifyOwner: mocked.notifyOwner }));

import { getAuthAdapter } from "./_core/authAdapter";
import { getNotificationAdapter } from "./adapters/notifications";
import { getSchedulerAdapter } from "./adapters/scheduler";
import { getStorageAdapter } from "./adapters/storage";

describe("Phase 1 provider adapters", () => {
  it("keeps Manus authentication behind an identity and session boundary", async () => {
    mocked.exchangeCodeForToken.mockResolvedValue({ accessToken: "provider-token" });
    mocked.getUserInfo.mockResolvedValue({ openId: "user-1", name: "Ada", email: "ada@example.test", loginMethod: "manus" });
    mocked.createSessionToken.mockResolvedValue("application-session");
    const auth = getAuthAdapter();
    const identity = await auth.exchangeAuthorizationCode({ code: "code", state: "state" });
    expect(identity).toEqual({ subject: "user-1", name: "Ada", email: "ada@example.test", loginMethod: "manus" });
    await expect(auth.createApplicationSession(identity)).resolves.toBe("application-session");
    expect(auth.getOidcReadiness()).toMatchObject({ provider: "manus", authorizationCodeFlow: true, pkce: "S256", configured: false });
  });

  it("preserves scheduler task identity and cron-only verification behind an adapter", async () => {
    mocked.createHeartbeatJob.mockResolvedValue({ taskUid: "task-1", nextExecutionAt: "2026-08-25T01:00:00Z" });
    mocked.authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "task-1" });
    const scheduler = getSchedulerAdapter();
    await expect(scheduler.create({ name: "job", cron: "0 0 * * * *", path: "/api/scheduled/job" }, "session")).resolves.toEqual({ taskUid: "task-1", nextExecutionAt: "2026-08-25T01:00:00Z" });
    await expect(scheduler.verifyInvocation({} as any)).resolves.toEqual({ taskUid: "task-1", scheme: "manus-cron-session" });
  });

  it("keeps current private storage and owner notifications as active server adapters", async () => {
    mocked.storagePut.mockResolvedValue({ key: "private/key.zip", url: "/manus-storage/private/key.zip" });
    mocked.storageGetSignedUrl.mockResolvedValue("https://signed.example.test/recovery.zip");
    mocked.notifyOwner.mockResolvedValue(true);
    await expect(getStorageAdapter().put("private/key.zip", "data", "application/zip")).resolves.toEqual({ key: "private/key.zip", url: "/manus-storage/private/key.zip" });
    await expect(getStorageAdapter().createDownloadUrl("private/key.zip")).resolves.toBe("https://signed.example.test/recovery.zip");
    await expect(getNotificationAdapter().notifyOwner({ title: "Alert", content: "No trade created" })).resolves.toEqual({ accepted: true, channel: "manus" });
    await expect(getNotificationAdapter().sendWebPush({ title: "Alert", content: "No trade created" })).resolves.toEqual({ accepted: false, channel: "unsupported" });
  });
});
