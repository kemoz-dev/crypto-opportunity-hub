export const SUPPORTED_TIMEFRAMES = ["15m", "1h", "4h", "1d"] as const;
export type Timeframe = (typeof SUPPORTED_TIMEFRAMES)[number];

export type AssetProfile = {
  id: string;
  symbol: string;
  name: string;
  binanceSymbol: string;
  sector: string;
};

export type Candle = {
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type MarketAsset = AssetProfile & {
  price: number | null;
  marketCap: number | null;
  marketCapRank: number | null;
  volume24h: number | null;
  change1h: number | null;
  change24h: number | null;
  change7d: number | null;
  lastUpdatedAt: number | null;
  provider: string;
};

export type DataStatus = {
  source: string;
  status: "live" | "stale" | "unavailable";
  fetchedAt: number;
  message?: string;
  provider?: string;
  symbol?: string;
  timeframe?: Timeframe;
  capability?: "OHLCV" | "FUNDING" | "OPEN_INTEREST" | "MARKET_CONTEXT";
  errorClass?: "PROVIDER_UNAVAILABLE_REGION_RESTRICTION" | "PROVIDER_REQUEST_FAILED" | "PROVIDER_TIMEOUT" | "PROVIDER_RATE_LIMITED" | "PROVIDER_INVALID_RESPONSE" | "VALIDATION_FAILED" | "INSUFFICIENT_CANDLES" | "STALE_DATA" | "SYMBOL_MAPPING_MISMATCH" | "TIMEFRAME_MISMATCH" | "TIMESTAMP_CORRUPTION" | "MISSING_VOLUME" | "MIXED_PROVIDER_PREVENTED";
  normalizationVersion?: string;
  dataQuality?: "VALID" | "STALE" | "INSUFFICIENT" | "INCOHERENT" | "PROVIDER_UNAVAILABLE" | "INVALID" | "NO_DATA";
};

export type ScoreReason = {
  key: string;
  label: string;
  score: number;
  maxScore: number;
  direction: "positive" | "neutral" | "negative";
  detail: string;
};

export type TimeframeAnalysis = {
  timeframe: Timeframe;
  score: number;
  maxScore: number;
  bias: "bullish" | "neutral" | "bearish";
  rsi: number | null;
  macdHistogram: number | null;
  ema20: number | null;
  ema50: number | null;
  ema200: number | null;
  bollinger: { middle: number; upper: number; lower: number; width: number } | null;
  atrPercent: number | null;
  volumeExpansion: number | null;
  priceStructure: string[];
  reasons: ScoreReason[];
};

export type MarketRegime = {
  score: number;
  classification: "RISK ON" | "SELECTIVE" | "RISK OFF";
  reasons: ScoreReason[];
  btcDominance: number | null;
  breadth: number | null;
};

export type OpportunityScore = {
  score: number;
  confidence: number;
  technicalScore: number;
  momentumScore: number;
  sectorScore: number | null;
  riskScore: number;
  setupType: string;
  direction: "bullish" | "neutral" | "bearish";
  riskLevel: "low" | "moderate" | "high";
  technicalByTimeframe: TimeframeAnalysis[];
  multiTimeframeScore: number;
  reasons: ScoreReason[];
  missingConditions: string[];
  explanation: string;
};

export type ScannerRow = {
  asset: MarketAsset;
  score: OpportunityScore | null;
  dataStatus: DataStatus[];
  fundingRate: number | null;
  openInterest: number | null;
};

export type ScannerResponse = {
  generatedAt: number;
  dataStatus: DataStatus[];
  marketRegime: MarketRegime | null;
  rows: ScannerRow[];
  note: string;
};

export type ScoringConfig = {
  weights: {
    technical: number;
    momentum: number;
    sector: number;
    catalyst: number;
    riskLiquidity: number;
  };
  indicator: {
    rsiPeriod: number;
    macdFast: number;
    macdSlow: number;
    macdSignal: number;
    emaFast: number;
    emaMedium: number;
    emaSlow: number;
    bollingerPeriod: number;
    atrPeriod: number;
    volumePeriod: number;
  };
  timeframes: Record<Timeframe, { enabled: boolean; weight: number }>;
  thresholds: {
    opportunity: number;
    confidence: number;
    technical: number;
  };
  risk: {
    maxAtrPercent: number;
    minimumMarketCap: number;
    minimumVolumeToMarketCap: number;
  };
  sectorModels: Record<string, {
    technicalMultiplier: number;
    riskMultiplier: number;
    description: string;
  }>;
  paperCapital: number;
};

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  weights: {
    technical: 40,
    momentum: 20,
    sector: 15,
    catalyst: 10,
    riskLiquidity: 15,
  },
  indicator: {
    rsiPeriod: 14,
    macdFast: 12,
    macdSlow: 26,
    macdSignal: 9,
    emaFast: 20,
    emaMedium: 50,
    emaSlow: 200,
    bollingerPeriod: 20,
    atrPeriod: 14,
    volumePeriod: 20,
  },
  timeframes: {
    "15m": { enabled: true, weight: 0.15 },
    "1h": { enabled: true, weight: 0.25 },
    "4h": { enabled: true, weight: 0.35 },
    "1d": { enabled: true, weight: 0.25 },
  },
  thresholds: { opportunity: 70, confidence: 65, technical: 24 },
  risk: {
    maxAtrPercent: 8,
    minimumMarketCap: 100_000_000,
    minimumVolumeToMarketCap: 0.01,
  },
  sectorModels: {
    "Large Cap": { technicalMultiplier: 1, riskMultiplier: 1.05, description: "Baseline model with a modest liquidity-quality preference." },
    "L1": { technicalMultiplier: 1, riskMultiplier: 1, description: "Baseline model for liquid base-layer assets." },
    "DeFi": { technicalMultiplier: 1.05, riskMultiplier: 0.95, description: "Slightly higher trend emphasis with a modest risk adjustment." },
    "Meme": { technicalMultiplier: 0.9, riskMultiplier: 0.75, description: "Higher-risk research hypothesis with a stronger safety penalty." },
    "Oracles": { technicalMultiplier: 1, riskMultiplier: 1, description: "Baseline model pending sector-specific validation." },
    "Infrastructure": { technicalMultiplier: 1, riskMultiplier: 1, description: "Baseline model pending sector-specific validation." },
    Other: { technicalMultiplier: 1, riskMultiplier: 1, description: "Fallback model for uncategorized assets." },
  },
  paperCapital: 100_000,
};

