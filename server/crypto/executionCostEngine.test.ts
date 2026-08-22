import { describe, expect, it } from "vitest";
import { calculateCostSensitivity, calculateNetOutcome, calculateStressScenarios, classifyLiquidityTier, estimateVolumeImpactBps, type ExecutionCostModel, type HistoricalExecutionState, type HistoricalTrade } from "./executionCostEngine";

const model = (overrides: Partial<ExecutionCostModel> = {}): ExecutionCostModel => ({
  version: "EXECUTION_COST_LIQUIDITY_RESEARCH_V1",
  instrumentType: "perpetual",
  exchange: "Binance",
  applicability: { assetId: "bitcoin", tradeSizeUsd: 10_000 },
  fee: { entry: { kind: "taker", percent: 0.1, source: "Declared scenario" }, exit: { kind: "maker", percent: 0.05, source: "Declared scenario" } },
  slippage: { mode: "FIXED", entryBps: 5, exitBps: 10, source: "Declared scenario" },
  liquidityImpact: { mode: "ESTIMATED_VOLUME_IMPACT", lookbackHours: 24, participationCoefficient: 0.5, capBps: 100, source: "OHLCV approximation" },
  funding: { mode: "ACTUAL", source: "Public historical funding" },
  ...overrides,
});

const liquidity = (status: "AVAILABLE" | "PARTIAL" | "UNAVAILABLE" = "AVAILABLE") => ({ status, tier: status === "UNAVAILABLE" ? "UNAVAILABLE" as const : "A" as const, quoteVolume: status === "UNAVAILABLE" ? null : 1_000_000, marketCap: null, volumeMarketCapRatio: null, observedBars: status === "UNAVAILABLE" ? 0 : 24, expectedBars: 24, source: "Sealed OHLCV", observedAt: status === "UNAVAILABLE" ? null : 1_000 });
const state = (overrides: Partial<HistoricalExecutionState> = {}): HistoricalExecutionState => ({ entryLiquidity: liquidity(), exitLiquidity: liquidity(), funding: { status: "AVAILABLE", cumulativeRatePercent: 0.02, recordCount: 2, source: "Public historical funding", intervalEvidence: "DERIVED_FROM_ADJACENT_SETTLEMENT" }, orderBookStatus: "UNAVAILABLE", ...overrides });
const trade = (overrides: Partial<HistoricalTrade> = {}): HistoricalTrade => ({ side: "long", instrumentType: "perpetual", tradeSizeUsd: 10_000, grossEntryPrice: 100, grossExitPrice: 110, entryAt: 1_000, exitAt: 2_000, ...overrides });

describe("Execution Cost & Liquidity Research Engine", () => {
  it("separates maker/taker entry and exit fees, fixed slippage, estimated impact, and actual funding from gross return", () => {
    const outcome = calculateNetOutcome(trade(), state(), model());
    expect(outcome.gross).toMatchObject({ returnPercent: 10, pnlUsd: 1_000 });
    expect(outcome.entry.fee).toMatchObject({ amountUsd: 10, percentOfNotional: 0.1 });
    expect(outcome.exit.fee).toMatchObject({ amountUsd: 5.5, percentOfNotional: 0.055 });
    expect(outcome.entry.slippage).toMatchObject({ amountUsd: 5, percentOfNotional: 0.05 });
    expect(outcome.exit.slippage).toMatchObject({ amountUsd: 11, percentOfNotional: 0.11 });
    expect(outcome.funding).toMatchObject({ mode: "ACTUAL", amountUsd: 2, percentOfNotional: 0.02, recordCount: 2 });
    expect(outcome.totalTradingCostsUsd).not.toBeNull();
    expect(outcome.netReturnPercent).toBeLessThan(outcome.gross.returnPercent);
    expect(outcome.limitations).toContain("HISTORICAL ORDER-BOOK DATA UNAVAILABLE: no historical bid, ask, spread, depth, or imbalance is substituted.");
  });

  it("keeps funding excluded for spot even if a perpetual funding assumption is supplied", () => {
    const spotTrade = trade({ instrumentType: "spot" });
    const spotModel = model({ instrumentType: "spot", funding: { mode: "ASSUMED", assumedPercent: 1, source: "Should not apply" } });
    const outcome = calculateNetOutcome(spotTrade, state(), spotModel);
    expect(outcome.funding).toMatchObject({ mode: "EXCLUDED", amountUsd: 0, recordCount: 0 });
    expect(outcome.netReturnPercent).not.toBeNull();
  });

  it("does not fabricate a perpetual net outcome when declared funding is unavailable", () => {
    const outcome = calculateNetOutcome(trade(), state({ funding: { status: "UNAVAILABLE", cumulativeRatePercent: null, recordCount: 0, source: null, intervalEvidence: null, reason: "No record" } }), model({ funding: { mode: "UNAVAILABLE" } }));
    expect(outcome.funding).toMatchObject({ status: "UNAVAILABLE", amountUsd: null, mode: "UNAVAILABLE" });
    expect(outcome.totalTradingCostsUsd).toBeNull();
    expect(outcome.netReturnPercent).toBeNull();
  });

  it("classifies observable liquidity tiers and keeps unavailable data unavailable", () => {
    expect(classifyLiquidityTier(1_000_000_000)).toBe("A");
    expect(classifyLiquidityTier(250_000_000)).toBe("B");
    expect(classifyLiquidityTier(50_000_000)).toBe("C");
    expect(classifyLiquidityTier(10_000_000)).toBe("D");
    expect(classifyLiquidityTier(9_999_999)).toBe("E");
    expect(classifyLiquidityTier(null)).toBe("UNAVAILABLE");
  });

  it("caps the explicitly estimated volume impact and reports unavailable OHLCV liquidity without replacement", () => {
    const estimated = estimateVolumeImpactBps(100_000, liquidity(), model().liquidityImpact);
    expect(estimated).toMatchObject({ status: "AVAILABLE", participationRate: 0.1, bps: 100 });
    const missing = estimateVolumeImpactBps(10_000, liquidity("UNAVAILABLE"), model().liquidityImpact);
    expect(missing).toMatchObject({ status: "UNAVAILABLE", bps: null, participationRate: null });
  });

  it("shows trade-size and cost-assumption sensitivity without selecting a favorable case", () => {
    const rows = calculateCostSensitivity(trade(), state(), model(), { feesPercent: [0.05, 0.1], slippagePercent: [0, 0.5], tradeSizesUsd: [1_000, 100_000] });
    expect(rows).toHaveLength(8);
    const low = rows.find(row => row.tradeSizeUsd === 1_000 && row.feePercent === 0.05 && row.slippagePercent === 0)!;
    const high = rows.find(row => row.tradeSizeUsd === 100_000 && row.feePercent === 0.1 && row.slippagePercent === 0.5)!;
    expect(high.outcome.netReturnPercent!).toBeLessThan(low.outcome.netReturnPercent!);
  });

  it("builds transparent ideal-through-severe stress scenarios", () => {
    const scenarios = calculateStressScenarios(trade(), state(), model());
    expect(scenarios.map(item => item.scenario)).toEqual(["IDEAL_EXECUTION", "LOW_COST", "BASE_COST", "HIGH_COST", "SEVERE_SLIPPAGE"]);
    const ideal = scenarios[0]!.outcome.netReturnPercent!;
    const severe = scenarios.at(-1)!.outcome.netReturnPercent!;
    expect(severe).toBeLessThan(ideal);
  });
});
