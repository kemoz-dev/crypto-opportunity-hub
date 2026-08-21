import { strFromU8, unzipSync } from "fflate";
import type { AssetProfile, Candle, DataStatus, MarketAsset, Timeframe } from "../../shared/crypto";

const COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3";
const BINANCE_FUTURES_BASE_URL = "https://fapi.binance.com";
const BINANCE_PUBLIC_ARCHIVE_BASE_URL = "https://data.binance.vision/data/futures/um/monthly/klines";

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

export function unavailableStatus(source: string, error: unknown): DataStatus {
  return {
    source,
    status: "unavailable",
    fetchedAt: Date.now(),
    message: error instanceof Error ? error.message : "Provider request failed.",
  };
}
