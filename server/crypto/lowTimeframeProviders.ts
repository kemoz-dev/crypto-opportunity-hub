import type { Candle, DataStatus } from "../../shared/crypto";
import { ProviderError } from "./providers";

/**
 * Phase 6 contract: these timeframes belong only to the isolated Scalping
 * Intelligence path. They intentionally do not extend shared/crypto Timeframe.
 */
export const SCALPING_TIMEFRAMES = ["1m", "3m", "5m"] as const;
export type ScalpingTimeframe = (typeof SCALPING_TIMEFRAMES)[number];
export type LowTimeframeProvider = "Bybit Spot";
export type LowTimeframeBundleState = "VALID" | "PARTIAL" | "STALE" | "MISSING" | "INCOHERENT";
export type LowTimeframeSeriesState = "VALID" | "STALE" | "MISSING" | "INVALID";

const BYBIT_BASE_URL = "https://api.bybit.com";
const BYBIT_KLINE_INTERVAL: Record<ScalpingTimeframe, "1" | "3" | "5"> = { "1m": "1", "3m": "3", "5m": "5" };
const SCALPING_TIMEFRAME_MS: Record<ScalpingTimeframe, number> = { "1m": 60_000, "3m": 3 * 60_000, "5m": 5 * 60_000 };
const BYBIT_SPOT_SYMBOL_BY_ASSET: Record<string, string> = {
  BTC: "BTCUSDT", ETH: "ETHUSDT", SOL: "SOLUSDT", LINK: "LINKUSDT", AVAX: "AVAXUSDT", SUI: "SUIUSDT",
  UNI: "UNIUSDT", AAVE: "AAVEUSDT", DOGE: "DOGEUSDT", ADA: "ADAUSDT", XRP: "XRPUSDT", DOT: "DOTUSDT",
};
const LOW_TIMEFRAME_CACHE_TTL_MS = 20_000;

export const LOW_TIMEFRAME_NORMALIZATION_VERSION = "low-timeframe-bybit-spot-v1";

export type LowTimeframeSeries = {
  provider: LowTimeframeProvider;
  symbol: string;
  timeframe: ScalpingTimeframe;
  retrievedAt: number;
  normalizationVersion: typeof LOW_TIMEFRAME_NORMALIZATION_VERSION;
  candles: Candle[];
};

export type LowTimeframeStatus = {
  timeframe: ScalpingTimeframe;
  provider: LowTimeframeProvider | null;
  symbol: string | null;
  state: LowTimeframeSeriesState;
  status: "live" | "stale" | "unavailable";
  fetchedAt: number | null;
  candleCount: number;
  oldestCandleAt: number | null;
  newestCandleAt: number | null;
  freshnessMs: number | null;
  eligibleForScalping: boolean;
  message: string | null;
  errorClass: DataStatus["errorClass"] | null;
};

export type LowTimeframeBundle = {
  assetSymbol: string;
  requiredTimeframes: ScalpingTimeframe[];
  provider: LowTimeframeProvider | null;
  providerSymbol: string | null;
  state: LowTimeframeBundleState;
  coherent: boolean;
  eligibleForScalping: boolean;
  statusMessage: string;
  capturedAt: number;
  seriesByTimeframe: Partial<Record<ScalpingTimeframe, LowTimeframeSeries>>;
  timeframes: LowTimeframeStatus[];
};

type BybitKlinePayload = {
  retCode?: number;
  retMsg?: string;
  result?: { category?: string; symbol?: string; list?: unknown };
};

type FetchAttempt = { timeframe: ScalpingTimeframe; series: LowTimeframeSeries | null; error: ProviderError | null };

const bundleCache = new Map<string, { expiresAt: number; value: LowTimeframeBundle }>();
const inflightBundles = new Map<string, Promise<LowTimeframeBundle>>();

export function getApprovedBybitLowTimeframeMappings() {
  return {
    provider: "Bybit Spot" as const,
    mappings: { ...BYBIT_SPOT_SYMBOL_BY_ASSET },
    intervals: { ...BYBIT_KLINE_INTERVAL },
    freshnessAllowanceIntervals: 3,
    normalizationVersion: LOW_TIMEFRAME_NORMALIZATION_VERSION,
  };
}

