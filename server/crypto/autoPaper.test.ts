import { describe, expect, it } from "vitest";
import { currentTrialStatus } from "./autoPaper";

type Trial = Parameters<typeof currentTrialStatus>[0];

function trial(direction: "long" | "short" = "long") {
  return {
    direction,
    entryPrice: 100,
    stopPrice: direction === "long" ? 90 : 110,
    target1: direction === "long" ? 110 : 90,
    target2: direction === "long" ? 120 : 80,
    target3: direction === "long" ? 130 : 70,
  } as Trial;
}

describe("Auto Paper current state evaluator", () => {
  it("marks a long trial healthy before any target or warning boundary", () => {
    expect(currentTrialStatus(trial("long"), 102)).toMatchObject({ status: "HEALTHY", reached: 0 });
  });

  it("marks a long trial at the first target", () => {
    expect(currentTrialStatus(trial("long"), 110)).toMatchObject({ status: "TARGET_1_REACHED", reached: 1 });
  });

  it("marks a short trial at the second target", () => {
    expect(currentTrialStatus(trial("short"), 80)).toMatchObject({ status: "TARGET_2_REACHED", reached: 2 });
  });

  it("marks a stop crossing as invalidated before target checks", () => {
    expect(currentTrialStatus(trial("long"), 90)).toMatchObject({ status: "INVALIDATED", eventType: "STOP_REACHED" });
  });

  it("marks reversal risk and warning from the recorded stop distance", () => {
    expect(currentTrialStatus(trial("long"), 92.5)).toMatchObject({ status: "REVERSAL_RISK" });
    expect(currentTrialStatus(trial("long"), 95)).toMatchObject({ status: "WARNING" });
  });
});
