import { describe, expect, it, vi } from "vitest";

const handlerMocks = vi.hoisted(() => ({ authenticateRequest: vi.fn(), runProviderMonitorByTaskUid: vi.fn() }));

vi.mock("../_core/sdk", () => ({ sdk: { authenticateRequest: handlerMocks.authenticateRequest } }));
vi.mock("./providerMonitor", () => ({ runProviderMonitorByTaskUid: handlerMocks.runProviderMonitorByTaskUid }));

import { scheduledProviderMonitorHandler } from "./providerMonitorHandler";

function responseRecorder() {
  const state: { code: number; body: unknown } = { code: 200, body: null };
  const response = { status: vi.fn((code: number) => { state.code = code; return response; }), json: vi.fn((body: unknown) => { state.body = body; return response; }) };
  return { response, state };
}

describe("scheduled provider monitor authorization", () => {
  it("rejects unauthenticated and non-cron requests", async () => {
    handlerMocks.authenticateRequest.mockRejectedValue(new Error("no session"));
    const { response, state } = responseRecorder();
    await scheduledProviderMonitorHandler({} as never, response as never);
    expect(state.code).toBe(403);
    expect(state.body).toEqual({ error: "cron-only" });
  });

  it("uses only the authenticated platform task UID for scheduled evidence", async () => {
    handlerMocks.authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "provider-monitor-task" });
    handlerMocks.runProviderMonitorByTaskUid.mockResolvedValue({ status: "SUCCESS", executionId: 7 });
    const { response, state } = responseRecorder();
    await scheduledProviderMonitorHandler({ body: { taskUid: "attacker" } } as never, response as never);
    expect(handlerMocks.runProviderMonitorByTaskUid).toHaveBeenCalledWith("provider-monitor-task");
    expect(state.code).toBe(200);
    expect(state.body).toMatchObject({ ok: true, result: { status: "SUCCESS", executionId: 7 } });
  });
});
