import { DEFAULT_ASSET_UNIVERSE, type Candle, type ScoringConfig } from "../../shared/crypto";
import { calculateAtr, calculateEma, calculateRsi } from "./technical";
import { fetchValidatedLowTimeframeBundle, getApprovedBybitLowTimeframeMappings, SCALPING_TIMEFRAMES, type LowTimeframeBundle, type LowTimeframeBundleState, type ScalpingTimeframe } from "./lowTimeframeProviders";

export const LOW_TIMEFRAME_SCALPING_ENGINE_VERSION = "LOW_TIMEFRAME_SCALPING_V1";
export type LowTimeframeBias = "bullish" | "neutral" | "bearish";
export type LowTimeframeAlignment = "STRONG" | "PARTIAL" | "CONFLICTED" | "NEUTRAL" | "UNAVAILABLE";
export type LowTimeframePlanStatus = "QUALIFIED" | "WATCH" | "NO TRADE";
export type LowTimeframeDirection = "LONG" | "SHORT" | "NO TRADE";
export type LowTimeframeHealthState = "HEALTHY" | "WARNING" | "DANGER" | "INVALIDATED" | "HEALTH UNKNOWN";

export type LowTimeframeAnalysis = {
  timeframe: ScalpingTimeframe;
  bias: LowTimeframeBias;
  price: number;
  emaFast: number | null;
  emaMedium: number | null;
  emaSlow: number | null;
  rsi: number | null;
  atr: number | null;
  atrPercent: number | null;
  volumeExpansion: number | null;
  momentum: "rising" | "falling" | "flat" | "unavailable";
  structure: "bullish" | "bearish" | "neutral";
  evidence: string[];
  risks: string[];
};

export type LowTimeframeLevel = {
  label: "STOP" | "INVALIDATION" | "TP1" | "TP2" | "TP3";
  price: number;
  distancePercent: number | null;
  rewardRisk: number | null;
  reason: string;
  priority: "PRIMARY" | "SECONDARY" | "EXTENDED";
};

export type LowTimeframeScalpingPlan = {
  engineVersion: typeof LOW_TIMEFRAME_SCALPING_ENGINE_VERSION;
  assetId: string;
  symbol: string;
  displaySymbol: string;
  actionable: boolean;
  presentationStatus: LowTimeframePlanStatus;
  rank: number | null;
  direction: LowTimeframeDirection;
  expectedDuration: string | null;
  provider: "Bybit Spot" | null;
  providerSymbol: string | null;
  dataTimestamp: number | null;
  dataBundle: {
    state: LowTimeframeBundleState;
    coherent: boolean;
    eligibleForScalping: boolean;
    capturedAt: number;
    statusMessage: string;
    timeframes: LowTimeframeBundle["timeframes"];
  };
  currentPrice: number | null;
  alignment: LowTimeframeAlignment;
  timeframeStates: LowTimeframeAnalysis[];
  setupQuality: { value: number | null; label: "Scalping Setup Quality"; detail: string };
  entryZone: { low: number; high: number; preferred: number; reason: string; state: "READY" | "ENTRY MISSED" } | null;
  stop: LowTimeframeLevel | null;
  invalidation: LowTimeframeLevel | null;
  targets: LowTimeframeLevel[];
  rewardRisk: number | null;
  targetPath: Array<{ label: "ENTRY" | "TP1" | "TP2" | "TP3"; price: number; status: "CURRENT" | "REACHED" | "PENDING" }>;
  evidence: string[];
  risks: string[];
  noTradeReasons: string[];
};

export type LowTimeframeTradeHealth = {
  state: LowTimeframeHealthState;
  reasons: string[];
  targetPath: Array<{ label: "ENTRY" | "TP1" | "TP2" | "TP3"; price: number; status: "CURRENT" | "REACHED" | "PENDING" }>;
  data: { provider: "Bybit Spot" | null; generatedAt: number | null; availability: "LIVE" | "STALE" | "UNAVAILABLE" };
};

const round = (value: number, digits = 8) => Number(value.toFixed(digits));
const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

