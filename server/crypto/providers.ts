import { strFromU8, unzipSync } from "fflate";
import type { AssetProfile, Candle, DataStatus, MarketAsset, Timeframe } from "../../shared/crypto";

const COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3";
const BINANCE_FUTURES_BASE_URL = "https://fapi.binance.com";
const KRAKEN_BASE_URL = "https://api.kraken.com/0/public";
const BINANCE_PUBLIC_ARCHIVE_BASE_URL = "https://data.binance.vision/data/futures/um/monthly/klines";
const BINANCE_PUBLIC_SPOT_ARCHIVE_BASE_URL = "https://data.binance.vision/data/spot/monthly/klines";
const BINANCE_PUBLIC_DAILY_ARCHIVE_BASE_URL = "https://data.binance.vision/data/futures/um/daily/klines";
const BINANCE_PUBLIC_SPOT_DAILY_ARCHIVE_BASE_URL = "https://data.binance.vision/data/spot/daily/klines";
const DAILY_ARCHIVE_FALLBACK_WINDOW_MS = 62 * 24 * 60 * 60_000;

type CoinGeckoMarketResponse = {
  id: string;
  symbol: string;
  name: string;
  current_price?: number;
  market_cap?: number;
  market_cap_rank?: number;
  total_volume?: number;
  price_change_percentage_1h_in_currency?: number;
  price_change_percentage_24h_in_currency?: number;
  price_change_percentage_7d_in_currency?: number;
  last_updated?: string;
};

export type GlobalMarketContext = {
  btcDominance: number | null;
  totalMarketChange24h: number | null;
  updatedAt: number | null;
};

export type DerivativesContext = {
  fundingRate: number | null;
  openInterest: number | null;
  statuses: DataStatus[];
};

export type HistoricalFundingRate = {
  symbol: string;
  fundingRate: number;
  fundingTime: number;
  markPrice: number | null;
  rateType: string | null;
};

export class ProviderError extends Error {
  constructor(public source: string, message: string, public errorClass: NonNullable<DataStatus["errorClass"]> = "PROVIDER_REQUEST_FAILED") {
    super(message);
  }
}

export type LiveDataQualityState = NonNullable<DataStatus["dataQuality"]>;

function qualityForErrorClass(errorClass: NonNullable<DataStatus["errorClass"]>): LiveDataQualityState {
  if (errorClass === "STALE_DATA") return "STALE";
  if (errorClass === "INSUFFICIENT_CANDLES") return "INSUFFICIENT";
  if (errorClass === "MIXED_PROVIDER_PREVENTED") return "INCOHERENT";
  if (errorClass === "PROVIDER_UNAVAILABLE_REGION_RESTRICTION") return "PROVIDER_UNAVAILABLE";
  if (errorClass === "PROVIDER_TIMEOUT" || errorClass === "PROVIDER_RATE_LIMITED" || errorClass === "PROVIDER_REQUEST_FAILED") return "NO_DATA";
  return "INVALID";
}

async function getJson<T>(url: string, source: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!response.ok) throw new ProviderError(source, `${source} returned HTTP ${response.status}.`, response.status === 451 ? "PROVIDER_UNAVAILABLE_REGION_RESTRICTION" : response.status === 429 ? "PROVIDER_RATE_LIMITED" : "PROVIDER_REQUEST_FAILED");
    try {
      return await response.json() as T;
    } catch {
      throw new ProviderError(source, `${source} returned an invalid JSON response.`, "PROVIDER_INVALID_RESPONSE");
    }
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    const message = error instanceof Error ? error.message : "Unknown provider error.";
    throw new ProviderError(source, message.includes("abort") ? `${source} timed out.` : message, message.includes("abort") ? "PROVIDER_TIMEOUT" : "PROVIDER_REQUEST_FAILED");
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchCoinGeckoMarkets(assets: AssetProfile[]): Promise<{ markets: MarketAsset[]; status: DataStatus }> {
  const now = Date.now();
  const ids = assets.map(asset => asset.id).join(",");
  const params = new URLSearchParams({
    vs_currency: "usd",
    ids,
    order: "market_cap_desc",
    per_page: String(assets.length),
    page: "1",
    sparkline: "false",
    price_change_percentage: "1h,24h,7d",
  });
  const payload = await getJson<CoinGeckoMarketResponse[]>(`${COINGECKO_BASE_URL}/coins/markets?${params}`, "CoinGecko");
  const byId = new Map(payload.map(item => [item.id, item]));
  const markets = assets.map(asset => {
    const item = byId.get(asset.id);
    return {
      ...asset,
      price: item?.current_price ?? null,
      marketCap: item?.market_cap ?? null,
      marketCapRank: item?.market_cap_rank ?? null,
      volume24h: item?.total_volume ?? null,
      change1h: item?.price_change_percentage_1h_in_currency ?? null,
      change24h: item?.price_change_percentage_24h_in_currency ?? null,
      change7d: item?.price_change_percentage_7d_in_currency ?? null,
      lastUpdatedAt: item?.last_updated ? Date.parse(item.last_updated) : null,
      provider: "CoinGecko",
    };
  });
  return { markets, status: { source: "CoinGecko markets", status: "live", fetchedAt: now } };
}

