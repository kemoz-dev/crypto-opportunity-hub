import type { AssetProfile, MarketAsset, MarketRegime, OpportunityScore, ScoreReason, ScoringConfig, TimeframeAnalysis } from "../../shared/crypto";
import type { GlobalMarketContext } from "./providers";

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const round = (value: number, decimals = 1) => Number(value.toFixed(decimals));

function scoreReason(key: string, label: string, score: number, maxScore: number, direction: ScoreReason["direction"], detail: string): ScoreReason {
  return { key, label, score: round(score), maxScore, direction, detail };
}

export function calculateMarketRegime(
  btc: MarketAsset | undefined,
  universe: MarketAsset[],
  global: GlobalMarketContext | null,
): MarketRegime | null {
  const market = global;
  if (!btc || !market || btc.change24h === null || market.totalMarketChange24h === null) return null;
  const validChanges = universe.map(asset => asset.change24h).filter((value): value is number => value !== null);
  const breadth = validChanges.length ? validChanges.filter(value => value > 0).length / validChanges.length * 100 : null;
  const trend = clamp(50 + btc.change24h * 3);
  const totalTrend = clamp(50 + market.totalMarketChange24h * 3);
  const breadthScore = breadth ?? 50;
  const score = round(trend * 0.4 + totalTrend * 0.3 + breadthScore * 0.3);
  const classification = score >= 66 ? "RISK ON" : score < 45 ? "RISK OFF" : "SELECTIVE";
  const reasons = [
    scoreReason("btc-trend", "BTC 24h trend", trend, 100, trend >= 60 ? "positive" : trend < 40 ? "negative" : "neutral", `BTC is ${btc.change24h >= 0 ? "+" : ""}${round(btc.change24h, 2)}% over 24 hours.`),
    scoreReason("total-market", "Total-market 24h trend", totalTrend, 100, totalTrend >= 60 ? "positive" : totalTrend < 40 ? "negative" : "neutral", `Total market capitalization changed ${market.totalMarketChange24h >= 0 ? "+" : ""}${round(market.totalMarketChange24h, 2)}% over 24 hours.`),
    scoreReason("breadth", "Universe breadth", breadthScore, 100, breadthScore >= 60 ? "positive" : breadthScore < 40 ? "negative" : "neutral", `${breadth === null ? "Insufficient" : `${round(breadth)}% of tracked assets are positive`} over 24 hours.`),
  ];
  return { score, classification, reasons, btcDominance: market.btcDominance, breadth };
}

export function calculateSectorScore(asset: MarketAsset, universe: MarketAsset[]): number | null {
  if (asset.change24h === null) return null;
  const comparable = universe.filter(item => item.sector === asset.sector && item.change24h !== null).map(item => item.change24h!);
  if (comparable.length < 2) return null;
  const sectorAverage = comparable.reduce((sum, value) => sum + value, 0) / comparable.length;
  return round(clamp(50 + (asset.change24h - sectorAverage) * 6));
}

function calculateTechnicalScore(analyses: TimeframeAnalysis[], config: ScoringConfig) {
  const enabled = analyses.filter(analysis => config.timeframes[analysis.timeframe].enabled);
  if (enabled.length === 0) return { score: 0, alignment: 0 };
  const totalWeight = enabled.reduce((sum, analysis) => sum + config.timeframes[analysis.timeframe].weight, 0);
  const weightedRaw = enabled.reduce((sum, analysis) => sum + analysis.score * config.timeframes[analysis.timeframe].weight, 0) / totalWeight;
  const bullish = enabled.filter(analysis => analysis.bias === "bullish").length;
  const bearish = enabled.filter(analysis => analysis.bias === "bearish").length;
  const alignment = clamp(50 + (bullish - bearish) * (35 / enabled.length));
  // The score aggregates each timeframe only once; agreement makes a bounded ±2 point adjustment rather than duplicating indicator points.
  return { score: round(clamp((weightedRaw / 10) * 40 + (alignment - 50) * 0.04, 0, 40)), alignment: round(alignment) };
}