function findPivot(candles: Candle[], kind: "high" | "low", lookback = 72) {
  const start = Math.max(2, candles.length - lookback);
  const pivots: number[] = [];
  for (let index = start; index < candles.length - 2; index += 1) {
    const value = candles[index][kind];
    const compare = kind === "high" ? (left: number, right: number) => left >= right : (left: number, right: number) => left <= right;
    if (compare(value, candles[index - 1][kind]) && compare(value, candles[index + 1][kind]) && compare(value, candles[index - 2][kind]) && compare(value, candles[index + 2][kind])) pivots.push(index);
  }
  return pivots;
}

function recentStructure(candles: Candle[]): LowTimeframeAnalysis["structure"] {
  const prior = candles.slice(-21, -1);
  const current = candles.at(-1);
  if (!current || prior.length < 12) return "neutral";
  const priorHigh = Math.max(...prior.map(candle => candle.high));
  const priorLow = Math.min(...prior.map(candle => candle.low));
  if (current.close > priorHigh || (current.close > candles.at(-2)!.close && current.low > Math.min(...prior.slice(-8).map(candle => candle.low)))) return "bullish";
  if (current.close < priorLow || (current.close < candles.at(-2)!.close && current.high < Math.max(...prior.slice(-8).map(candle => candle.high)))) return "bearish";
  return "neutral";
}

export function analyzeLowTimeframe(candles: Candle[], timeframe: ScalpingTimeframe, configuration: ScoringConfig): LowTimeframeAnalysis | null {
  const required = Math.max(configuration.indicator.emaSlow + 2, configuration.indicator.macdSlow + configuration.indicator.macdSignal + 2, 60);
  if (candles.length < required) return null;
  const closes = candles.map(candle => candle.close);
  const emaFastSeries = calculateEma(closes, configuration.indicator.emaFast);
  const emaMediumSeries = calculateEma(closes, configuration.indicator.emaMedium);
  const emaSlowSeries = calculateEma(closes, configuration.indicator.emaSlow);
  const emaFast = emaFastSeries.at(-1);
  const emaMedium = emaMediumSeries.at(-1);
  const emaSlow = emaSlowSeries.at(-1);
  const previousFast = emaFastSeries.at(-2);
  const rsi = calculateRsi(closes, configuration.indicator.rsiPeriod);
  const atr = calculateAtr(candles, configuration.indicator.atrPeriod);
  const current = candles.at(-1)!;
  const previous = candles.at(-2)!;
  const volumeBase = average(candles.slice(-(configuration.indicator.volumePeriod + 1), -1).map(candle => candle.volume));
  const volumeExpansion = volumeBase && volumeBase > 0 ? current.volume / volumeBase : null;
  const momentum: LowTimeframeAnalysis["momentum"] = previousFast === undefined || emaFast === undefined ? "unavailable" : emaFast > previousFast && current.close > previous.close ? "rising" : emaFast < previousFast && current.close < previous.close ? "falling" : "flat";
  const structure = recentStructure(candles);
  const bullish = emaFast !== undefined && emaMedium !== undefined && emaSlow !== undefined && current.close > emaFast && emaFast > emaMedium && emaMedium > emaSlow && rsi !== null && rsi >= 50 && momentum === "rising";
  const bearish = emaFast !== undefined && emaMedium !== undefined && emaSlow !== undefined && current.close < emaFast && emaFast < emaMedium && emaMedium < emaSlow && rsi !== null && rsi <= 50 && momentum === "falling";
  const bias: LowTimeframeBias = bullish ? "bullish" : bearish ? "bearish" : "neutral";
  const evidence = [
    emaFast !== undefined && emaMedium !== undefined && emaSlow !== undefined ? `${timeframe.toUpperCase()} EMA state: price ${current.close > emaFast ? "above" : "below"} EMA${configuration.indicator.emaFast}; EMA${configuration.indicator.emaFast}/${configuration.indicator.emaMedium}/${configuration.indicator.emaSlow} are ${bullish ? "bullishly aligned" : bearish ? "bearishly aligned" : "mixed"}.` : `${timeframe.toUpperCase()} EMA state is unavailable.`,
    rsi === null ? `${timeframe.toUpperCase()} RSI is unavailable.` : `${timeframe.toUpperCase()} RSI is ${round(rsi, 2)}.`,
    volumeExpansion === null ? `${timeframe.toUpperCase()} relative volume is unavailable.` : `${timeframe.toUpperCase()} volume is ${round(volumeExpansion, 2)}× its prior ${configuration.indicator.volumePeriod}-candle average.`,
    `${timeframe.toUpperCase()} candle structure is ${structure}.`,
  ];
  const risks = [
    volumeExpansion !== null && volumeExpansion < 0.8 ? `${timeframe.toUpperCase()} volume is below 0.8× its reference average.` : "",
    rsi !== null && (rsi > 75 || rsi < 25) ? `${timeframe.toUpperCase()} RSI is extended at ${round(rsi, 2)}.` : "",
    structure === "neutral" ? `${timeframe.toUpperCase()} structure is not decisive.` : "",
  ].filter(Boolean);
  return { timeframe, bias, price: current.close, emaFast: emaFast === undefined ? null : round(emaFast), emaMedium: emaMedium === undefined ? null : round(emaMedium), emaSlow: emaSlow === undefined ? null : round(emaSlow), rsi: rsi === null ? null : round(rsi, 2), atr: atr === null ? null : round(atr), atrPercent: atr === null ? null : round(atr / current.close * 100, 3), volumeExpansion: volumeExpansion === null ? null : round(volumeExpansion, 2), momentum, structure, evidence, risks };
}