export async function fetchCoinGeckoGlobal(): Promise<GlobalMarketContext> {
  type GlobalResponse = { data?: { market_cap_percentage?: { btc?: number }; market_cap_change_percentage_24h_usd?: number; updated_at?: number } };
  const payload = await getJson<GlobalResponse>(`${COINGECKO_BASE_URL}/global`, "CoinGecko global market");
  return {
    btcDominance: payload.data?.market_cap_percentage?.btc ?? null,
    totalMarketChange24h: payload.data?.market_cap_change_percentage_24h_usd ?? null,
    updatedAt: payload.data?.updated_at ? payload.data.updated_at * 1000 : null,
  };
}

export type HistoricalMarketChart = {
  prices: Array<[number, number]>;
  marketCaps: Array<[number, number]>;
  totalVolumes: Array<[number, number]>;
  source: "CoinGecko market chart";
};

export async function fetchCoinGeckoHistoricalMarketChart(coinId: string, days = 365): Promise<HistoricalMarketChart> {
  type Response = { prices?: Array<[number, number]>; market_caps?: Array<[number, number]>; total_volumes?: Array<[number, number]> };
  const params = new URLSearchParams({ vs_currency: "usd", days: String(days), interval: "daily" });
  const payload = await getJson<Response>(`${COINGECKO_BASE_URL}/coins/${coinId}/market_chart?${params}`, "CoinGecko historical market chart");
  const normalize = (values: Array<[number, number]> | undefined) => (values ?? []).flatMap(value => Array.isArray(value) && Number.isFinite(value[0]) && Number.isFinite(value[1]) ? [[Number(value[0]), Number(value[1])] as [number, number]] : []);
  return { prices: normalize(payload.prices), marketCaps: normalize(payload.market_caps), totalVolumes: normalize(payload.total_volumes), source: "CoinGecko market chart" };
}

export function normalizeBinanceCandles(payload: unknown): Candle[] {
  if (!Array.isArray(payload)) return [];
  return payload.flatMap(row => {
    if (!Array.isArray(row) || row.length < 7) return [];
    const [openTime, open, high, low, close, volume, closeTime] = row;
    const normalized = { openTime: Number(openTime), closeTime: Number(closeTime), open: Number(open), high: Number(high), low: Number(low), close: Number(close), volume: Number(volume) };
    return Object.values(normalized).every(Number.isFinite) ? [normalized] : [];
  });
}

export async function fetchBinanceCandles(symbol: string, timeframe: Timeframe, limit = 240, startTime?: number, endTime?: number): Promise<Candle[]> {
  const params = new URLSearchParams({ symbol, interval: timeframe, limit: String(limit) });
  if (startTime) params.set("startTime", String(startTime));
  if (endTime) params.set("endTime", String(endTime));
  const payload = await getJson<unknown>(`${BINANCE_FUTURES_BASE_URL}/fapi/v1/klines?${params}`, "Binance Futures OHLCV");
  if (!Array.isArray(payload)) throw new ProviderError("Binance Futures OHLCV", "Unexpected candle response format.");
  return normalizeBinanceCandles(payload);
}

export const LIVE_OHLCV_NORMALIZATION_VERSION = "live-ohlcv-normalization-v1";
const KRAKEN_PAIR_BY_SYMBOL: Record<string, string> = { BTC: "BTC/USD", ETH: "ETH/USD", SOL: "SOL/USD", LINK: "LINK/USD", AVAX: "AVAX/USD", SUI: "SUI/USD", UNI: "UNI/USD", AAVE: "AAVE/USD", DOGE: "DOGE/USD", ADA: "ADA/USD", XRP: "XRP/USD", DOT: "DOT/USD" };
const KRAKEN_INTERVAL_BY_TIMEFRAME: Record<Timeframe, number> = { "15m": 15, "1h": 60, "4h": 240, "1d": 1440 };
const TIMEFRAME_MS: Record<Timeframe, number> = { "15m": 15 * 60_000, "1h": 60 * 60_000, "4h": 4 * 60 * 60_000, "1d": 24 * 60 * 60_000 };

export type NormalizedLiveOhlcvSeries = {
  provider: "Binance Futures" | "Kraken Spot";
  symbol: string;
  timeframe: Timeframe;
  retrievedAt: number;
  normalizationVersion: typeof LIVE_OHLCV_NORMALIZATION_VERSION;
  dataQuality: "VALID";
  candles: Candle[];
};

