export const EXECUTION_COST_PROTOCOL_VERSION = "EXECUTION_COST_LIQUIDITY_RESEARCH_V1";

export type ExecutionInstrumentType = "spot" | "perpetual";
export type LiquidityTier = "A" | "B" | "C" | "D" | "E" | "UNAVAILABLE";
export type Availability = "AVAILABLE" | "PARTIAL" | "UNAVAILABLE";
export type FundingMode = "ACTUAL" | "ASSUMED" | "EXCLUDED" | "UNAVAILABLE";
export type TradeSide = "long" | "short";

export type FeeLeg = { kind: "maker" | "taker"; percent: number; source: string };
export type ExecutionCostModel = {
  version: string;
  instrumentType: ExecutionInstrumentType;
  exchange: string;
  applicability: { assetId?: string; liquidityTier?: LiquidityTier; tradeSizeUsd?: number };
  fee: { entry: FeeLeg; exit: FeeLeg };
  slippage: { mode: "FIXED"; entryBps: number; exitBps: number; source: string };
  liquidityImpact: { mode: "NONE" | "ESTIMATED_VOLUME_IMPACT"; lookbackHours: number; participationCoefficient: number; capBps: number; source: string };
  funding: { mode: FundingMode; assumedPercent?: number | null; source?: string | null };
};

export type HistoricalLiquidityState = {
  status: Availability;
  tier: LiquidityTier;
  quoteVolume: number | null;
  marketCap: number | null;
  volumeMarketCapRatio: number | null;
  observedBars: number;
  expectedBars: number;
  source: string;
  observedAt: number | null;
};

export type HistoricalFundingState = {
  status: Availability;
  cumulativeRatePercent: number | null;
  recordCount: number;
  source: string | null;
  intervalEvidence: string | null;
  reason?: string;
};

export type HistoricalExecutionState = {
  entryLiquidity: HistoricalLiquidityState;
  exitLiquidity: HistoricalLiquidityState;
  funding: HistoricalFundingState;
  orderBookStatus: "UNAVAILABLE";
};

export type HistoricalTrade = {
  side: TradeSide;
  instrumentType: ExecutionInstrumentType;
  tradeSizeUsd: number;
  grossEntryPrice: number;
  grossExitPrice: number;
  entryAt: number;
  exitAt: number;
};

export type CostComponent = { status: Availability; amountUsd: number | null; percentOfNotional: number | null; reason?: string };
export type NetOutcome = {
  protocolVersion: typeof EXECUTION_COST_PROTOCOL_VERSION;
  availability: Availability;
  gross: { entryPrice: number; exitPrice: number; returnPercent: number; pnlUsd: number };
  entry: { fee: CostComponent; slippage: CostComponent; liquidityImpact: CostComponent; effectivePrice: number | null };
  exit: { fee: CostComponent; slippage: CostComponent; liquidityImpact: CostComponent; effectivePrice: number | null };
  funding: CostComponent & { mode: FundingMode; recordCount: number; source: string | null };
  totalTradingCostsUsd: number | null;
  totalTradingCostsPercent: number | null;
  netPnlUsd: number | null;
  netReturnPercent: number | null;
  liquidity: { entry: HistoricalLiquidityState; exit: HistoricalLiquidityState };
  limitations: string[];
};

export const DEFAULT_LIQUIDITY_TIER_THRESHOLDS: Record<Exclude<LiquidityTier, "UNAVAILABLE">, number> = {
  A: 1_000_000_000,
  B: 250_000_000,
  C: 50_000_000,
  D: 10_000_000,
  E: 0,
};

const round = (value: number, decimals = 8) => Number(value.toFixed(decimals));
const nonNegative = (value: number) => Math.max(0, Number.isFinite(value) ? value : 0);
const percentOf = (amount: number, notional: number) => notional > 0 ? round(amount / notional * 100) : null;
const availableComponent = (amount: number, notional: number): CostComponent => ({ status: "AVAILABLE", amountUsd: round(amount), percentOfNotional: percentOf(amount, notional) });
const unavailableComponent = (reason: string): CostComponent => ({ status: "UNAVAILABLE", amountUsd: null, percentOfNotional: null, reason });