function alignmentFor(states: LowTimeframeAnalysis[]): LowTimeframeAlignment {
  if (states.length !== SCALPING_TIMEFRAMES.length) return "UNAVAILABLE";
  const bullish = states.filter(item => item.bias === "bullish").length;
  const bearish = states.filter(item => item.bias === "bearish").length;
  if (bullish === 3 || bearish === 3) return "STRONG";
  if (bullish && bearish) return "CONFLICTED";
  if (bullish === 2 || bearish === 2) return "PARTIAL";
  return "NEUTRAL";
}

function directionFor(alignment: LowTimeframeAlignment, states: LowTimeframeAnalysis[]): LowTimeframeDirection {
  if (alignment !== "STRONG") return "NO TRADE";
  return states[0]?.bias === "bullish" ? "LONG" : states[0]?.bias === "bearish" ? "SHORT" : "NO TRADE";
}

function buildTargets(direction: LowTimeframeDirection, preferred: number, currentPrice: number, stopPrice: number, candles: Candle[], atr: number): LowTimeframeLevel[] {
  const risk = Math.abs(preferred - stopPrice);
  if (!Number.isFinite(risk) || risk <= 0) return [];
  const kind = direction === "LONG" ? "high" : "low";
  const pivots = findPivot(candles, kind).map(index => candles[index][kind]).filter(value => direction === "LONG" ? value > preferred : value < preferred);
  const volatilityExtensions = [1.5, 2.5, 3.5].map(multiplier => direction === "LONG" ? preferred + atr * multiplier : preferred - atr * multiplier);
  const candidates = Array.from(new Set([...pivots, ...volatilityExtensions].map(value => round(value)))).filter(value => direction === "LONG" ? value > Math.max(preferred, currentPrice) : value < Math.min(preferred, currentPrice)).sort((left, right) => direction === "LONG" ? left - right : right - left).slice(0, 3);
  return candidates.map((price, index) => ({
    label: (`TP${index + 1}` as "TP1" | "TP2" | "TP3"),
    price,
    distancePercent: round(Math.abs(price - preferred) / preferred * 100, 2),
    rewardRisk: round(Math.abs(price - preferred) / risk, 2),
    reason: pivots.includes(price) ? "Nearest validated 5m pivot/liquidity structure." : "5m ATR volatility extension; shown only because no nearer validated pivot occupied this target tier.",
    priority: index === 0 ? "PRIMARY" : index === 1 ? "SECONDARY" : "EXTENDED",
  }));
}

