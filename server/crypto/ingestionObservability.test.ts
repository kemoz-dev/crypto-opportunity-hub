import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDb } = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("../db", () => ({ getDb }));

import { appendHistoricalIssueEvent, calculateResearchReadiness, recordHistoricalIngestionIssue } from "./ingestionObservability";

describe("research dataset readiness", () => {
  beforeEach(() => vi.resetAllMocks());
  it("is not ready when no assets or timeframe observations are represented", () => {
    const readiness = calculateResearchReadiness({ assetCount: 0, timeframeCoverage: { "15m": { observed: 0, expected: 0 } }, missingRanges: 0, regimeCount: 0, continuityPercent: 0, incrementalExecutionCount: 0 });
    expect(readiness.status).toBe("NOT_READY");
    expect(readiness.completenessPercent).toBe(0);
  });

  it("accumulates when unresolved missing ranges or limited regime diversity remain despite observed coverage", () => {
    const readiness = calculateResearchReadiness({ assetCount: 20, timeframeCoverage: { "15m": { observed: 70_080, expected: 70_080 }, "1h": { observed: 166_440, expected: 166_440 } }, missingRanges: 1, regimeCount: 1, continuityPercent: 100, incrementalExecutionCount: 0 });
    expect(readiness.status).toBe("ACCUMULATING");
    expect(readiness.completenessPercent).toBe(100);
    expect(readiness.reasons).toEqual(expect.arrayContaining(["20 assets represented", "1 unresolved missing ranges"]));
  });

  it("can surface ready for review only from observed multi-scope, continuous, no-missing evidence and never launches research", () => {
    const readiness = calculateResearchReadiness({ assetCount: 20, timeframeCoverage: { "15m": { observed: 70_080, expected: 70_080 }, "1h": { observed: 166_440, expected: 166_440 }, "4h": { observed: 21_900, expected: 21_900 } }, missingRanges: 0, regimeCount: 3, continuityPercent: 100, incrementalExecutionCount: 1 });
    expect(readiness.status).toBe("READY_FOR_REVIEW");
    expect(readiness.reasons.join(" ")).toContain("3 recorded regime classifications");
  });

  it("preserves original missing-range evidence and appends a separate retry-success event", async () => {
    const inserts: unknown[] = [];
    const db = {
      insert: vi.fn(() => ({ values: async (value: unknown) => { inserts.push(value); } })),
      select: vi.fn(() => ({ from: () => ({ where: () => ({ orderBy: () => ({ limit: async () => [{ id: 77, assetId: "pepe" }] }) }) }) })),
    };
    getDb.mockResolvedValue(db);

    const issue = await recordHistoricalIngestionIssue({ datasetId: 300001, scheduleExecutionId: 90001, assetId: "pepe", exchange: "Binance", provider: "Binance public archive", instrumentType: "perpetual", timeframe: "1h", expectedStartAt: 1_000, expectedEndAt: 2_000 }, "SOURCE_UNAVAILABLE", "Public archive did not provide PEPE.", 0, { unavailableDays: ["2026-08-01"] });
    await appendHistoricalIssueEvent([issue.id], { scheduleExecutionId: 90002, eventType: "RETRY_SUCCEEDED", retryAttempt: 1, details: { insertedCount: 0, duplicateCount: 0 } });

    expect(inserts).toHaveLength(3);
    expect(inserts[0]).toEqual(expect.objectContaining({ issueKind: "SOURCE_UNAVAILABLE", errorReason: "Public archive did not provide PEPE." }));
    expect(inserts[1]).toEqual(expect.objectContaining({ issueId: 77, eventType: "DETECTED" }));
    expect(inserts[2]).toEqual([expect.objectContaining({ issueId: 77, eventType: "RETRY_SUCCEEDED", retryAttempt: 1 })]);
  });
});
