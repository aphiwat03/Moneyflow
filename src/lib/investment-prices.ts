import type { InvestmentAssetType, InvestmentCurrency } from "./types";

const PRICE_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const FETCH_TIMEOUT_MS = 6_000;

export interface MarketQuote {
  symbol: string;
  price: number;
  currency: InvestmentCurrency;
  fetchedAt: number;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const quoteCache = new Map<string, CacheEntry<MarketQuote>>();
let fxCache: CacheEntry<number> | null = null;

const VALID_MARKET_TICKER_REGEX = /^[A-Z0-9]{1,8}(?:[.-][A-Z0-9]{1,4})?$/;
const GENERIC_NON_TICKER_SYMBOLS = new Set(["GOLD", "CASH", "BOND", "FUND"]);

/**
 * Checks whether a holding symbol looks like a standard exchange ticker
 * (e.g. VOO, QQQM, SCHD, AAPL, BRK-B, PTT.BK, TDEX.BK) rather than a Thai mutual fund name.
 */
export function isSupportedMarketTicker(
  rawSymbol: string,
  assetType: InvestmentAssetType
): boolean {
  if (assetType === "mutual_fund") {
    return false;
  }
  const normalized = normalizeMarketSymbol(rawSymbol);
  if (!normalized || GENERIC_NON_TICKER_SYMBOLS.has(normalized)) {
    return false;
  }
  return VALID_MARKET_TICKER_REGEX.test(normalized);
}

export function normalizeMarketSymbol(rawSymbol: string): string {
  return rawSymbol.trim().toUpperCase();
}

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        previousClose?: number;
        currency?: string;
      };
    }>;
  };
}

async function fetchYahooChartMeta(symbol: string): Promise<{
  price: number;
  rawCurrency: string;
} | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "MoneyFlow-PersonalFinance/1.0",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as YahooChartResponse;
  const meta = data.chart?.result?.[0]?.meta;
  const price = meta?.regularMarketPrice ?? meta?.previousClose;
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
    return null;
  }

  return {
    price,
    rawCurrency: (meta?.currency ?? "USD").toUpperCase(),
  };
}

export async function fetchMarketQuote(
  rawSymbol: string
): Promise<MarketQuote | null> {
  const symbol = normalizeMarketSymbol(rawSymbol);
  const now = Date.now();
  const cached = quoteCache.get(symbol);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  try {
    const meta = await fetchYahooChartMeta(symbol);
    if (!meta) return null;

    const currency: InvestmentCurrency =
      meta.rawCurrency === "THB" || symbol.endsWith(".BK") ? "THB" : "USD";
    const quote: MarketQuote = {
      symbol,
      price: meta.price,
      currency,
      fetchedAt: now,
    };

    quoteCache.set(symbol, {
      value: quote,
      expiresAt: now + PRICE_CACHE_TTL_MS,
    });
    return quote;
  } catch {
    return null;
  }
}

export async function fetchUsdThbRate(): Promise<number | null> {
  const now = Date.now();
  if (fxCache && fxCache.expiresAt > now) {
    return fxCache.value;
  }

  try {
    const meta = await fetchYahooChartMeta("USDTHB=X");
    if (!meta || meta.price <= 10 || meta.price >= 100) {
      return null;
    }
    fxCache = {
      value: meta.price,
      expiresAt: now + PRICE_CACHE_TTL_MS,
    };
    return meta.price;
  } catch {
    return null;
  }
}