function targetPathFrom(direction: Exclude<LowTimeframeDirection, "NO TRADE">, currentPrice: number, entryPrice: number, targets: LowTimeframeLevel[]) {
  const actualTargets = targets.filter((target): target is LowTimeframeLevel & { label: "TP1" | "TP2" | "TP3" } => target.label === "TP1" || target.label === "TP2" || target.label === "TP3");
  return [{ label: "ENTRY" as const, price: entryPrice, status: "CURRENT" as const }, ...actualTargets.map(target => ({ label: target.label, price: target.price, status: direction === "LONG" ? currentPrice >= target.price ? "REACHED" as const : "PENDING" as const : currentPrice <= target.price ? "REACHED" as const : "PENDING" as const }))];
}

function emptyPlan(asset: typeof DEFAULT_ASSET_UNIVERSE[number], bundle: LowTimeframeBundle, reason: string): LowTimeframeScalpingPlan {
  return {
    engineVersion: LOW_TIMEFRAME_SCALPING_ENGINE_VERSION,
    assetId: asset.id,
    symbol: asset.symbol,
    displaySymbol: `${asset.symbol}/USDT`,
    actionable: false,
    presentationStatus: "NO TRADE",
    rank: null,
    direction: "NO TRADE",
    expectedDuration: null,
    provider: bundle.provider,
    providerSymbol: bundle.providerSymbol,
    dataTimestamp: null,
    dataBundle: { state: bundle.state, coherent: bundle.coherent, eligibleForScalping: bundle.eligibleForScalping, capturedAt: bundle.capturedAt, statusMessage: bundle.statusMessage, timeframes: bundle.timeframes },
    currentPrice: null,
    alignment: "UNAVAILABLE",
    timeframeStates: [],
    setupQuality: { value: null, label: "Scalping Setup Quality", detail: "Not calculated because the complete validated 1m/3m/5m bundle is unavailable." },
    entryZone: null,
    stop: null,
    invalidation: null,
    targets: [],
    rewardRisk: null,
    targetPath: [],
    evidence: [],
    risks: [],
    noTradeReasons: [reason],
  };
}

