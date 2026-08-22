import { strFromU8, unzipSync } from "fflate";
import type { AssetProfile, Candle, DataStatus, MarketAsset, Timeframe } from "../../shared/crypto";

const COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3";
const BINANCE_FUTURES_BASE_URL = "https://fapi.binance.com";
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

class ProviderError extends Error {
  constructor(public source: string, message: string) {
    super(message);
  }
}

async function getJson<T>(url: string, source: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!response.ok) throw new ProviderError(source, `${source} returned HTTP ${response.status}.`);
    return await response.json() as T;
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    const message = error instanceof Error ? error.message : "Unknown provider error.";
    throw new ProviderError(source, message.includes("abort") ? `${source} timed out.` : message);
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