function providerError(source: string, message: string, errorClass: NonNullable<DataStatus["errorClass"]> = "PROVIDER_REQUEST_FAILED") {
  return new ProviderError(source, message, errorClass);
}

async function getBybitJson(url: string): Promise<BybitKlinePayload> {
  const source = "Bybit Spot low-timeframe OHLCV";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!response.ok) throw providerError(source, `${source} returned HTTP ${response.status}.`, response.status === 429 ? "PROVIDER_RATE_LIMITED" : "PROVIDER_REQUEST_FAILED");
    const payload = await response.json() as BybitKlinePayload;
    if (!payload || typeof payload !== "object") throw providerError(source, `${source} returned an invalid JSON response.`, "PROVIDER_INVALID_RESPONSE");
    if (payload.retCode !== 0) throw providerError(source, `${source} returned ${payload.retCode ?? "an unknown error"}: ${payload.retMsg ?? "no message"}.`, "PROVIDER_REQUEST_FAILED");
    return payload;
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    const message = error instanceof Error ? error.message : "Unknown provider error.";
    throw providerError(source, message.includes("abort") ? `${source} timed out.` : message, message.includes("abort") ? "PROVIDER_TIMEOUT" : "PROVIDER_REQUEST_FAILED");
  } finally {
    clearTimeout(timeout);
  }
}

export function normalizeBybitSpotCandles(payload: BybitKlinePayload, expectedSymbol: string, timeframe: ScalpingTimeframe): Candle[] {
  const source = "Bybit Spot low-timeframe OHLCV";
  if (payload.retCode !== 0) throw providerError(source, `${source} returned ${payload.retCode ?? "an unknown error"}: ${payload.retMsg ?? "no message"}.`);
  if (payload.result?.category !== "spot") throw providerError(source, `Bybit response category ${payload.result?.category ?? "UNAVAILABLE"} is not approved spot data.`, "SYMBOL_MAPPING_MISMATCH");
  if (payload.result?.symbol !== expectedSymbol) throw providerError(source, `Bybit returned symbol ${payload.result?.symbol ?? "UNAVAILABLE"}; expected ${expectedSymbol}.`, "SYMBOL_MAPPING_MISMATCH");
  if (!Array.isArray(payload.result.list)) throw providerError(source, "Bybit returned a malformed Kline list.", "PROVIDER_INVALID_RESPONSE");
  const interval = SCALPING_TIMEFRAME_MS[timeframe];
  return payload.result.list.map((record, index) => {
    if (!Array.isArray(record) || record.length < 6) throw providerError(source, `Bybit returned a malformed Kline record at index ${index}.`, "PROVIDER_INVALID_RESPONSE");
    const [openTime, open, high, low, close, volume] = record;
    const normalized = { openTime: Number(openTime), closeTime: Number(openTime) + interval - 1, open: Number(open), high: Number(high), low: Number(low), close: Number(close), volume: Number(volume) };
    if (!Object.values(normalized).every(Number.isFinite)) throw providerError(source, `Bybit returned a non-finite Kline field at index ${index}.`, "VALIDATION_FAILED");
    return normalized;
  }).sort((left, right) => left.openTime - right.openTime);
}