export function buildLowTimeframeScalpingPlan(asset: typeof DEFAULT_ASSET_UNIVERSE[number], bundle: LowTimeframeBundle, configuration: ScoringConfig): LowTimeframeScalpingPlan {
  if (!bundle.eligibleForScalping || !bundle.coherent || !bundle.provider) return emptyPlan(asset, bundle, `NO TRADE — DATA UNAVAILABLE: ${bundle.statusMessage}`);
  const states = SCALPING_TIMEFRAMES.map(timeframe => {
    const series = bundle.seriesByTimeframe[timeframe];
    return series ? analyzeLowTimeframe(series.candles, timeframe, configuration) : null;
  });
  if (states.some((state): state is null => state === null)) return emptyPlan(asset, bundle, "NO TRADE — DATA UNAVAILABLE: validated candles were insufficient for the configured technical indicators.");
  const timeframeStates = states as LowTimeframeAnalysis[];
  const alignment = alignmentFor(timeframeStates);
  const direction = directionFor(alignment, timeframeStates);
  const currentPrice = timeframeStates[0].price;
  const base = {
    engineVersion: LOW_TIMEFRAME_SCALPING_ENGINE_VERSION,
    assetId: asset.id,
    symbol: asset.symbol,
    displaySymbol: `${asset.symbol}/USDT`,
    rank: null,
    provider: bundle.provider,
    providerSymbol: bundle.providerSymbol,
    dataTimestamp: Math.min(...Object.values(bundle.seriesByTimeframe).map(series => series!.retrievedAt)),
    dataBundle: { state: bundle.state, coherent: bundle.coherent, eligibleForScalping: bundle.eligibleForScalping, capturedAt: bundle.capturedAt, statusMessage: bundle.statusMessage, timeframes: bundle.timeframes },
    currentPrice,
    alignment,
    timeframeStates,
  } satisfies Partial<LowTimeframeScalpingPlan>;
  const coreReasons = timeframeStates.flatMap(state => state.evidence);
  const coreRisks = timeframeStates.flatMap(state => state.risks);
  if (direction === "NO TRADE") {
    const conflicted = alignment === "CONFLICTED";
    const watchable = alignment === "PARTIAL" || alignment === "NEUTRAL";
    const reason = conflicted ? "1m/3m/5m evidence is conflicted; no directional setup is presented." : alignment === "PARTIAL" ? "Only two of three validated timeframes agree; confirmation is incomplete." : "Validated low-timeframe evidence is neutral and does not support a directional setup.";
    return {
      ...base as Omit<LowTimeframeScalpingPlan, "actionable" | "presentationStatus" | "direction" | "expectedDuration" | "setupQuality" | "entryZone" | "stop" | "invalidation" | "targets" | "rewardRisk" | "targetPath" | "evidence" | "risks" | "noTradeReasons">,
      actionable: false,
      presentationStatus: watchable ? "WATCH" : "NO TRADE",
      direction: "NO TRADE",
      expectedDuration: null,
      setupQuality: { value: null, label: "Scalping Setup Quality", detail: "Not ranked because all three low timeframes did not support the same direction." },
      entryZone: null,
      stop: null,
      invalidation: null,
      targets: [],
      rewardRisk: null,
      targetPath: [],
      evidence: coreReasons,
      risks: coreRisks,
      noTradeReasons: [reason],
    };
  }
  const oneMinute = timeframeStates[0];
  const threeMinute = timeframeStates[1];
  const fiveMinute = timeframeStates[2];
  if (oneMinute.emaFast === null || threeMinute.emaFast === null || fiveMinute.atr === null || fiveMinute.atr <= 0) return emptyPlan(asset, bundle, "NO TRADE — DATA UNAVAILABLE: a required EMA or 5m ATR value could not be calculated from the validated candles.");
  const preferred = round((oneMinute.emaFast + threeMinute.emaFast) / 2);
  const zonePadding = Math.max(fiveMinute.atr * 0.2, Math.abs(oneMinute.emaFast - threeMinute.emaFast));
  const low = round(preferred - zonePadding);
  const high = round(preferred + zonePadding);
  const entryDistanceAtr = Math.abs(currentPrice - preferred) / fiveMinute.atr;
  const entryMissed = entryDistanceAtr > 1.5;
  const pivotKind = direction === "LONG" ? "low" : "high";
  const pivots = findPivot(bundle.seriesByTimeframe["5m"]!.candles, pivotKind);
  const pivot = pivots.length ? bundle.seriesByTimeframe["5m"]!.candles[pivots.at(-1)!][pivotKind] : null;
  const stopPrice = pivot === null ? null : direction === "LONG" ? pivot - fiveMinute.atr * 0.25 : pivot + fiveMinute.atr * 0.25;
  if (stopPrice === null || (direction === "LONG" ? stopPrice >= low : stopPrice <= high)) return {
    ...base as Omit<LowTimeframeScalpingPlan, "actionable" | "presentationStatus" | "direction" | "expectedDuration" | "setupQuality" | "entryZone" | "stop" | "invalidation" | "targets" | "rewardRisk" | "targetPath" | "evidence" | "risks" | "noTradeReasons">,
    actionable: false,
    presentationStatus: "NO TRADE",
    direction: "NO TRADE",
    expectedDuration: null,
    setupQuality: { value: null, label: "Scalping Setup Quality", detail: "Not ranked because 5m structure did not yield a valid invalidation level." },
    entryZone: null,
    stop: null,
    invalidation: null,
    targets: [],
    rewardRisk: null,
    targetPath: [],
    evidence: coreReasons,
    risks: coreRisks,
    noTradeReasons: ["NO TRADE: no valid 5m structural invalidation could be derived relative to the entry zone."],
  };
  const targets = buildTargets(direction, preferred, currentPrice, stopPrice, bundle.seriesByTimeframe["5m"]!.candles, fiveMinute.atr);
  const rewardRisk = targets[0]?.rewardRisk ?? null;
  const stop: LowTimeframeLevel = { label: "STOP", price: round(stopPrice), distancePercent: round(Math.abs(preferred - stopPrice) / preferred * 100, 2), rewardRisk: null, reason: "5m structural pivot with a 0.25 ATR buffer; this is the setup invalidation, not a fixed-percent stop.", priority: "PRIMARY" };
  const invalidation: LowTimeframeLevel = { ...stop, label: "INVALIDATION" };
  const entryZone = { low, high, preferred, reason: "1m and 3m EMA timing zone, anchored by the validated 5m trend context.", state: entryMissed ? "ENTRY MISSED" as const : "READY" as const };
  const targetPath = targetPathFrom(direction, currentPrice, preferred, targets);
  const insufficientReward = rewardRisk === null || rewardRisk < 1;
  const actionable = !entryMissed && !insufficientReward;
  const presentationStatus: LowTimeframePlanStatus = actionable ? "QUALIFIED" : entryMissed || insufficientReward ? "NO TRADE" : "WATCH";
  const quality = clamp((alignment === "STRONG" ? 30 : 0) + 20 + (timeframeStates.filter(state => (state.volumeExpansion ?? 0) >= 1).length / 3 * 12) + (timeframeStates.filter(state => state.momentum === (direction === "LONG" ? "rising" : "falling")).length / 3 * 13) + (fiveMinute.structure === (direction === "LONG" ? "bullish" : "bearish") ? 10 : 0) + (!entryMissed ? 5 : 0) + (rewardRisk === null ? 0 : clamp(rewardRisk / 3 * 10, 0, 10)), 0, 100);
  return {
    ...base as Omit<LowTimeframeScalpingPlan, "actionable" | "presentationStatus" | "direction" | "expectedDuration" | "setupQuality" | "entryZone" | "stop" | "invalidation" | "targets" | "rewardRisk" | "targetPath" | "evidence" | "risks" | "noTradeReasons">,
    actionable,
    presentationStatus,
    direction: actionable ? direction : "NO TRADE",
    expectedDuration: actionable ? "10–45 min" : null,
    setupQuality: { value: round(quality, 1), label: "Scalping Setup Quality", detail: "A separate low-timeframe presentation ranking derived from validated data quality, alignment, structure, momentum, volume, volatility, entry quality, R:R, and invalidation clarity. It is not Opportunity Score." },
    entryZone,
    stop,
    invalidation,
    targets,
    rewardRisk,
    targetPath,
    evidence: coreReasons,
    risks: [...coreRisks, entryMissed ? `ENTRY MISSED: current price is ${round(entryDistanceAtr, 2)} ATRs from the preferred zone.` : ""].filter(Boolean),
    noTradeReasons: actionable ? [] : [entryMissed ? "NO TRADE: current price is too far from the validated preferred entry zone; price is not chased." : "NO TRADE: the first validated technical target does not satisfy the existing 1:1 minimum R:R."],
  };
}

