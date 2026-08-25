import { DEFAULT_ASSET_UNIVERSE, DEFAULT_SCORING_CONFIG, SUPPORTED_TIMEFRAMES, type DataStatus, type MarketAsset, type ScannerResponse, type ScoringConfig, type TimeframeAnalysis } from "../../shared/crypto";
import { analyzeTimeframe } from "./technical";
import { fetchBinanceDerivatives, fetchCoinGeckoGlobal, fetchCoinGeckoMarkets, fetchValidatedLiveOhlcvBundle, type LiveOhlcvBundle, unavailableStatus } from "./providers";
import { assetFromProfile, buildOpportunityScore, calculateMarketRegime } from "./scoring";
import { persistScannerSnapshot } from "./persistence";

const cachedScans = new Map<string, { value: ScannerResponse; expiresAt: number }>();
const scannerBundles = new WeakMap<ScannerResponse, Map<string, LiveOhlcvBundle>>();

export function getScannerLiveOhlcvBundle(scan: ScannerResponse, symbol: string) {
  return scannerBundles.get(scan)?.get(symbol) ?? null;
}

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
    const bundle = await fetchValidatedLiveOhlcvBundle(asset.symbol, [...SUPPORTED_TIMEFRAMES], minimumCandles);
    dataStatus.push(...bundle.statuses);
    const firstUnavailable = bundle.timeframes.find(timeframe => !timeframe.eligibleForScoring);
    dataStatus.push({
      source: "Live OHLCV provider bundle",
      provider: bundle.provider ?? "Provider-neutral validation",
      symbol: asset.symbol,
      capability: "OHLCV",
      status: bundle.state === "VALID" ? "live" : bundle.state === "STALE" ? "stale" : "unavailable",
      fetchedAt: generatedAt,
      message: bundle.statusMessage,
      errorClass: bundle.state === "INCOHERENT" ? "MIXED_PROVIDER_PREVENTED" : firstUnavailable?.errorClass ?? undefined,
      normalizationVersion: "live-ohlcv-normalization-v1",
      dataQuality: bundle.state,
    });
    const analyses: TimeframeAnalysis[] = [];
    if (bundle.eligibleForScoring) {
      SUPPORTED_TIMEFRAMES.forEach(timeframe => {
        const series = bundle.seriesByTimeframe[timeframe];
        if (series) {
          const analysis = analyzeTimeframe(series.candles, timeframe, config);
        if (analysis) analyses.push(analysis);
          else dataStatus.push({ source: `${series.provider} OHLCV`, provider: series.provider, symbol: series.symbol, timeframe, capability: "OHLCV", normalizationVersion: series.normalizationVersion, dataQuality: "INSUFFICIENT", errorClass: "INSUFFICIENT_CANDLES", status: "unavailable", fetchedAt: generatedAt, message: "Validated candles were insufficient for the configured indicators." });
        }
      });
    }
    const derivatives = await fetchBinanceDerivatives(asset.binanceSymbol);
    dataStatus.push(...derivatives.statuses);
    return { asset, analyses, dataStatus, bundle, fundingRate: derivatives.fundingRate, openInterest: derivatives.openInterest };
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
  scannerBundles.set(scan, new Map(provisional.map(item => [item.asset.symbol, item.bundle])));
  cachedScans.set(cacheKey, { value: scan, expiresAt: Date.now() + 60_000 });
  void persistScannerSnapshot(scan);
  return scan;
}
