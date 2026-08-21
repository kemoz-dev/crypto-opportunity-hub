import { beforeEach, describe, expect, it, vi } from "vitest";

const { authenticateRequest, evaluateHistoricalIngestionByTaskUid } = vi.hoisted(() => ({ authenticateRequest: vi.fn(), evaluateHistoricalIngestionByTaskUid: vi.fn() }));
vi.mock("../_core/sdk", () => ({ sdk: { authenticateRequest } }));
vi.mock("./historicalSchedule", () => ({ evaluateHistoricalIngestionByTaskUid }));
import { scheduledHistoricalIngestionHandler } from "./historicalScheduleHandler";

function responseRecorder() {
  const state = { code: 200, body: undefined as unknown };
  const response = { status: (code: number) => { state.code = code; return response; }, json: (body: unknown) => { state.body = body; return response; } };
  return { response, state };
}

describe("scheduled historical ingestion handler", () => {
  beforeEach(() => vi.resetAllMocks());
  it("rejects unauthenticated calls without running ingestion", async () => {
    authenticateRequest.mockRejectedValue(new Error("missing credential"));
    const { response, state } = responseRecorder();
    await scheduledHistoricalIngestionHandler({} as never, response as never);
    expect(state).toEqual({ code: 403, body: { error: "cron-only" } });
    expect(evaluateHistoricalIngestionByTaskUid).not.toHaveBeenCalled();
  });
  it("runs only with the authenticated platform task UID and never accepts body identity", async () => {
    authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "historical-task-1" });
    evaluateHistoricalIngestionByTaskUid.mockResolvedValue({ status: "SUCCESS", datasetId: 123 });
    const { response, state } = responseRecorder();
    await scheduledHistoricalIngestionHandler({ body: { taskUid: "attacker" } } as never, response as never);
    expect(state.code).toBe(200);
    expect(evaluateHistoricalIngestionByTaskUid).toHaveBeenCalledWith("historical-task-1");
  });
});