export type LiveOhlcvFetchResult = { series: NormalizedLiveOhlcvSeries | null; statuses: DataStatus[] };
export type LiveOhlcvMonitorOptions = { forceBinance451?: boolean; forceKrakenUnavailable?: boolean };
export type LiveOhlcvTimeframeStatus = {
  timeframe: Timeframe;
  provider: "Binance Futures" | "Kraken Spot" | null;
  symbol: string | null;
  state: LiveDataQualityState;
  status: DataStatus["status"];
  fetchedAt: number | null;
  candleCount: number;
  oldestCandleAt: number | null;
  newestCandleAt: number | null;
  freshnessMs: number | null;
  eligibleForScoring: boolean;
  message: string | null;
  errorClass: DataStatus["errorClass"] | null;
};
export type LiveOhlcvBundle = {
  symbol: string;
  requiredTimeframes: Timeframe[];
  provider: "Binance Futures" | "Kraken Spot" | null;
  providerSymbol: string | null;
  state: LiveDataQualityState;
  coherent: boolean;
  eligibleForScoring: boolean;
  statusMessage: string;
  seriesByTimeframe: Partial<Record<Timeframe, NormalizedLiveOhlcvSeries>>;
  timeframes: LiveOhlcvTimeframeStatus[];
  statuses: DataStatus[];
};

export function getApprovedKrakenMappings() {
  return { mappings: { ...KRAKEN_PAIR_BY_SYMBOL }, intervals: { ...KRAKEN_INTERVAL_BY_TIMEFRAME }, historicalDepth: "UP_TO_720_RECENT_CANDLES", freshnessLimit: "VALIDATED_BY_COMPLETE_CANDLE_TIMESTAMP", requestConstraint: "PUBLIC_ENDPOINT_RATE_LIMITS_UNKNOWN_AT_RUNTIME" };
}

function ohlcvStatus(input: Omit<DataStatus, "fetchedAt" | "normalizationVersion" | "capability"> & { fetchedAt?: number }): DataStatus {
  return { fetchedAt: input.fetchedAt ?? Date.now(), capability: "OHLCV", normalizationVersion: LIVE_OHLCV_NORMALIZATION_VERSION, ...input };
}

function validationError(errorClass: NonNullable<DataStatus["errorClass"]>, message: string) {
  return new ProviderError("Live OHLCV validation", message, errorClass);
}

export function validateNormalizedLiveOhlcv(candles: Candle[], timeframe: Timeframe, retrievedAt: number, minimumCandles: number): Candle[] {
  const interval = TIMEFRAME_MS[timeframe];
  const completed = candles.filter(candle => candle.closeTime < retrievedAt);
  if (completed.length < minimumCandles) throw validationError("INSUFFICIENT_CANDLES", `Only ${completed.length} complete ${timeframe} candles were returned; ${minimumCandles} are required.`);
  let previousOpen = -1;
  for (const candle of completed) {
    if (![candle.openTime, candle.closeTime, candle.open, candle.high, candle.low, candle.close, candle.volume].every(Number.isFinite)) throw validationError("VALIDATION_FAILED", "A candle contains a non-finite field.");
    if (candle.openTime % interval !== 0 || candle.closeTime !== candle.openTime + interval - 1) throw validationError("TIMESTAMP_CORRUPTION", `Candle timestamps do not match ${timeframe}.`);
    if (candle.open <= 0 || candle.high <= 0 || candle.low <= 0 || candle.close <= 0 || candle.high < Math.max(candle.open, candle.close) || candle.low > Math.min(candle.open, candle.close)) throw validationError("VALIDATION_FAILED", "A candle has invalid OHLC bounds.");
    if (candle.volume <= 0) throw validationError("MISSING_VOLUME", "A candle has missing or zero volume.");
    if (previousOpen >= 0 && candle.openTime !== previousOpen + interval) throw validationError("TIMEFRAME_MISMATCH", "The candle series spacing does not match the requested timeframe.");
    previousOpen = candle.openTime;
  }
  const retained = completed.slice(-minimumCandles);
  const newest = retained.at(-1);
  if (!newest || retrievedAt - newest.closeTime > interval * 3) throw validationError("STALE_DATA", `The newest complete ${timeframe} candle is older than the existing three-interval freshness allowance.`);
  return retained;
}

type KrakenOhlcPayload = { error?: string[]; result?: Record<string, unknown> };

