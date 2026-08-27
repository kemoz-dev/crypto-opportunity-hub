import { beforeEach, describe, expect, it, vi } from "vitest";

const { authenticateRequest, refreshAutoPaperForAllEnabled, getUserScoringConfig } = vi.hoisted(() => ({ authenticateRequest: vi.fn(), refreshAutoPaperForAllEnabled: vi.fn(), getUserScoringConfig: vi.fn() }));

vi.mock("../_core/sdk", () => ({ sdk: { authenticateRequest } }));
vi.mock("./autoPaper", () => ({ refreshAutoPaperForAllEnabled }));
vi.mock("./settings", () => ({ getUserScoringConfig }));

import { scheduledAutoPaperHandler } from "./autoPaperHandler";

function responseRecorder() {
  const state: { code?: number; body?: unknown } = {};
  const response = { status(code: number) { state.code = code; return response; }, json(body: unknown) { state.body = body; return response; } } as never;
  return { response, state };
}

describe("scheduled Auto Paper handler", () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it("rejects unauthenticated requests without refreshing trials", async () => {
    authenticateRequest.mockRejectedValue(new Error("missing credential"));
    const { response, state } = responseRecorder();
    await scheduledAutoPaperHandler({ body: { userId: 999 } } as never, response);
    expect(state).toEqual(expect.objectContaining({ code: 500 }));
    expect(refreshAutoPaperForAllEnabled).not.toHaveBeenCalled();
  });

  it("rejects authenticated non-cron callers", async () => {
    authenticateRequest.mockResolvedValue({ isCron: false, taskUid: undefined });
    const { response, state } = responseRecorder();
    await scheduledAutoPaperHandler({} as never, response);
    expect(state).toEqual({ code: 403, body: { error: "cron-only" } });
    expect(refreshAutoPaperForAllEnabled).not.toHaveBeenCalled();
  });

  it("uses the platform task identity and ignores request-body ownership", async () => {
    authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "auto-paper-task" });
    refreshAutoPaperForAllEnabled.mockResolvedValue({ users: 0, results: [] });
    const { response, state } = responseRecorder();
    await scheduledAutoPaperHandler({ body: { userId: 999, taskUid: "attacker" } } as never, response);
    expect(state).toEqual(expect.objectContaining({ code: 200, body: expect.objectContaining({ taskUid: "auto-paper-task" }) }));
    expect(refreshAutoPaperForAllEnabled).toHaveBeenCalledWith(expect.any(Function));
  });

  it("returns a sanitized 500 shape on refresh failure", async () => {
    authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "auto-paper-task" });
    refreshAutoPaperForAllEnabled.mockRejectedValue(new Error("provider payload must not leak"));
    const { response, state } = responseRecorder();
    await scheduledAutoPaperHandler({} as never, response);
    expect(state).toEqual(expect.objectContaining({ code: 500, body: expect.objectContaining({ code: "AUTO_PAPER_REFRESH_FAILED", taskUid: "auto-paper-task" }) }));
    expect(JSON.stringify(state.body)).not.toContain("provider payload");
  });
});
