import type { DataStatus, ScannerResponse, ScannerRow, ScoringConfig, Timeframe } from "../../shared/crypto";
import { DEFAULT_SCORING_CONFIG, SUPPORTED_TIMEFRAMES } from "../../shared/crypto";
import { buildLiveScanner, getScannerLiveOhlcvBundle } from "./marketService";
import { fetchValidatedLiveOhlcv } from "./providers";
import { buildTechnicalChartSeries } from "./technical";
import { getTradeSetupForRow } from "./tradeSetup";
import { buildOpportunityDiscoveryItem } from "./opportunityDiscovery";

export type PresentationState = "CURRENT" | "DELAYED" | "STALE" | "UNAVAILABLE";

function presentationState(statuses: DataStatus[], fallbackTimestamp: number | null): PresentationState {
  if (statuses.some(status => status.status === "unavailable")) return "UNAVAILABLE";
  if (statuses.some(status => status.status === "stale")) return "STALE";
  if (fallbackTimestamp !== null && Date.now() - fallbackTimestamp > 15 * 60_000) return "DELAYED";
  return "CURRENT";
}

function analysisFor(score: ScannerRow["score"], timeframe: Timeframe) {
  return score?.technicalByTimeframe.find(item => item.timeframe === timeframe) ?? null;
}

export function buildExplainabilityPresentation(scan: ScannerResponse, row: ScannerRow, requestedTimeframe: Timeframe, chart: Awaited<ReturnType<typeof fetchValidatedLiveOhlcv>>, config: ScoringConfig) {
  const score = row.score;
  const selectedAnalysis = analysisFor(score, requestedTimeframe);
  const chartStatuses = chart.statuses;
  const sourceTimestamp = chart.series?.retrievedAt ?? row.asset.lastUpdatedAt;
  const allStatuses = [...scan.dataStatus, ...row.dataStatus, ...chartStatuses];
  const dataStatus = presentationState(allStatuses, sourceTimestamp);
  const chartReason = chart.series ? null : chartStatuses.map(status => status.message ?? status.errorClass).filter(Boolean).join(" · ") || "No validated current candle window is available for the selected timeframe.";
  const evidence = score?.reasons ?? [];
  const technicalRows = SUPPORTED_TIMEFRAMES.map(timeframe => {
    const analysis = analysisFor(score, timeframe);
    return analysis ? {
      timeframe,
      state: analysis.bias.toUpperCase(),
      overall: analysis.bias.toUpperCase(),
      trend: analysis.bias.toUpperCase(),
      rsi: analysis.rsi,
      macdHistogram: analysis.macdHistogram,
      maStructure: analysis.reasons.find(reason => reason.key === "ema")?.label ?? "UNAVAILABLE",
      volume: analysis.volumeExpansion,
      score: analysis.score,
      maxScore: analysis.maxScore,
      reasons: analysis.reasons,
    } : { timeframe, state: "UNAVAILABLE", overall: "UNAVAILABLE", trend: "UNAVAILABLE", rsi: null, macdHistogram: null, maStructure: "UNAVAILABLE", volume: null, score: null, maxScore: null, reasons: [] };
  });
  return {
    generatedAt: scan.generatedAt,
    asset: row.asset,
    score,
    header: {
      primaryTimeframe: selectedAnalysis?.timeframe ?? score?.technicalByTimeframe.at(0)?.timeframe ?? requestedTimeframe,
      marketProvider: row.asset.provider,
      marketTimestamp: row.asset.lastUpdatedAt,
      marketState: presentationState(scan.dataStatus, row.asset.lastUpdatedAt),
      ohlcvProvider: chart.series?.provider ?? null,
      ohlcvTimestamp: chart.series?.retrievedAt ?? null,
      ohlcvState: presentationState(chartStatuses, sourceTimestamp),
      normalizationVersion: chart.series?.normalizationVersion ?? null,
      dataStatus,
      lastValidatedAt: sourceTimestamp,
    },
    explainability: {
      positive: evidence.filter(reason => reason.direction === "positive"),
      neutral: evidence.filter(reason => reason.direction === "neutral"),
      risk: evidence.filter(reason => reason.direction === "negative"),
      unavailable: score ? score.missingConditions : ["Opportunity Score is unavailable because current validated inputs are incomplete."],
      components: evidence,
    },
    technical: {
      selectedTimeframe: requestedTimeframe,
      selectedAnalysis,
      matrix: technicalRows,
      checklist: selectedAnalysis?.reasons.map(reason => ({ label: reason.label, state: reason.direction === "positive" ? "CONFIRMED" : reason.direction === "negative" ? "NOT CONFIRMED" : "UNAVAILABLE", detail: reason.detail, contribution: reason.score, maximum: reason.maxScore })) ?? [],
      chart: chart.series ? { provider: chart.series.provider, symbol: chart.series.symbol, timeframe: chart.series.timeframe, retrievedAt: chart.series.retrievedAt, lastValidatedAt: chart.series.retrievedAt, reason: null, candles: buildTechnicalChartSeries(chart.series.candles, config), status: presentationState(chartStatuses, chart.series.retrievedAt) } : { provider: null, symbol: null, timeframe: requestedTimeframe, retrievedAt: null, lastValidatedAt: null, reason: chartReason, candles: [], status: "UNAVAILABLE" as const },
    },
    risk: {
      atrPercent: selectedAnalysis?.atrPercent ?? null,
      volatilityState: score?.riskLevel ?? "UNAVAILABLE",
      support: null,
      resistance: null,
      stop: null,
      target: null,
      rewardRisk: null,
    },
    context: {
      marketRegime: scan.marketRegime,
      sector: row.asset.sector,
      sectorRelativeStrength: score?.sectorScore ?? null,
      marketMomentum: score?.momentumScore ?? null,
      catalyst: { state: "UNAVAILABLE" as const, message: "No verified catalyst or rumor source is persisted in the current production data model." },
    },
    provenance: {
      scannerGeneratedAt: scan.generatedAt,
      dataStatuses: allStatuses,
      selectedTimeframe: requestedTimeframe,
      datasetVersion: null,
    },
  };
}

export async function getAssetIntelligence(assetId: string, timeframe: Timeframe, config: ScoringConfig = DEFAULT_SCORING_CONFIG) {
  const scan = await buildLiveScanner(false, config);
  const row = scan.rows.find(candidate => candidate.asset.id === assetId);
  if (!row) throw new Error("Tracked asset was not found in the current scanner universe.");
  const minimumCandles = Math.max(config.indicator.emaSlow + 2, config.indicator.macdSlow + config.indicator.macdSignal + 2, 60);
  const [chart, swingPlan] = await Promise.all([
    fetchValidatedLiveOhlcv(row.asset.symbol, timeframe, minimumCandles),
    getTradeSetupForRow("SWING", row, scan.marketRegime, config, minimumCandles, getScannerLiveOhlcvBundle(scan, row.asset.symbol)),
  ]);
  return { ...buildExplainabilityPresentation(scan, row, timeframe, chart, config), currentSetup: buildOpportunityDiscoveryItem(swingPlan) };
}
