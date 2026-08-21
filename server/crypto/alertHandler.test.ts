import { beforeEach, describe, expect, it, vi } from "vitest";

const { authenticateRequest, evaluateAlertByTaskUid } = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  evaluateAlertByTaskUid: vi.fn(),
}));

vi.mock("../_core/sdk", () => ({ sdk: { authenticateRequest } }));
vi.mock("./alerts", () => ({ evaluateAlertByTaskUid }));

import { scheduledAlertHandler } from "./alertHandler";

function responseRecorder() {
  const state = { code: 200, body: undefined as unknown };
  const response = {
    status: (code: number) => { state.code = code; return response; },
    json: (body: unknown) => { state.body = body; return response; },
  };
  return { response, state };
}

describe("scheduled alert handler security and status boundaries", () => {
  beforeEach(() => vi.resetAllMocks());

  it("rejects unauthenticated calls without invoking the alert evaluator", async () => {
    authenticateRequest.mockRejectedValue(new Error("missing cron credential"));
    const { response, state } = responseRecorder();
    await scheduledAlertHandler({} as never, response as never);
    expect(state).toEqual({ code: 403, body: { error: "cron-only" } });
    expect(evaluateAlertByTaskUid).not.toHaveBeenCalled();
  });

  it("records the authenticated scheduled path as a successful handler response without any trade action", async () => {
    authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "task-1" });
    evaluateAlertByTaskUid.mockResolvedValue({ triggered: false, skipped: "threshold-not-met" });
    const { response, state } = responseRecorder();
    await scheduledAlertHandler({} as never, response as never);
    expect(state.code).toBe(200);
    expect(state.body).toMatchObject({ ok: true, result: { triggered: false, skipped: "threshold-not-met" } });
    expect(evaluateAlertByTaskUid).toHaveBeenCalledWith("task-1");
  });

  it("returns a sanitized failure shape when a scheduled evaluation fails", async () => {
    authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "task-1" });
    evaluateAlertByTaskUid.mockRejectedValue(new Error("sensitive provider payload should not reach the response"));
    const { response, state } = responseRecorder();
    await scheduledAlertHandler({} as never, response as never);
    expect(state.code).toBe(500);
    expect(state.body).toMatchObject({ error: "Scheduled alert evaluation failed.", code: "ALERT_EVALUATION_FAILED", taskUid: "task-1" });
    expect(JSON.stringify(state.body)).not.toContain("sensitive provider payload");
  });
});
