import { DEFAULT_ASSET_UNIVERSE, DEFAULT_SCORING_CONFIG, SUPPORTED_TIMEFRAMES, type DataStatus, type MarketAsset, type ScannerResponse, type ScoringConfig, type TimeframeAnalysis } from "../../shared/crypto";
import { analyzeTimeframe } from "./technical";
import { fetchBinanceDerivatives, fetchCoinGeckoGlobal, fetchCoinGeckoMarkets, fetchValidatedLiveOhlcv, unavailableStatus } from "./providers";
import { assetFromProfile, buildOpportunityScore, calculateMarketRegime } from "./scoring";
import { persistScannerSnapshot } from "./persistence";

const cachedScans = new Map<string, { value: ScannerResponse; expiresAt: number }>();

async function mapConcurrent<T, R>(items: T[], limit: number, operation: (item: T) => Promise<R>): Promise<R[]> {
  const results = Array<R>(items.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const current = cursor++;
      results[current] = await operation(items[current]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export function hasMixedLiveOhlcvProviders(results: Array<{ series: { provider: string } | null }>) {
  return new Set(results.flatMap(result => result.series ? [result.series.provider] : [])).size > 1;
}

export async function buildLiveScanner(forceRefresh = false, config: ScoringConfig = DEFAULT_SCORING_CONFIG): Promise<ScannerResponse> {
  const cacheKey = JSON.stringify(config);
  const cachedScan = cachedScans.get(cacheKey);
  if (!forceRefresh && cachedScan && cachedScan.expiresAt > Date.now()) return cachedScan.value;
  const generatedAt = Date.now();
  const statuses: DataStatus[] = [];
  let universe: MarketAsset[];
  try {
    const marketResponse = await fetchCoinGeckoMarkets(DEFAULT_ASSET_UNIVERSE);
    universe = marketResponse.markets;
    statuses.push(marketResponse.status);
  } catch (error) {
    universe = DEFAULT_ASSET_UNIVERSE.map(assetFromProfile);
    statuses.push(unavailableStatus("CoinGecko markets", error));
  }
  let global = null;
  try {
    global = await fetchCoinGeckoGlobal();
    statuses.push({ source: "CoinGecko global market", status: "live", fetchedAt: generatedAt });
  } catch (error) {
    statuses.push(unavailableStatus("CoinGecko global market", error));
  }
  const marketRegime = calculateMarketRegime(universe.find(asset => asset.symbol === "BTC"), universe, global);
  const provisional = await mapConcurrent(universe, 3, async asset => {
    const dataStatus: DataStatus[] = [];
    const minimumCandles = Math.max(config.indicator.emaSlow + 2, config.indicator.macdSlow + config.indicator.macdSignal + 2, 60);
    const timeframeResults = await Promise.all(SUPPORTED_TIMEFRAMES.map(timeframe => fetchValidatedLiveOhlcv(asset.symbol, timeframe, minimumCandles)));
    const analyses: TimeframeAnalysis[] = [];
    const mixedProviders = hasMixedLiveOhlcvProviders(timeframeResults);
    if (mixedProviders) dataStatus.push({ source: "Live OHLCV provider consistency", provider: "Provider-neutral validation", symbol: asset.symbol, capability: "OHLCV", status: "unavailable", fetchedAt: generatedAt, message: "Validated OHLCV was available from more than one provider across required timeframes; cross-provider scoring was prevented.", errorClass: "MIXED_PROVIDER_PREVENTED", normalizationVersion: "live-ohlcv-normalization-v1", dataQuality: "UNAVAILABLE" });
    timeframeResults.forEach((result, index) => {
      const timeframe = SUPPORTED_TIMEFRAMES[index];
      dataStatus.push(...result.statuses);
      if (result.series && !mixedProviders) {
        const analysis = analyzeTimeframe(result.series.candles, timeframe, config);
        if (analysis) analyses.push(analysis);
        else dataStatus.push({ source: `${result.series.provider} OHLCV`, provider: result.series.provider, symbol: result.series.symbol, timeframe, capability: "OHLCV", normalizationVersion: result.series.normalizationVersion, dataQuality: "UNAVAILABLE", errorClass: "VALIDATION_FAILED", status: "unavailable", fetchedAt: generatedAt, message: "Validated candles were insufficient for the configured indicators." });
      }
    });
    const derivatives = await fetchBinanceDerivatives(asset.binanceSymbol);
    dataStatus.push(...derivatives.statuses);
    return { asset, analyses, dataStatus, fundingRate: derivatives.fundingRate, openInterest: derivatives.openInterest };
  });
  const btc = universe.find(asset => asset.symbol === "BTC");
  const rows = provisional.map(item => ({
    asset: item.asset,
    score: item.analyses.length ? buildOpportunityScore({ asset: item.asset, analyses: item.analyses, universe, btc, marketRegime, config }) : null,
    dataStatus: item.dataStatus,
    fundingRate: item.fundingRate,
    openInterest: item.openInterest,
  })).sort((left, right) => (right.score?.score ?? -1) - (left.score?.score ?? -1));
  const scan: ScannerResponse = {
    generatedAt, dataStatus: statuses, marketRegime, rows,
    note: "Scores are derived from the visible live inputs and current configuration. They are research signals, not forecasts or trading instructions.",
  };
  cachedScans.set(cacheKey, { value: scan, expiresAt: Date.now() + 60_000 });
  void persistScannerSnapshot(scan);
  return scan;
}
