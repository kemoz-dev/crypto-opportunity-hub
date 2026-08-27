import { describe, expect, it } from "vitest";
import { autoPaperSnapshotDeduplicationKey } from "./autoPaper";

describe("Phase 18 Equity Snapshot boundaries", () => {
  it("deduplicates snapshots within the five-minute server bucket", () => {
    const accountId = 42;
    const first = Date.UTC(2026, 7, 27, 10, 0, 1);
    const second = Date.UTC(2026, 7, 27, 10, 4, 59);
    const next = Date.UTC(2026, 7, 27, 10, 5, 0);
    expect(autoPaperSnapshotDeduplicationKey(accountId, first)).toBe(autoPaperSnapshotDeduplicationKey(accountId, second));
    expect(autoPaperSnapshotDeduplicationKey(accountId, first)).not.toBe(autoPaperSnapshotDeduplicationKey(accountId, next));
  });

  it("keeps account ownership in the deduplication identity", () => {
    const capturedAt = Date.UTC(2026, 7, 27, 10, 0, 0);
    expect(autoPaperSnapshotDeduplicationKey(1, capturedAt)).not.toBe(autoPaperSnapshotDeduplicationKey(2, capturedAt));
  });
});