export function normalizeKrakenCandles(payload: KrakenOhlcPayload, expectedPair: string, timeframe: Timeframe): Candle[] {
  if (payload.error?.length) throw new ProviderError("Kraken Spot OHLCV", payload.error.join("; "));
  const entries = Object.entries(payload.result ?? {}).filter(([key]) => key !== "last");
  if (entries.length !== 1 || entries[0][0] !== expectedPair) throw validationError("SYMBOL_MAPPING_MISMATCH", `Kraken returned ${entries.map(([key]) => key).join(",") || "no pair"} for expected ${expectedPair}.`);
  const records = entries[0][1];
  if (!Array.isArray(records)) throw validationError("VALIDATION_FAILED", "Kraken OHLC payload is not an array.");
  const interval = TIMEFRAME_MS[timeframe];
  return records.map(record => {
    if (!Array.isArray(record) || record.length < 8) throw validationError("VALIDATION_FAILED", "Kraken returned a malformed OHLC row.");
    const openTime = Number(record[0]) * 1_000;
    const [open, high, low, close, volume] = [record[1], record[2], record[3], record[4], record[6]].map(Number);
    return { openTime, closeTime: openTime + interval - 1, open, high, low, close, volume };
  });
}

function unavailableOhlcvStatus(provider: string, symbol: string, timeframe: Timeframe, error: unknown): DataStatus {
  const typed = error instanceof ProviderError ? error : new ProviderError(provider, error instanceof Error ? error.message : "Provider request failed.");
  const dataQuality = qualityForErrorClass(typed.errorClass);
  return ohlcvStatus({ source: `${provider} OHLCV`, provider, symbol, timeframe, status: dataQuality === "STALE" ? "stale" : "unavailable", message: typed.message, errorClass: typed.errorClass, dataQuality });
}

function validOhlcvStatus(series: NormalizedLiveOhlcvSeries): DataStatus {
  return ohlcvStatus({ source: `${series.provider} OHLCV`, provider: series.provider, symbol: series.symbol, timeframe: series.timeframe, status: "live", dataQuality: "VALID", fetchedAt: series.retrievedAt });
}

export async function fetchValidatedLiveOhlcv(symbol: string, timeframe: Timeframe, minimumCandles: number, limit = 240, monitorOptions: LiveOhlcvMonitorOptions = {}): Promise<LiveOhlcvFetchResult> {
  const retrievedAt = Date.now();
  const statuses: DataStatus[] = [];
  try {
    if (monitorOptions.forceBinance451) throw new ProviderError("Binance Futures OHLCV", "Controlled monitor classification: Binance Futures HTTP 451.", "PROVIDER_UNAVAILABLE_REGION_RESTRICTION");
    const candles = validateNormalizedLiveOhlcv(await fetchBinanceCandles(`${symbol}USDT`, timeframe, limit), timeframe, retrievedAt, minimumCandles);
    const series: NormalizedLiveOhlcvSeries = { provider: "Binance Futures", symbol: `${symbol}USDT`, timeframe, retrievedAt, normalizationVersion: LIVE_OHLCV_NORMALIZATION_VERSION, dataQuality: "VALID", candles };
    statuses.push(validOhlcvStatus(series));
    return { series, statuses };
  } catch (error) {
    statuses.push(unavailableOhlcvStatus("Binance Futures", `${symbol}USDT`, timeframe, error));
    if (!(error instanceof ProviderError) || error.errorClass !== "PROVIDER_UNAVAILABLE_REGION_RESTRICTION") return { series: null, statuses };
  }
  const pair = KRAKEN_PAIR_BY_SYMBOL[symbol];
  if (!pair) {
    statuses.push(ohlcvStatus({ source: "Kraken Spot OHLCV", provider: "Kraken Spot", symbol, timeframe, status: "unavailable", message: `No approved Kraken mapping exists for ${symbol}.`, errorClass: "SYMBOL_MAPPING_MISMATCH", dataQuality: "INVALID" }));
    return { series: null, statuses };
  }
  try {
    if (monitorOptions.forceKrakenUnavailable) throw new ProviderError("Kraken Spot OHLCV", "Controlled monitor classification: Kraken unavailable.");
    const params = new URLSearchParams({ pair, interval: String(KRAKEN_INTERVAL_BY_TIMEFRAME[timeframe]), assetVersion: "1" });
    const payload = await getJson<KrakenOhlcPayload>(`${KRAKEN_BASE_URL}/OHLC?${params}`, "Kraken Spot OHLCV");
    const candles = validateNormalizedLiveOhlcv(normalizeKrakenCandles(payload, pair, timeframe), timeframe, retrievedAt, minimumCandles);
    const series: NormalizedLiveOhlcvSeries = { provider: "Kraken Spot", symbol: pair, timeframe, retrievedAt, normalizationVersion: LIVE_OHLCV_NORMALIZATION_VERSION, dataQuality: "VALID", candles };
    statuses.push(validOhlcvStatus(series));
    return { series, statuses };
  } catch (error) {
    statuses.push(unavailableOhlcvStatus("Kraken Spot", pair, timeframe, error));
    return { series: null, statuses };
  }
}