export function validateLowTimeframeCandles(candles: Candle[], timeframe: ScalpingTimeframe, retrievedAt: number, minimumCandles: number): Candle[] {
  const interval = SCALPING_TIMEFRAME_MS[timeframe];
  if (candles.some(candle => candle.openTime > retrievedAt)) throw providerError("Low-timeframe OHLCV validation", "A candle starts in the future relative to the provider retrieval timestamp.", "TIMESTAMP_CORRUPTION");
  const completed = candles.filter(candle => candle.closeTime < retrievedAt);
  if (completed.length < minimumCandles) throw providerError("Low-timeframe OHLCV validation", `Only ${completed.length} complete ${timeframe} candles were returned; ${minimumCandles} are required.`, "INSUFFICIENT_CANDLES");
  let previousOpenTime: number | null = null;
  for (const candle of completed) {
    if (![candle.openTime, candle.closeTime, candle.open, candle.high, candle.low, candle.close, candle.volume].every(Number.isFinite)) throw providerError("Low-timeframe OHLCV validation", "A candle contains a non-finite field.", "VALIDATION_FAILED");
    if (candle.openTime % interval !== 0 || candle.closeTime !== candle.openTime + interval - 1) throw providerError("Low-timeframe OHLCV validation", `Candle timestamps do not align to the requested ${timeframe} interval.`, "TIMESTAMP_CORRUPTION");
    if (candle.open <= 0 || candle.high <= 0 || candle.low <= 0 || candle.close <= 0 || candle.high < Math.max(candle.open, candle.close) || candle.low > Math.min(candle.open, candle.close)) throw providerError("Low-timeframe OHLCV validation", "A candle has invalid OHLC bounds.", "VALIDATION_FAILED");
    if (candle.volume <= 0) throw providerError("Low-timeframe OHLCV validation", "A candle has missing or zero volume.", "MISSING_VOLUME");
    if (previousOpenTime !== null && candle.openTime !== previousOpenTime + interval) throw providerError("Low-timeframe OHLCV validation", "The returned candle series has a duplicate or missing requested interval.", "TIMEFRAME_MISMATCH");
    previousOpenTime = candle.openTime;
  }
  const retained = completed.slice(-minimumCandles);
  const newest = retained.at(-1);
  if (!newest || retrievedAt - newest.closeTime > interval * 3) throw providerError("Low-timeframe OHLCV validation", `The newest completed ${timeframe} candle is older than the three-interval freshness limit.`, "STALE_DATA");
  return retained;
}

function seriesState(error: ProviderError | null): LowTimeframeSeriesState {
  if (!error) return "VALID";
  return error.errorClass === "STALE_DATA" ? "STALE" : error.errorClass === "VALIDATION_FAILED" || error.errorClass === "TIMESTAMP_CORRUPTION" || error.errorClass === "TIMEFRAME_MISMATCH" || error.errorClass === "MISSING_VOLUME" || error.errorClass === "SYMBOL_MAPPING_MISMATCH" ? "INVALID" : "MISSING";
}

function describeAttempt(attempt: FetchAttempt, now: number): LowTimeframeStatus {
  const series = attempt.series;
  const newest = series?.candles.at(-1) ?? null;
  return {
    timeframe: attempt.timeframe,
    provider: series?.provider ?? null,
    symbol: series?.symbol ?? null,
    state: seriesState(attempt.error),
    status: series ? "live" : attempt.error?.errorClass === "STALE_DATA" ? "stale" : "unavailable",
    fetchedAt: series?.retrievedAt ?? null,
    candleCount: series?.candles.length ?? 0,
    oldestCandleAt: series?.candles[0]?.openTime ?? null,
    newestCandleAt: newest?.closeTime ?? null,
    freshnessMs: newest ? Math.max(0, now - newest.closeTime) : null,
    eligibleForScalping: Boolean(series),
    message: series ? null : attempt.error?.message ?? "No validated Bybit Spot response was available.",
    errorClass: series ? null : attempt.error?.errorClass ?? null,
  };
}

export async function fetchValidatedBybitLowTimeframe(assetSymbol: string, timeframe: ScalpingTimeframe, minimumCandles: number, limit = Math.max(minimumCandles + 8, 240)): Promise<LowTimeframeSeries> {
  const symbol = BYBIT_SPOT_SYMBOL_BY_ASSET[assetSymbol];
  if (!symbol) throw providerError("Bybit Spot low-timeframe OHLCV", `No approved Bybit Spot mapping exists for ${assetSymbol}.`, "SYMBOL_MAPPING_MISMATCH");
  const boundedLimit = Math.min(1_000, Math.max(minimumCandles, limit));
  const params = new URLSearchParams({ category: "spot", symbol, interval: BYBIT_KLINE_INTERVAL[timeframe], limit: String(boundedLimit) });
  const retrievedAt = Date.now();
  const payload = await getBybitJson(`${BYBIT_BASE_URL}/v5/market/kline?${params}`);
  const candles = validateLowTimeframeCandles(normalizeBybitSpotCandles(payload, symbol, timeframe), timeframe, retrievedAt, minimumCandles);
  return { provider: "Bybit Spot", symbol, timeframe, retrievedAt, normalizationVersion: LOW_TIMEFRAME_NORMALIZATION_VERSION, candles };
}