function calculateMomentumScore(asset: MarketAsset, btc: MarketAsset | undefined): number {
  const composite = (change1h: number | null, change24h: number | null, change7d: number | null) =>
    (change1h ?? 0) * 0.2 + (change24h ?? 0) * 0.5 + (change7d ?? 0) * 0.3;
  const assetComposite = composite(asset.change1h, asset.change24h, asset.change7d);
  const btcComposite = btc ? composite(btc.change1h, btc.change24h, btc.change7d) : 0;
  return round(clamp(10 + (assetComposite - btcComposite) * 0.8, 0, 20));
}

function calculateRiskSafety(asset: MarketAsset, analyses: TimeframeAnalysis[], config: ScoringConfig): number {
  const marketCapScore = asset.marketCap === null ? 45 : clamp(35 + Math.log10(Math.max(asset.marketCap, 1) / config.risk.minimumMarketCap) * 25);
  const liquidityRatio = asset.marketCap && asset.volume24h ? asset.volume24h / asset.marketCap : null;
  const liquidityScore = liquidityRatio === null ? 45 : clamp(35 + (liquidityRatio / config.risk.minimumVolumeToMarketCap) * 20);
  const atr = analyses.find(analysis => analysis.timeframe === "4h")?.atrPercent ?? analyses.at(0)?.atrPercent ?? null;
  const volatilityScore = atr === null ? 45 : clamp(100 - (atr / config.risk.maxAtrPercent) * 55);
  return round(marketCapScore * 0.4 + liquidityScore * 0.35 + volatilityScore * 0.25);
}

function setupType(analyses: TimeframeAnalysis[]): OpportunityScore["setupType"] {
  const structures = analyses.flatMap(analysis => analysis.priceStructure);
  if (structures.some(item => /Consolidation breakout|Resistance breakout/i.test(item))) return "Breakout";
  if (structures.some(item => /Support reclaim|Higher low/i.test(item))) return "Bullish Reversal";
  if (analyses.filter(analysis => analysis.bias === "bullish").length >= 3) return "Trend Continuation";
  if (analyses.some(analysis => (analysis.rsi ?? 50) < 35)) return "Oversold Recovery";
  return "No Setup";
}