function describeTimeframe(timeframe: Timeframe, series: NormalizedLiveOhlcvSeries | null, status: DataStatus | undefined, now: number): LiveOhlcvTimeframeStatus {
  const candles = series?.candles ?? [];
  const newest = candles.at(-1) ?? null;
  return {
    timeframe,
    provider: series?.provider ?? (status?.provider === "Binance Futures" || status?.provider === "Kraken Spot" ? status.provider : null),
    symbol: series?.symbol ?? status?.symbol ?? null,
    state: series ? "VALID" : status?.dataQuality ?? "NO_DATA",
    status: series ? "live" : status?.status ?? "unavailable",
    fetchedAt: series?.retrievedAt ?? status?.fetchedAt ?? null,
    candleCount: candles.length,
    oldestCandleAt: candles[0]?.openTime ?? null,
    newestCandleAt: newest?.closeTime ?? null,
    freshnessMs: newest ? Math.max(0, now - newest.closeTime) : null,
    eligibleForScoring: Boolean(series),
    message: series ? null : status?.message ?? "No validated provider response was available.",
    errorClass: series ? null : status?.errorClass ?? null,
  };
}

function bundleFromAttempts(symbol: string, requiredTimeframes: Timeframe[], provider: "Binance Futures" | "Kraken Spot", attempts: Array<{ timeframe: Timeframe; result: LiveOhlcvFetchResult }>, statuses: DataStatus[], now: number, successMessage: string): LiveOhlcvBundle {
  const seriesByTimeframe: Partial<Record<Timeframe, NormalizedLiveOhlcvSeries>> = {};
  for (const attempt of attempts) if (attempt.result.series?.provider === provider) seriesByTimeframe[attempt.timeframe] = attempt.result.series;
  const allValid = requiredTimeframes.every(timeframe => Boolean(seriesByTimeframe[timeframe]));
  const timeframes = requiredTimeframes.map(timeframe => {
    const attempt = attempts.find(item => item.timeframe === timeframe)?.result;
    const matchingStatus = attempt?.statuses.find(item => item.provider === provider && item.status !== "live") ?? attempt?.statuses.at(-1);
    return describeTimeframe(timeframe, seriesByTimeframe[timeframe] ?? null, matchingStatus, now);
  });
  const firstUnavailable = timeframes.find(item => !item.eligibleForScoring);
  return {
    symbol,
    requiredTimeframes,
    provider: allValid ? provider : null,
    providerSymbol: allValid ? seriesByTimeframe[requiredTimeframes[0]]?.symbol ?? null : null,
    state: allValid ? "VALID" : firstUnavailable?.state ?? "NO_DATA",
    coherent: allValid,
    eligibleForScoring: allValid,
    statusMessage: allValid ? successMessage : firstUnavailable?.message ?? "The required provider bundle was unavailable.",
    seriesByTimeframe: allValid ? seriesByTimeframe : {},
    timeframes,
    statuses,
  };
}

async function fetchKrakenOnly(symbol: string, timeframe: Timeframe, minimumCandles: number, limit: number): Promise<LiveOhlcvFetchResult> {
  const retrievedAt = Date.now();
  const pair = KRAKEN_PAIR_BY_SYMBOL[symbol];
  if (!pair) return { series: null, statuses: [ohlcvStatus({ source: "Kraken Spot OHLCV", provider: "Kraken Spot", symbol, timeframe, status: "unavailable", message: `No approved Kraken mapping exists for ${symbol}.`, errorClass: "SYMBOL_MAPPING_MISMATCH", dataQuality: "INVALID" })] };
  try {
    const params = new URLSearchParams({ pair, interval: String(KRAKEN_INTERVAL_BY_TIMEFRAME[timeframe]), assetVersion: "1" });
    const payload = await getJson<KrakenOhlcPayload>(`${KRAKEN_BASE_URL}/OHLC?${params}`, "Kraken Spot OHLCV");
    const candles = validateNormalizedLiveOhlcv(normalizeKrakenCandles(payload, pair, timeframe), timeframe, retrievedAt, minimumCandles);
    const series: NormalizedLiveOhlcvSeries = { provider: "Kraken Spot", symbol: pair, timeframe, retrievedAt, normalizationVersion: LIVE_OHLCV_NORMALIZATION_VERSION, dataQuality: "VALID", candles };
    return { series, statuses: [validOhlcvStatus(series)] };
  } catch (error) {
    return { series: null, statuses: [unavailableOhlcvStatus("Kraken Spot", pair, timeframe, error)] };
  }
}

