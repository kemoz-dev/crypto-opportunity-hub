import { describe, expect, it } from "vitest";
import { healthFor, monitorStateLabel, monitorStatus, reachedStatus, targetProgress, type SetupMonitorStatus } from "./setupMonitor";

const makeItem = (overrides: Record<string, unknown> = {}) => ({
  assetId: "BTC", symbol: "BTC", mode: "SWING", status: "POTENTIAL", maturity: "DEVELOPING",
  setupReadiness: { score: 72 }, direction: "LONG",
  readinessPlan: { currentPrice: 100, targets: [{ label: "TP1", price: 105 }, { label: "TP2", price: 110 }, { label: "TP3", price: 120 }] },
  ...overrides,
} as any);
const itemAt = (price: number | null, direction: "LONG" | "SHORT" = "LONG") => makeItem({ direction, readinessPlan: { currentPrice: price, targets: direction === "LONG" ? [{ label: "TP1", price: 105 }, { label: "TP2", price: 110 }, { label: "TP3", price: 120 }] : [{ label: "TP1", price: 95 }, { label: "TP2", price: 90 }, { label: "TP3", price: 80 }] } });

 describe("Phase 10B Setup Monitor lifecycle", () => {
  it.each([["QUALIFIED", "QUALIFIED"], ["POTENTIAL", "POTENTIAL"], ["WATCH", "WATCH"], ["NO TRADE", "WATCH"], ["DATA UNAVAILABLE", "DATA_UNAVAILABLE"]])("maps discovery %s to monitor %s", (status, expected) => expect(monitorStatus(makeItem({ status }))).toBe(expected));
  it("maps invalidated maturity to INVALIDATED", () => expect(monitorStatus(makeItem({ status: "NO TRADE", maturity: "INVALIDATED" }))).toBe("INVALIDATED"));
  it("maps unknown non-invalidated state to WATCH", () => expect(monitorStatus(makeItem({ status: "NO TRADE", maturity: "EARLY" }))).toBe("WATCH"));
  it("labels unavailable with a space", () => expect(monitorStateLabel("DATA_UNAVAILABLE")).toBe("DATA UNAVAILABLE"));
  it("normalizes target labels", () => expect(monitorStateLabel("TARGET_2_REACHED")).toBe("TARGET 2 REACHED"));

  it.each([["DATA_UNAVAILABLE", "DATA_UNAVAILABLE"], ["INVALIDATED", "INVALIDATED"], ["QUALIFIED", "HEALTHY"], ["TARGET_1_REACHED", "HEALTHY"], ["TARGET_2_REACHED", "HEALTHY"], ["TARGET_3_REACHED", "HEALTHY"]] as Array<[SetupMonitorStatus, string]>) ("maps %s to health %s", (status, expected) => expect(healthFor(makeItem(), status).state).toBe(expected));
  it("uses caution for potential", () => expect(healthFor(makeItem({ status: "POTENTIAL" }), "POTENTIAL").state).toBe("CAUTION"));
  it("uses reversal risk for watch", () => expect(healthFor(makeItem({ status: "WATCH" }), "WATCH").state).toBe("REVERSAL_RISK"));
  it("explains unavailable health", () => expect(healthFor(makeItem(), "DATA_UNAVAILABLE").reason).toContain("unavailable"));
  it("explains invalidation separately", () => expect(healthFor(makeItem(), "INVALIDATED").reason).toContain("invalidation"));
  it("explains healthy validated evidence", () => expect(healthFor(makeItem(), "QUALIFIED").reason).toContain("validated evidence"));
  it("never marks unavailable healthy", () => expect(healthFor(makeItem(), "DATA_UNAVAILABLE").state).not.toBe("HEALTHY"));
  it("never marks invalidated caution", () => expect(healthFor(makeItem(), "INVALIDATED").state).not.toBe("CAUTION"));

  it("marks long targets pending below entry", () => expect(targetProgress(itemAt(100)).map(target => target.status)).toEqual(["PENDING", "PENDING", "PENDING"]));
  it("marks first long target reached", () => expect(targetProgress(itemAt(106)).map(target => target.reached)).toEqual([true, false, false]));
  it("marks two long targets reached", () => expect(targetProgress(itemAt(111)).map(target => target.reached)).toEqual([true, true, false]));
  it("marks exact long target reached", () => expect(targetProgress(itemAt(105))[0].reached).toBe(true));
  it("calculates target distance percent", () => expect(targetProgress(itemAt(100))[0].distancePercent).toBe(5));
  it("returns null distance without price", () => expect(targetProgress(itemAt(null))[0].distancePercent).toBeNull());
  it("marks short target pending above target", () => expect(targetProgress(itemAt(100, "SHORT")).map(target => target.reached)).toEqual([false, false, false]));
  it("marks short target reached below target", () => expect(targetProgress(itemAt(94, "SHORT"))[0].reached).toBe(true));
  it("preserves target ordinals", () => expect(targetProgress(itemAt(100)).map(target => target.ordinal)).toEqual([1, 2, 3]));
  it("does not reach target without price", () => expect(targetProgress(itemAt(null))[0].reached).toBe(false));
  it("keeps potential with no target reached", () => expect(reachedStatus(targetProgress(itemAt(100)), "POTENTIAL")).toBe("POTENTIAL"));
  it("moves qualified to target one", () => expect(reachedStatus(targetProgress(itemAt(106)), "QUALIFIED")).toBe("TARGET_1_REACHED"));
  it("moves qualified to target two", () => expect(reachedStatus(targetProgress(itemAt(111)), "QUALIFIED")).toBe("TARGET_2_REACHED"));
  it("moves qualified to target three", () => expect(reachedStatus(targetProgress(itemAt(121)), "QUALIFIED")).toBe("TARGET_3_REACHED"));
  it("preserves invalidated over target progress", () => expect(reachedStatus(targetProgress(itemAt(121)), "INVALIDATED")).toBe("INVALIDATED"));
  it("preserves unavailable over target progress", () => expect(reachedStatus(targetProgress(itemAt(121)), "DATA_UNAVAILABLE")).toBe("DATA_UNAVAILABLE"));
  it("does not create target state without price", () => expect(reachedStatus(targetProgress(itemAt(null)), "QUALIFIED")).toBe("QUALIFIED"));
  it("retains qualified when targets are pending", () => expect(reachedStatus(targetProgress(itemAt(100)), "QUALIFIED")).toBe("QUALIFIED"));
  it("retains watch when targets are pending", () => expect(reachedStatus(targetProgress(itemAt(100)), "WATCH")).toBe("WATCH"));
  it("has no automatic close lifecycle type", () => expect(["CREATED", "STATE_CHANGED", "TARGET_REACHED", "CAUTION", "REVERSAL_RISK", "INVALIDATED", "DATA_UNAVAILABLE", "ARCHIVED"]).not.toContain("AUTO_CLOSE"));
});