export const DEFAULT_ASSET_UNIVERSE: AssetProfile[] = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin", binanceSymbol: "BTCUSDT", sector: "Large Cap" },
  { id: "ethereum", symbol: "ETH", name: "Ethereum", binanceSymbol: "ETHUSDT", sector: "L1" },
  { id: "solana", symbol: "SOL", name: "Solana", binanceSymbol: "SOLUSDT", sector: "L1" },
  { id: "chainlink", symbol: "LINK", name: "Chainlink", binanceSymbol: "LINKUSDT", sector: "Oracles" },
  { id: "avalanche-2", symbol: "AVAX", name: "Avalanche", binanceSymbol: "AVAXUSDT", sector: "L1" },
  { id: "sui", symbol: "SUI", name: "Sui", binanceSymbol: "SUIUSDT", sector: "L1" },
  { id: "uniswap", symbol: "UNI", name: "Uniswap", binanceSymbol: "UNIUSDT", sector: "DeFi" },
  { id: "aave", symbol: "AAVE", name: "Aave", binanceSymbol: "AAVEUSDT", sector: "DeFi" },
  { id: "dogecoin", symbol: "DOGE", name: "Dogecoin", binanceSymbol: "DOGEUSDT", sector: "Meme" },
  { id: "cardano", symbol: "ADA", name: "Cardano", binanceSymbol: "ADAUSDT", sector: "L1" },
  { id: "ripple", symbol: "XRP", name: "XRP", binanceSymbol: "XRPUSDT", sector: "Large Cap" },
  { id: "polkadot", symbol: "DOT", name: "Polkadot", binanceSymbol: "DOTUSDT", sector: "Infrastructure" },
];