export async function fetchValidatedLiveOhlcvBundle(symbol: string, requiredTimeframes: Timeframe[], minimumCandles: number, limit = 240): Promise<LiveOhlcvBundle> {
  const now = Date.now();
  const primaryAttempts = await Promise.all(requiredTimeframes.map(async timeframe => ({ timeframe, result: await fetchValidatedLiveOhlcv(symbol, timeframe, minimumCandles, limit) })));
  const primaryStatuses = primaryAttempts.flatMap(item => item.result.statuses);
  const primarySeries = primaryAttempts.filter(item => item.result.series?.provider === "Binance Futures");
  if (primarySeries.length === requiredTimeframes.length) return bundleFromAttempts(symbol, requiredTimeframes, "Binance Futures", primaryAttempts, primaryStatuses, now, "All required timeframes were validated from Binance Futures.");
  const hasRegionRestriction = primaryStatuses.some(status => status.provider === "Binance Futures" && status.errorClass === "PROVIDER_UNAVAILABLE_REGION_RESTRICTION");
  if (primarySeries.length === 0 && hasRegionRestriction) {
    const bundle = bundleFromAttempts(symbol, requiredTimeframes, "Kraken Spot", primaryAttempts, primaryStatuses, now, "Binance Futures was regionally unavailable and Kraken Spot supplied the complete validated fallback bundle.");
    return bundle.eligibleForScoring ? bundle : { ...bundle, coherent: false, eligibleForScoring: false, statusMessage: "Binance Futures was regionally unavailable and Kraken Spot could not supply every required validated timeframe; no cross-provider series was constructed." };
  }
  if (!hasRegionRestriction) {
    const bundle = bundleFromAttempts(symbol, requiredTimeframes, "Binance Futures", primaryAttempts, primaryStatuses, now, "All required timeframes were validated from Binance Futures.");
    return { ...bundle, coherent: false, eligibleForScoring: false, state: bundle.state === "VALID" ? "INCOHERENT" : bundle.state, statusMessage: "A complete single-provider technical bundle was not available; no fallback is permitted for this failure class." };
  }
  const krakenAttempts = await Promise.all(requiredTimeframes.map(async timeframe => ({ timeframe, result: await fetchKrakenOnly(symbol, timeframe, minimumCandles, limit) })));
  const statuses = [...primaryStatuses, ...krakenAttempts.flatMap(item => item.result.statuses)];
  const bundle = bundleFromAttempts(symbol, requiredTimeframes, "Kraken Spot", krakenAttempts, statuses, now, "Binance Futures was regionally unavailable and Kraken Spot supplied the complete validated fallback bundle.");
  return bundle.eligibleForScoring ? bundle : { ...bundle, coherent: false, eligibleForScoring: false, statusMessage: "Binance Futures was regionally unavailable and Kraken Spot could not supply every required validated timeframe; no cross-provider series was constructed." };
}