function makeBundle(assetSymbol: string, minimumCandles: number): Promise<LowTimeframeBundle> {
  const requestedSymbol = BYBIT_SPOT_SYMBOL_BY_ASSET[assetSymbol];
  const capturedAt = Date.now();
  return Promise.all(SCALPING_TIMEFRAMES.map(async timeframe => {
    try {
      return { timeframe, series: await fetchValidatedBybitLowTimeframe(assetSymbol, timeframe, minimumCandles), error: null } satisfies FetchAttempt;
    } catch (error) {
      const typed = error instanceof ProviderError ? error : providerError("Bybit Spot low-timeframe OHLCV", error instanceof Error ? error.message : "Provider request failed.");
      return { timeframe, series: null, error: typed } satisfies FetchAttempt;
    }
  })).then(attempts => {
    const timeframes = attempts.map(attempt => describeAttempt(attempt, capturedAt));
    const seriesByTimeframe = Object.fromEntries(attempts.flatMap(attempt => attempt.series ? [[attempt.timeframe, attempt.series] as const] : [])) as Partial<Record<ScalpingTimeframe, LowTimeframeSeries>>;
    const validCount = timeframes.filter(item => item.eligibleForScalping).length;
    const allValid = validCount === SCALPING_TIMEFRAMES.length;
    const coherent = allValid && Object.values(seriesByTimeframe).every(series => series.provider === "Bybit Spot" && series.symbol === requestedSymbol);
    const state: LowTimeframeBundleState = coherent ? "VALID" : validCount === SCALPING_TIMEFRAMES.length ? "INCOHERENT" : validCount > 0 ? "PARTIAL" : timeframes.some(item => item.state === "STALE") ? "STALE" : "MISSING";
    const firstIssue = timeframes.find(item => !item.eligibleForScalping);
    return {
      assetSymbol,
      requiredTimeframes: [...SCALPING_TIMEFRAMES],
      provider: coherent ? "Bybit Spot" : null,
      providerSymbol: coherent ? requestedSymbol ?? null : null,
      state: coherent ? "VALID" : state,
      coherent,
      eligibleForScalping: coherent,
      statusMessage: coherent ? "All requested 1m, 3m, and 5m candles were independently validated from Bybit Spot." : state === "INCOHERENT" ? "Provider or symbol provenance did not match across the completed 1m/3m/5m bundle; no mixed data was used." : state === "PARTIAL" ? "A complete single-provider 1m/3m/5m bundle was not available; partial data was not used." : firstIssue?.message ?? "No complete validated Bybit Spot bundle was available.",
      capturedAt,
      seriesByTimeframe: coherent ? seriesByTimeframe : {},
      timeframes,
    };
  });
}

export async function fetchValidatedLowTimeframeBundle(assetSymbol: string, minimumCandles: number, forceRefresh = false): Promise<LowTimeframeBundle> {
  const cacheKey = `${assetSymbol}:${minimumCandles}`;
  const cached = bundleCache.get(cacheKey);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) return cached.value;
  const active = inflightBundles.get(cacheKey);
  if (!forceRefresh && active) return active;
  const request = makeBundle(assetSymbol, minimumCandles).then(bundle => {
    bundleCache.set(cacheKey, { value: bundle, expiresAt: Date.now() + LOW_TIMEFRAME_CACHE_TTL_MS });
    return bundle;
  }).finally(() => inflightBundles.delete(cacheKey));
  inflightBundles.set(cacheKey, request);
  return request;
}

export function clearLowTimeframeProviderCache() {
  bundleCache.clear();
  inflightBundles.clear();
}