export function buildOpportunityScore({
  asset,
  analyses,
  universe,
  btc,
  marketRegime,
  config,
}: {
  asset: MarketAsset;
  analyses: TimeframeAnalysis[];
  universe: MarketAsset[];
  btc: MarketAsset | undefined;
  marketRegime: MarketRegime | null;
  config: ScoringConfig;
}): OpportunityScore {
  const sectorModel = config.sectorModels[asset.sector] ?? config.sectorModels.Other ?? { technicalMultiplier: 1, riskMultiplier: 1, description: "No sector model supplied." };
  const rawTechnical = calculateTechnicalScore(analyses, config);
  const technical = { ...rawTechnical, score: round(clamp(rawTechnical.score * sectorModel.technicalMultiplier, 0, 40)) };
  const momentum = calculateMomentumScore(asset, btc);
  const sectorSafety = calculateSectorScore(asset, universe);
  const riskSafety = round(clamp(calculateRiskSafety(asset, analyses, config) * sectorModel.riskMultiplier));
  const availableComponents = [
    { raw: technical.score / 40, weight: config.weights.technical, label: "Technical" },
    { raw: momentum / 20, weight: config.weights.momentum, label: "Market momentum" },
    ...(sectorSafety === null ? [] : [{ raw: sectorSafety / 100, weight: config.weights.sector, label: "Sector relative strength" }]),
    { raw: riskSafety / 100, weight: config.weights.riskLiquidity, label: "Liquidity and risk" },
  ];
  const activeWeight = availableComponents.reduce((sum, component) => sum + component.weight, 0);
  const baseScore = activeWeight ? availableComponents.reduce((sum, component) => sum + component.raw * component.weight, 0) / activeWeight * 100 : 0;
  const regimeAdjustment = marketRegime?.classification === "RISK ON" ? 2 : marketRegime?.classification === "RISK OFF" ? -5 : 0;
  const score = round(clamp(baseScore + regimeAdjustment));
  const coverage = analyses.length / Object.values(config.timeframes).filter(timeframe => timeframe.enabled).length * 100;
  const agreement = analyses.length ? analyses.filter(analysis => analysis.bias === (technical.alignment >= 58 ? "bullish" : technical.alignment <= 42 ? "bearish" : "neutral")).length / analyses.length * 100 : 0;
  const confidence = round(clamp(coverage * 0.35 + agreement * 0.3 + riskSafety * 0.25 + (marketRegime?.score ?? 50) * 0.1));
  const direction = technical.score >= 25 && momentum >= 11 ? "bullish" : technical.score <= 13 ? "bearish" : "neutral";
  const riskLevel = riskSafety >= 72 ? "low" : riskSafety >= 48 ? "moderate" : "high";
  const setup = setupType(analyses);
  const timeframeReasons = analyses.flatMap(analysis => analysis.reasons.map(reason => ({ ...reason, key: `${analysis.timeframe}-${reason.key}`, label: `${analysis.timeframe.toUpperCase()} — ${reason.label}` })));
  const reasons: ScoreReason[] = [
    scoreReason("technical", "Technical aggregation", technical.score, 40, technical.score >= 25 ? "positive" : technical.score <= 13 ? "negative" : "neutral", `Weighted technical contribution is ${technical.score}/40; multi-timeframe consistency is ${technical.alignment}/100.`),
    scoreReason("momentum", "BTC-relative momentum", momentum, 20, momentum >= 12 ? "positive" : momentum < 8 ? "negative" : "neutral", `The momentum component compares 1h, 24h, and 7d return behavior with BTC.`),
    scoreReason("risk", "Liquidity and volatility safety", riskSafety, 100, riskSafety >= 70 ? "positive" : riskSafety < 48 ? "negative" : "neutral", `Safety reflects market capitalization, volume-to-market-cap, and ATR volatility context.`),
    ...(sectorSafety === null ? [] : [scoreReason("sector", "Sector-relative strength", sectorSafety, 100, sectorSafety >= 60 ? "positive" : sectorSafety < 40 ? "negative" : "neutral", `The asset is measured against the tracked ${asset.sector} peer group. The ${asset.sector} model currently applies technical ×${sectorModel.technicalMultiplier} and risk ×${sectorModel.riskMultiplier}; these are configurable research hypotheses.`)]),
    ...(marketRegime ? [scoreReason("regime", `Market regime: ${marketRegime.classification}`, marketRegime.score, 100, marketRegime.classification === "RISK ON" ? "positive" : marketRegime.classification === "RISK OFF" ? "negative" : "neutral", `Regime supplies a bounded ${regimeAdjustment >= 0 ? "+" : ""}${regimeAdjustment} point adjustment after component normalization.`)] : []),
    ...timeframeReasons,
  ];
  const missingConditions = [
    ...(analyses.length < Object.values(config.timeframes).filter(timeframe => timeframe.enabled).length ? ["One or more enabled timeframes did not have sufficient current OHLCV data."] : []),
    ...(technical.alignment < 58 ? ["Multi-timeframe bullish agreement is not yet strong."] : []),
    ...(riskSafety < 65 ? ["Liquidity or volatility safety remains below the preferred range."] : []),
    ...(marketRegime?.classification === "RISK OFF" ? ["The prevailing market regime is Risk Off, so the score includes a defensive penalty."] : []),
    ...(setup === "No Setup" ? ["No recognized price-action setup is currently confirmed."] : []),
  ];
  const strongest = reasons.filter(reason => reason.direction === "positive").sort((a, b) => b.score / b.maxScore - a.score / a.maxScore).slice(0, 3);
  const explanation = strongest.length
    ? `${asset.symbol} is ranked from its live, timestamped inputs: ${strongest.map(reason => reason.label.toLowerCase()).join(", ")}. The current setup is classified as ${setup.toLowerCase()}; ${missingConditions.length ? `remaining gaps include ${missingConditions[0].toLowerCase()}` : "the configured confirmation checks are currently satisfied"}.`
    : `${asset.symbol} has insufficient positive, current score components to support an opportunity narrative.`;
  return {
    score, confidence, technicalScore: technical.score, momentumScore: momentum, sectorScore: sectorSafety, riskScore: riskSafety, setupType: setup, direction, riskLevel,
    technicalByTimeframe: analyses, multiTimeframeScore: technical.alignment, reasons, missingConditions, explanation,
  };
}

export function assetFromProfile(profile: AssetProfile): MarketAsset {
  return { ...profile, price: null, marketCap: null, marketCapRank: null, volume24h: null, change1h: null, change24h: null, change7d: null, lastUpdatedAt: null, provider: "Unavailable" };
}