export function classifyLiquidityTier(quoteVolume: number | null | undefined, thresholds = DEFAULT_LIQUIDITY_TIER_THRESHOLDS): LiquidityTier {
  if (!Number.isFinite(quoteVolume) || Number(quoteVolume) < 0) return "UNAVAILABLE";
  if (Number(quoteVolume) >= thresholds.A) return "A";
  if (Number(quoteVolume) >= thresholds.B) return "B";
  if (Number(quoteVolume) >= thresholds.C) return "C";
  if (Number(quoteVolume) >= thresholds.D) return "D";
  return "E";
}

export function estimateVolumeImpactBps(tradeSizeUsd: number, liquidity: HistoricalLiquidityState, model: ExecutionCostModel["liquidityImpact"]): { status: Availability; bps: number | null; participationRate: number | null; reason?: string } {
  if (model.mode === "NONE") return { status: "AVAILABLE", bps: 0, participationRate: 0 };
  if (liquidity.status === "UNAVAILABLE" || !Number.isFinite(liquidity.quoteVolume) || Number(liquidity.quoteVolume) <= 0) return { status: "UNAVAILABLE", bps: null, participationRate: null, reason: "Historical quote-volume evidence is unavailable for the selected liquidity-impact model." };
  const participationRate = nonNegative(tradeSizeUsd) / Number(liquidity.quoteVolume);
  const bps = Math.min(nonNegative(model.capBps), participationRate * nonNegative(model.participationCoefficient) * 10_000);
  return { status: liquidity.status, bps: round(bps), participationRate: round(participationRate, 12) };
}

function effectivePrice(price: number, side: TradeSide, isEntry: boolean, fixedBps: number, liquidityBps: number | null) {
  if (!Number.isFinite(price) || price <= 0 || liquidityBps === null) return null;
  const direction = side === "long" ? 1 : -1;
  const executionDirection = isEntry ? direction : -direction;
  return round(price * (1 + executionDirection * (nonNegative(fixedBps) + nonNegative(liquidityBps)) / 10_000));
}

function liquidityComponent(tradeSizeUsd: number, impact: ReturnType<typeof estimateVolumeImpactBps>): CostComponent {
  if (impact.bps === null) return unavailableComponent(impact.reason ?? "Historical liquidity impact is unavailable.");
  return { status: impact.status, amountUsd: round(tradeSizeUsd * impact.bps / 10_000), percentOfNotional: round(impact.bps / 100), ...(impact.status === "PARTIAL" ? { reason: "Estimated from partial historical OHLCV volume evidence." } : {}) };
}