function mapConcurrent<T, R>(items: T[], limit: number, operation: (item: T) => Promise<R>) {
  const results = Array<R>(items.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const current = cursor++;
      results[current] = await operation(items[current]);
    }
  };
  return Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker)).then(() => results);
}

export async function getLowTimeframeScalpingIntelligence(configuration: ScoringConfig, assetIds?: string[]) {
  const assets = DEFAULT_ASSET_UNIVERSE.filter(asset => !assetIds || assetIds.includes(asset.id));
  const minimumCandles = Math.max(configuration.indicator.emaSlow + 2, configuration.indicator.macdSlow + configuration.indicator.macdSignal + 2, 60);
  const plans = await mapConcurrent(assets, 1, async asset => buildLowTimeframeScalpingPlan(asset, await fetchValidatedLowTimeframeBundle(asset.symbol, minimumCandles), configuration));
  const ordered = plans.sort((left, right) => Number(right.actionable) - Number(left.actionable) || (right.setupQuality.value ?? -1) - (left.setupQuality.value ?? -1) || left.symbol.localeCompare(right.symbol));
  let rank = 0;
  const ranked = ordered.map(plan => plan.presentationStatus === "QUALIFIED" ? { ...plan, rank: ++rank } : plan);
  return {
    engineVersion: LOW_TIMEFRAME_SCALPING_ENGINE_VERSION,
    generatedAt: Date.now(),
    provider: "Bybit Spot" as const,
    requiredTimeframes: [...SCALPING_TIMEFRAMES],
    minimumCandles,
    providerDocumentation: {
      kline: "https://bybit-exchange.github.io/docs/v5/market/kline",
      instruments: "https://bybit-exchange.github.io/docs/v5/market/instrument",
      rateLimits: "https://bybit-exchange.github.io/docs/v5/rate-limit",
      terms: "https://www.bybit.com/en/help-center/article/Terms-of-Service",
      approvedMappings: getApprovedBybitLowTimeframeMappings(),
    },
    summary: {
      evaluatedAssets: ranked.length,
      qualified: ranked.filter(plan => plan.presentationStatus === "QUALIFIED").length,
      watch: ranked.filter(plan => plan.presentationStatus === "WATCH").length,
      noTrade: ranked.filter(plan => plan.presentationStatus === "NO TRADE").length,
      dataUnavailable: ranked.filter(plan => plan.dataBundle.state !== "VALID").length,
      byBundleState: (["VALID", "PARTIAL", "STALE", "MISSING", "INCOHERENT"] as const).map(state => ({ state, count: ranked.filter(plan => plan.dataBundle.state === state).length })),
    },
    note: "This isolated 1m/3m/5m Scalping Intelligence layer uses only a complete validated Bybit Spot bundle. Its Scalping Setup Quality is not Opportunity Score or Regime Score, and it does not alter Swing, alerts, Paper Trading economics, or real-trading restrictions.",
    setups: ranked,
  };
}