function archiveMonths(endAt: number | undefined, timeframe: Timeframe, limit: number) {
  const interval = { "15m": 15 * 60_000, "1h": 60 * 60_000, "4h": 4 * 60 * 60_000, "1d": 24 * 60 * 60_000 }[timeframe];
  const monthsNeeded = Math.min(12, Math.max(1, Math.ceil(limit * interval / (30 * 24 * 60 * 60_000)) + 1));
  const anchor = new Date(endAt ?? Date.now());
  anchor.setUTCDate(1);
  anchor.setUTCHours(0, 0, 0, 0);
  anchor.setUTCMonth(anchor.getUTCMonth() - 1);
  return Array.from({ length: monthsNeeded }, (_, offset) => {
    const date = new Date(anchor);
    date.setUTCMonth(date.getUTCMonth() - offset);
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

export async function fetchBinanceArchiveCandles(symbol: string, timeframe: Timeframe, limit = 240, startTime?: number, endTime?: number): Promise<Candle[]> {
  const months = archiveMonths(endTime, timeframe, limit);
  const files = await Promise.all(months.map(async month => {
    const url = `${BINANCE_PUBLIC_ARCHIVE_BASE_URL}/${symbol}/${timeframe}/${symbol}-${timeframe}-${month}.zip`;
    const response = await fetch(url, { headers: { Accept: "application/zip" } });
    if (!response.ok) throw new ProviderError("Binance public archive", `Binance public archive returned HTTP ${response.status}.`);
    const archive = unzipSync(new Uint8Array(await response.arrayBuffer()));
    const csv = Object.entries(archive).find(([name]) => name.endsWith(".csv"))?.[1];
    if (!csv) throw new ProviderError("Binance public archive", "Archive did not contain a candle CSV file.");
    return strFromU8(csv).trim().split(/\r?\n/).flatMap(line => {
      const fields = line.split(",");
      const normalized = { openTime: Number(fields[0]), open: Number(fields[1]), high: Number(fields[2]), low: Number(fields[3]), close: Number(fields[4]), volume: Number(fields[5]), closeTime: Number(fields[6]) };
      return Object.values(normalized).every(Number.isFinite) ? [normalized] : [];
    });
  }));
  return files.flat().filter(candle => (!startTime || candle.openTime >= startTime) && (!endTime || candle.closeTime <= endTime)).sort((left, right) => left.openTime - right.openTime).slice(-limit);
}

function archiveMonthsInRange(startAt: number, endAt: number, maximumMonths = 48) {
  const cursor = new Date(startAt);
  cursor.setUTCDate(1);
  cursor.setUTCHours(0, 0, 0, 0);
  const end = new Date(endAt);
  end.setUTCDate(1);
  end.setUTCHours(0, 0, 0, 0);
  const months: string[] = [];
  while (cursor <= end && months.length < maximumMonths) {
    months.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

function normalizeArchiveTimestamp(value: number) {
  // Binance spot archive timestamps may be microseconds from 2025 onward; futures timestamps are milliseconds.
  return value > 10_000_000_000_000 ? Math.floor(value / 1_000) : value;
}

export type HistoricalArchiveInstrument = "spot" | "perpetual";
export type HistoricalArchiveResult = {
  candles: Candle[];
  source: "Binance public archive";
  unavailableMonths: string[];
  requestedMonths: string[];
  dailyFallbackDays: string[];
  unavailableDays: string[];
};

function parseArchiveCandles(archive: Record<string, Uint8Array>) {
  const csv = Object.entries(archive).find(([name]) => name.endsWith(".csv"))?.[1];
  if (!csv) throw new ProviderError("Binance public archive", "Archive did not contain a candle CSV file.");
  return strFromU8(csv).trim().split(/\r?\n/).flatMap(line => {
    const fields = line.split(",");
    const normalized = { openTime: normalizeArchiveTimestamp(Number(fields[0])), open: Number(fields[1]), high: Number(fields[2]), low: Number(fields[3]), close: Number(fields[4]), volume: Number(fields[5]), closeTime: normalizeArchiveTimestamp(Number(fields[6])) };
    return Object.values(normalized).every(Number.isFinite) ? [normalized] : [];
  });
}

async function fetchArchiveFile(url: string): Promise<Candle[] | null> {
  const response = await fetch(url, { headers: { Accept: "application/zip" } });
  if (response.status === 404) return null;
  if (!response.ok) throw new ProviderError("Binance public archive", `Binance public archive returned HTTP ${response.status}.`);
  return parseArchiveCandles(unzipSync(new Uint8Array(await response.arrayBuffer())));
}

function dailyArchiveDatesInRange(startTime: number, endTime: number, now = Date.now()) {
  const oldestFallbackTime = now - DAILY_ARCHIVE_FALLBACK_WINDOW_MS;
  if (endTime < oldestFallbackTime) return [];
  const cursor = new Date(Math.max(startTime, oldestFallbackTime));
  cursor.setUTCHours(0, 0, 0, 0);
  const end = new Date(endTime);
  end.setUTCHours(0, 0, 0, 0);
  const dates: string[] = [];
  while (cursor <= end) {
    dates.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}-${String(cursor.getUTCDate()).padStart(2, "0")}`);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export async function fetchBinanceHistoricalArchiveRange(symbol: string, timeframe: Timeframe, instrumentType: HistoricalArchiveInstrument, startTime: number, endTime: number, maximumMonths = 48): Promise<HistoricalArchiveResult> {
  const months = archiveMonthsInRange(startTime, endTime, maximumMonths);
  const monthlyBaseUrl = instrumentType === "spot" ? BINANCE_PUBLIC_SPOT_ARCHIVE_BASE_URL : BINANCE_PUBLIC_ARCHIVE_BASE_URL;
  const dailyBaseUrl = instrumentType === "spot" ? BINANCE_PUBLIC_SPOT_DAILY_ARCHIVE_BASE_URL : BINANCE_PUBLIC_DAILY_ARCHIVE_BASE_URL;
  const results: Candle[][] = [];
  const unavailableMonths: string[] = [];
  const dailyFallbackDays: string[] = [];
  const unavailableDays: string[] = [];
  // Sequential access keeps the public-source request cadence bounded and lets a later batch resume deterministically.
  for (const month of months) {
    const monthly = await fetchArchiveFile(`${monthlyBaseUrl}/${symbol}/${timeframe}/${symbol}-${timeframe}-${month}.zip`);
    if (monthly) { results.push(monthly); continue; }
    const monthStart = Date.parse(`${month}-01T00:00:00.000Z`);
    const nextMonthStart = new Date(monthStart);
    nextMonthStart.setUTCMonth(nextMonthStart.getUTCMonth() + 1);
    const eligibleDays = dailyArchiveDatesInRange(Math.max(startTime, monthStart), Math.min(endTime, nextMonthStart.getTime() - 1));
    if (!eligibleDays.length) { unavailableMonths.push(month); continue; }
    let dailyCandleCount = 0;
    for (const day of eligibleDays) {
      dailyFallbackDays.push(day);
      const daily = await fetchArchiveFile(`${dailyBaseUrl}/${symbol}/${timeframe}/${symbol}-${timeframe}-${day}.zip`);
      if (!daily) { unavailableDays.push(day); continue; }
      dailyCandleCount += daily.length;
      results.push(daily);
    }
    if (!dailyCandleCount) unavailableMonths.push(month);
  }
  const unique = new Map<number, Candle>();
  for (const candle of results.flat()) if (candle.openTime >= startTime && candle.closeTime <= endTime) unique.set(candle.openTime, candle);
  return { candles: Array.from(unique.values()).sort((left, right) => left.openTime - right.openTime), source: "Binance public archive", unavailableMonths, requestedMonths: months, dailyFallbackDays, unavailableDays };
}

export async function fetchBinanceCandlesForResearch(symbol: string, timeframe: Timeframe, limit = 240, startTime?: number, endTime?: number): Promise<{ candles: Candle[]; source: "Binance Futures OHLCV" | "Binance public archive" }> {
  try {
    return { candles: await fetchBinanceCandles(symbol, timeframe, limit, startTime, endTime), source: "Binance Futures OHLCV" };
  } catch (error) {
    if (!(error instanceof ProviderError) || error.source !== "Binance Futures OHLCV") throw error;
    const candles = await fetchBinanceArchiveCandles(symbol, timeframe, limit, startTime, endTime);
    if (!candles.length) throw new ProviderError("Binance public archive", "No completed archive candles were available for the requested window.");
    return { candles, source: "Binance public archive" };
  }
}

export async function fetchBinanceDerivatives(symbol: string): Promise<DerivativesContext> {
  const now = Date.now();
  const [funding, interest] = await Promise.allSettled([
    getJson<Array<{ fundingRate?: string }>>(`${BINANCE_FUTURES_BASE_URL}/fapi/v1/fundingRate?symbol=${symbol}&limit=1`, "Binance funding rate"),
    getJson<{ openInterest?: string }>(`${BINANCE_FUTURES_BASE_URL}/fapi/v1/openInterest?symbol=${symbol}`, "Binance open interest"),
  ]);
  const statuses: DataStatus[] = [];
  if (funding.status === "fulfilled") statuses.push({ source: "Binance funding rate", status: "live", fetchedAt: now });
  else statuses.push({ source: "Binance funding rate", status: "unavailable", fetchedAt: now, message: funding.reason instanceof Error ? funding.reason.message : "Funding rate unavailable." });
  if (interest.status === "fulfilled") statuses.push({ source: "Binance open interest", status: "live", fetchedAt: now });
  else statuses.push({ source: "Binance open interest", status: "unavailable", fetchedAt: now, message: interest.reason instanceof Error ? interest.reason.message : "Open interest unavailable." });
  return {
    fundingRate: funding.status === "fulfilled" ? Number(funding.value.at(-1)?.fundingRate ?? NaN) || null : null,
    openInterest: interest.status === "fulfilled" ? Number(interest.value.openInterest ?? NaN) || null : null,
    statuses,
  };
}

export async function fetchBinanceHistoricalFundingRates(symbol: string, startTime: number, endTime: number): Promise<HistoricalFundingRate[]> {
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || startTime > endTime) throw new ProviderError("Binance funding rate history", "A valid historical funding range is required.");
  type FundingPayload = Array<{ symbol?: string; fundingRate?: string; fundingTime?: number; markPrice?: string; rateType?: string }>;
  const records: HistoricalFundingRate[] = [];
  let cursor = startTime;
  const maximumPages = 8;
  for (let page = 0; page < maximumPages && cursor <= endTime; page += 1) {
    const params = new URLSearchParams({ symbol, startTime: String(cursor), endTime: String(endTime), limit: "1000" });
    const payload = await getJson<FundingPayload>(`${BINANCE_FUTURES_BASE_URL}/fapi/v1/fundingRate?${params}`, "Binance funding rate history");
    const normalized = payload.flatMap(item => {
      const fundingTime = Number(item.fundingTime);
      const fundingRate = Number(item.fundingRate);
      const markPrice = item.markPrice === undefined ? null : Number(item.markPrice);
      if (!Number.isFinite(fundingTime) || !Number.isFinite(fundingRate) || (markPrice !== null && !Number.isFinite(markPrice))) return [];
      return [{ symbol: item.symbol ?? symbol, fundingRate, fundingTime, markPrice, rateType: item.rateType ?? null }];
    }).filter(item => item.fundingTime >= startTime && item.fundingTime <= endTime);
    records.push(...normalized);
    const last = normalized.at(-1);
    if (payload.length < 1000 || !last) break;
    cursor = last.fundingTime + 1;
  }
  const unique = new Map(records.map(item => [item.fundingTime, item]));
  return Array.from(unique.values()).sort((left, right) => left.fundingTime - right.fundingTime);
}

export function unavailableStatus(source: string, error: unknown): DataStatus {
  return {
    source,
    status: "unavailable",
    fetchedAt: Date.now(),
    message: error instanceof Error ? error.message : "Provider request failed.",
  };
}