export function calculateNetOutcome(trade: HistoricalTrade, historicalState: HistoricalExecutionState, model: ExecutionCostModel): NetOutcome {
  if (trade.instrumentType !== model.instrumentType) throw new Error("Trade and cost model instrument types must match.");
  if (!Number.isFinite(trade.tradeSizeUsd) || trade.tradeSizeUsd <= 0) throw new Error("Trade size must be positive.");
  if (!Number.isFinite(trade.grossEntryPrice) || trade.grossEntryPrice <= 0 || !Number.isFinite(trade.grossExitPrice) || trade.grossExitPrice <= 0) throw new Error("Gross entry and exit prices must be positive.");
  if (trade.exitAt < trade.entryAt) throw new Error("Exit time must be at or after entry time.");

  const direction = trade.side === "long" ? 1 : -1;
  const quantity = trade.tradeSizeUsd / trade.grossEntryPrice;
  const exitNotional = quantity * trade.grossExitPrice;
  const grossPnlUsd = (exitNotional - trade.tradeSizeUsd) * direction;
  const grossReturnPercent = grossPnlUsd / trade.tradeSizeUsd * 100;
  const entryFee = availableComponent(trade.tradeSizeUsd * nonNegative(model.fee.entry.percent) / 100, trade.tradeSizeUsd);
  const exitFee = availableComponent(exitNotional * nonNegative(model.fee.exit.percent) / 100, trade.tradeSizeUsd);
  const entrySlippage = availableComponent(trade.tradeSizeUsd * nonNegative(model.slippage.entryBps) / 10_000, trade.tradeSizeUsd);
  const exitSlippage = availableComponent(exitNotional * nonNegative(model.slippage.exitBps) / 10_000, trade.tradeSizeUsd);
  const entryImpact = estimateVolumeImpactBps(trade.tradeSizeUsd, historicalState.entryLiquidity, model.liquidityImpact);
  const exitImpact = estimateVolumeImpactBps(exitNotional, historicalState.exitLiquidity, model.liquidityImpact);
  const entryLiquidityImpact = liquidityComponent(trade.tradeSizeUsd, entryImpact);
  const exitLiquidityImpact = liquidityComponent(exitNotional, exitImpact);
  const limitations: string[] = ["HISTORICAL ORDER-BOOK DATA UNAVAILABLE: no historical bid, ask, spread, depth, or imbalance is substituted."];
  if (historicalState.entryLiquidity.status === "PARTIAL" || historicalState.exitLiquidity.status === "PARTIAL") limitations.push("ESTIMATED LIQUIDITY IMPACT uses partial point-in-time OHLCV-volume coverage.");

  let funding: NetOutcome["funding"];
  if (trade.instrumentType === "spot") {
    funding = { ...availableComponent(0, trade.tradeSizeUsd), mode: "EXCLUDED", recordCount: 0, source: null, reason: "Spot research never applies funding." };
  } else if (model.funding.mode === "UNAVAILABLE") {
    funding = { ...unavailableComponent("FUNDING DATA UNAVAILABLE: select an explicit assumed funding scenario or retrieve complete historical funding evidence."), mode: "UNAVAILABLE", recordCount: historicalState.funding.recordCount, source: historicalState.funding.source };
    limitations.push(funding.reason!);
  } else if (model.funding.mode === "ACTUAL" && (historicalState.funding.status === "UNAVAILABLE" || historicalState.funding.cumulativeRatePercent === null)) {
    funding = { ...unavailableComponent(historicalState.funding.reason ?? "FUNDING DATA UNAVAILABLE for the selected perpetual holding window."), mode: "ACTUAL", recordCount: historicalState.funding.recordCount, source: historicalState.funding.source };
    limitations.push(funding.reason!);
  } else {
    const fundingPercent = model.funding.mode === "ASSUMED" ? Number(model.funding.assumedPercent ?? NaN) : model.funding.mode === "EXCLUDED" ? 0 : Number(historicalState.funding.cumulativeRatePercent ?? 0);
    if (!Number.isFinite(fundingPercent)) {
      funding = { ...unavailableComponent("ASSUMED FUNDING requires an explicit finite percentage."), mode: model.funding.mode, recordCount: historicalState.funding.recordCount, source: model.funding.source ?? historicalState.funding.source };
      limitations.push(funding.reason!);
    } else {
      const amount = trade.tradeSizeUsd * fundingPercent / 100 * direction;
      const status = model.funding.mode === "ACTUAL" ? historicalState.funding.status : "AVAILABLE" as const;
      funding = { status, amountUsd: round(amount), percentOfNotional: round(amount / trade.tradeSizeUsd * 100), mode: model.funding.mode, recordCount: historicalState.funding.recordCount, source: model.funding.mode === "ASSUMED" ? model.funding.source ?? "User-declared research assumption" : historicalState.funding.source, ...(status === "PARTIAL" ? { reason: "Actual funding evidence is partial for the selected holding window." } : {}) };
      if (model.funding.mode === "ASSUMED") limitations.push("ASSUMED FUNDING is a declared research scenario, not historical funding evidence.");
      if (model.funding.mode === "EXCLUDED") limitations.push("Perpetual funding is explicitly excluded by the declared research scenario.");
    }
  }

  const components = [entryFee, exitFee, entrySlippage, exitSlippage, entryLiquidityImpact, exitLiquidityImpact, funding];
  const unavailable = components.filter(component => component.status === "UNAVAILABLE");
  const partial = components.some(component => component.status === "PARTIAL");
  const totalTradingCostsUsd = unavailable.length ? null : round(components.reduce((sum, component) => sum + Number(component.amountUsd ?? 0), 0));
  const netPnlUsd = totalTradingCostsUsd === null ? null : round(grossPnlUsd - totalTradingCostsUsd);
  return {
    protocolVersion: EXECUTION_COST_PROTOCOL_VERSION,
    availability: unavailable.length ? "UNAVAILABLE" : partial ? "PARTIAL" : "AVAILABLE",
    gross: { entryPrice: trade.grossEntryPrice, exitPrice: trade.grossExitPrice, returnPercent: round(grossReturnPercent), pnlUsd: round(grossPnlUsd) },
    entry: { fee: entryFee, slippage: entrySlippage, liquidityImpact: entryLiquidityImpact, effectivePrice: effectivePrice(trade.grossEntryPrice, trade.side, true, model.slippage.entryBps, entryImpact.bps) },
    exit: { fee: exitFee, slippage: exitSlippage, liquidityImpact: exitLiquidityImpact, effectivePrice: effectivePrice(trade.grossExitPrice, trade.side, false, model.slippage.exitBps, exitImpact.bps) },
    funding,
    totalTradingCostsUsd,
    totalTradingCostsPercent: totalTradingCostsUsd === null ? null : round(totalTradingCostsUsd / trade.tradeSizeUsd * 100),
    netPnlUsd,
    netReturnPercent: netPnlUsd === null ? null : round(netPnlUsd / trade.tradeSizeUsd * 100),
    liquidity: { entry: historicalState.entryLiquidity, exit: historicalState.exitLiquidity },
    limitations,
  };
}

