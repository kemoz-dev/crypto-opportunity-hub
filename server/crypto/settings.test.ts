import { describe, expect, it } from "vitest";
import { DEFAULT_SCORING_CONFIG } from "../../shared/crypto";
import { scoringConfigSchema } from "./settings";

function cloneDefault() { return JSON.parse(JSON.stringify(DEFAULT_SCORING_CONFIG)); }

describe("scoring configuration validation", () => {
  it("accepts the documented default configuration", () => {
    expect(scoringConfigSchema.safeParse(DEFAULT_SCORING_CONFIG).success).toBe(true);
  });

  it("rejects a MACD configuration where the fast period is not below the slow period", () => {
    const config = cloneDefault();
    config.indicator.macdFast = config.indicator.macdSlow;
    expect(scoringConfigSchema.safeParse(config).success).toBe(false);
  });

  it("rejects a configuration that disables every timeframe", () => {
    const config = cloneDefault();
    Object.values(config.timeframes).forEach((timeframe: { enabled: boolean }) => { timeframe.enabled = false; });
    expect(scoringConfigSchema.safeParse(config).success).toBe(false);
  });

  it("requires at least one score component to receive a positive weight", () => {
    const config = cloneDefault();
    Object.keys(config.weights).forEach(key => { config.weights[key] = 0; });
    expect(scoringConfigSchema.safeParse(config).success).toBe(false);
  });
});