export function buildLowTimeframeTradeHealth(entry: LowTimeframeScalpingPlan | null | undefined, current: LowTimeframeScalpingPlan | null | undefined): LowTimeframeTradeHealth {
  if (!entry?.actionable || !current || current.dataBundle.state !== "VALID" || !current.currentPrice || !entry.invalidation) {
    const stale = current?.dataBundle.state === "STALE";
    return { state: "HEALTH UNKNOWN", reasons: [stale ? "Current validated low-timeframe data is stale; health is paused." : "A coherent current Bybit Spot 1m/3m/5m bundle or immutable qualified setup is unavailable; health is not inferred."], targetPath: [], data: { provider: current?.provider ?? null, generatedAt: current?.dataTimestamp ?? null, availability: stale ? "STALE" : "UNAVAILABLE" } };
  }
  const price = current.currentPrice;
  const invalidated = entry.direction === "LONG" ? price <= entry.invalidation.price : price >= entry.invalidation.price;
  const matching = (analysis: LowTimeframeAnalysis | undefined) => entry.direction === "LONG" ? analysis?.bias === "bullish" : analysis?.bias === "bearish";
  const oneMinuteWeak = !matching(current.timeframeStates.find(item => item.timeframe === "1m"));
  const threeMinuteWeak = !matching(current.timeframeStates.find(item => item.timeframe === "3m"));
  const fiveMinuteWeak = !matching(current.timeframeStates.find(item => item.timeframe === "5m"));
  const state: LowTimeframeHealthState = invalidated ? "INVALIDATED" : fiveMinuteWeak || threeMinuteWeak ? "DANGER" : oneMinuteWeak || current.timeframeStates.some(item => (item.volumeExpansion ?? 1) < 0.8) ? "WARNING" : "HEALTHY";
  const targetPath = targetPathFrom(entry.direction as Exclude<LowTimeframeDirection, "NO TRADE">, price, entry.entryZone!.preferred, entry.targets);
  const reasons = [
    invalidated ? `Current price crossed immutable 5m invalidation ${entry.invalidation.price}.` : `Current price remains ${entry.direction === "LONG" ? "above" : "below"} immutable invalidation ${entry.invalidation.price}.`,
    `${current.timeframeStates.find(item => item.timeframe === "5m")?.timeframe.toUpperCase() ?? "5M"} trend is ${current.timeframeStates.find(item => item.timeframe === "5m")?.bias ?? "unavailable"}.`,
    `${current.timeframeStates.find(item => item.timeframe === "3m")?.timeframe.toUpperCase() ?? "3M"} confirmation is ${current.timeframeStates.find(item => item.timeframe === "3m")?.bias ?? "unavailable"}.`,
    oneMinuteWeak ? "1m momentum no longer confirms the immutable setup direction." : "1m momentum continues to confirm the immutable setup direction.",
  ];
  return { state, reasons, targetPath, data: { provider: current.provider, generatedAt: current.dataTimestamp, availability: "LIVE" } };
}