export type CostSensitivityInput = { feesPercent: number[]; slippagePercent: number[]; tradeSizesUsd: number[] };

export function calculateCostSensitivity(trade: HistoricalTrade, state: HistoricalExecutionState, model: ExecutionCostModel, input: CostSensitivityInput) {
  return input.tradeSizesUsd.flatMap(tradeSizeUsd => input.feesPercent.flatMap(feePercent => input.slippagePercent.map(slippagePercent => {
    const scenario: ExecutionCostModel = { ...model, fee: { entry: { ...model.fee.entry, percent: feePercent }, exit: { ...model.fee.exit, percent: feePercent } }, slippage: { ...model.slippage, entryBps: slippagePercent * 100, exitBps: slippagePercent * 100 } };
    return { tradeSizeUsd, feePercent, slippagePercent, outcome: calculateNetOutcome({ ...trade, tradeSizeUsd }, state, scenario) };
  })));
}

export const STRESS_SCENARIOS = ["IDEAL_EXECUTION", "LOW_COST", "BASE_COST", "HIGH_COST", "SEVERE_SLIPPAGE"] as const;
export type StressScenario = typeof STRESS_SCENARIOS[number];

export function calculateStressScenarios(trade: HistoricalTrade, state: HistoricalExecutionState, model: ExecutionCostModel) {
  const factors: Record<StressScenario, { fee: number; slippage: number; liquidity: number }> = {
    IDEAL_EXECUTION: { fee: 0, slippage: 0, liquidity: 0 },
    LOW_COST: { fee: 0.5, slippage: 0.5, liquidity: 0.5 },
    BASE_COST: { fee: 1, slippage: 1, liquidity: 1 },
    HIGH_COST: { fee: 1.5, slippage: 2, liquidity: 2 },
    SEVERE_SLIPPAGE: { fee: 2, slippage: 5, liquidity: 5 },
  };
  return STRESS_SCENARIOS.map(scenarioName => {
    const factor = factors[scenarioName];
    const scenario: ExecutionCostModel = {
      ...model,
      fee: { entry: { ...model.fee.entry, percent: model.fee.entry.percent * factor.fee }, exit: { ...model.fee.exit, percent: model.fee.exit.percent * factor.fee } },
      slippage: { ...model.slippage, entryBps: model.slippage.entryBps * factor.slippage, exitBps: model.slippage.exitBps * factor.slippage },
      liquidityImpact: { ...model.liquidityImpact, participationCoefficient: model.liquidityImpact.participationCoefficient * factor.liquidity },
    };
    return { scenario: scenarioName, assumptions: { feeMultiplier: factor.fee, slippageMultiplier: factor.slippage, liquidityImpactMultiplier: factor.liquidity, fundingMode: model.funding.mode }, outcome: calculateNetOutcome(trade, state, scenario) };
  });
}
