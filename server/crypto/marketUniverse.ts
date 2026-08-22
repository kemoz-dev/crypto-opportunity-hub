import { and, eq } from "drizzle-orm";
import { assets, historicalDataQuality, historicalMarketCaps, historicalRegimeSnapshots, historicalSectorSnapshots, historicalUniverseMembers, historicalUniverseSnapshots, marketUniverseAssets } from "../../drizzle/schema";
import { getDb } from "../db";

export type UniverseTier = "TIER_1" | "TIER_2" | "TIER_3" | "TIER_4";
export type CoverageStatus = "AVAILABLE" | "PARTIAL" | "MISSING" | "UNAVAILABLE";
export type QualityRating = "HIGH" | "MEDIUM" | "LOW" | "UNAVAILABLE";

export const MARKET_UNIVERSE_PROTOCOL_VERSION = "MARKET_UNIVERSE_V1";

export const REPRESENTATIVE_MARKET_UNIVERSE = [
  { assetId: "bitcoin", symbol: "BTC", name: "Bitcoin", binanceSymbol: "BTCUSDT", coingeckoId: "bitcoin", tier: "TIER_1", sector: "Large Cap", reason: "Tier 1 liquid reference asset with public perpetual archive coverage." },
  { assetId: "ethereum", symbol: "ETH", name: "Ethereum", binanceSymbol: "ETHUSDT", coingeckoId: "ethereum", tier: "TIER_1", sector: "Large Cap", reason: "Tier 1 liquid reference asset with public perpetual archive coverage." },
  { assetId: "binancecoin", symbol: "BNB", name: "BNB", binanceSymbol: "BNBUSDT", coingeckoId: "binancecoin", tier: "TIER_2", sector: "L1", reason: "Tier 2 liquid major representing exchange-linked smart-contract activity." },
  { assetId: "solana", symbol: "SOL", name: "Solana", binanceSymbol: "SOLUSDT", coingeckoId: "solana", tier: "TIER_2", sector: "L1", reason: "Tier 2 liquid major representing high-throughput L1 exposure." },
  { assetId: "ripple", symbol: "XRP", name: "XRP", binanceSymbol: "XRPUSDT", coingeckoId: "ripple", tier: "TIER_2", sector: "Payments", reason: "Tier 2 liquid major representing payments-oriented market behavior." },
  { assetId: "cardano", symbol: "ADA", name: "Cardano", binanceSymbol: "ADAUSDT", coingeckoId: "cardano", tier: "TIER_2", sector: "L1", reason: "Tier 2 liquid major with long public archive availability." },
  { assetId: "avalanche-2", symbol: "AVAX", name: "Avalanche", binanceSymbol: "AVAXUSDT", coingeckoId: "avalanche-2", tier: "TIER_2", sector: "L1", reason: "Tier 2 liquid major representing alternative L1 behavior." },
  { assetId: "chainlink", symbol: "LINK", name: "Chainlink", binanceSymbol: "LINKUSDT", coingeckoId: "chainlink", tier: "TIER_2", sector: "Oracle", reason: "Tier 2 liquid major representing oracle infrastructure." },
  { assetId: "polkadot", symbol: "DOT", name: "Polkadot", binanceSymbol: "DOTUSDT", coingeckoId: "polkadot", tier: "TIER_2", sector: "Infrastructure", reason: "Tier 2 liquid major representing multi-chain infrastructure." },
  { assetId: "arbitrum", symbol: "ARB", name: "Arbitrum", binanceSymbol: "ARBUSDT", coingeckoId: "arbitrum", tier: "TIER_3", sector: "L2", reason: "Tier 3 representative L2 candidate, subject to archive availability." },
  { assetId: "optimism", symbol: "OP", name: "Optimism", binanceSymbol: "OPUSDT", coingeckoId: "optimism", tier: "TIER_3", sector: "L2", reason: "Tier 3 representative L2 candidate, subject to archive availability." },
  { assetId: "aave", symbol: "AAVE", name: "Aave", binanceSymbol: "AAVEUSDT", coingeckoId: "aave", tier: "TIER_3", sector: "DeFi", reason: "Tier 3 representative DeFi candidate with established archive symbol." },
  { assetId: "uniswap", symbol: "UNI", name: "Uniswap", binanceSymbol: "UNIUSDT", coingeckoId: "uniswap", tier: "TIER_3", sector: "DeFi", reason: "Tier 3 representative decentralized-exchange candidate." },
  { assetId: "render-token", symbol: "RENDER", name: "Render", binanceSymbol: "RENDERUSDT", coingeckoId: "render-token", tier: "TIER_3", sector: "AI", reason: "Tier 3 representative AI candidate, subject to archive availability." },
  { assetId: "ondo-finance", symbol: "ONDO", name: "Ondo", binanceSymbol: "ONDOUSDT", coingeckoId: "ondo-finance", tier: "TIER_3", sector: "RWA", reason: "Tier 3 representative RWA candidate, subject to archive availability." },
  { assetId: "the-graph", symbol: "GRT", name: "The Graph", binanceSymbol: "GRTUSDT", coingeckoId: "the-graph", tier: "TIER_3", sector: "DePIN", reason: "Tier 3 representative decentralized-data/infrastructure candidate." },
  { assetId: "axie-infinity", symbol: "AXS", name: "Axie Infinity", binanceSymbol: "AXSUSDT", coingeckoId: "axie-infinity", tier: "TIER_3", sector: "Gaming", reason: "Tier 3 representative gaming candidate." },
  { assetId: "filecoin", symbol: "FIL", name: "Filecoin", binanceSymbol: "FILUSDT", coingeckoId: "filecoin", tier: "TIER_3", sector: "Infrastructure", reason: "Tier 3 representative decentralized-storage candidate." },
  { assetId: "dogecoin", symbol: "DOGE", name: "Dogecoin", binanceSymbol: "DOGEUSDT", coingeckoId: "dogecoin", tier: "TIER_4", sector: "Meme", reason: "Tier 4 high-volatility meme comparison asset with established archive symbol." },
  { assetId: "pepe", symbol: "PEPE", name: "Pepe", binanceSymbol: "PEPEUSDT", coingeckoId: "pepe", tier: "TIER_4", sector: "Meme", reason: "Tier 4 high-volatility meme candidate, subject to archive availability." },
] as const;

export function qualityRating(score: number, expected: number): QualityRating {
  if (expected <= 0) return "UNAVAILABLE";
  if (score >= 85) return "HIGH";
  if (score >= 60) return "MEDIUM";
  return "LOW";
}

export function calculateCoverageQuality(input: { expected: number; actual: number; missing: number; longestGapMs: number; timeframeMs: number; duplicates: number; malformed: number; stale: boolean; providerState: "completed" | "partial" | "failed" | "unknown" }): { coveragePercent: number; qualityScore: number; qualityRating: QualityRating } {
  if (input.expected <= 0) return { coveragePercent: 0, qualityScore: 0, qualityRating: "UNAVAILABLE" };
  const coveragePercent = Math.max(0, Math.min(100, (input.actual / input.expected) * 100));
  const coveragePoints = coveragePercent * 0.45;
  const continuityPoints = Math.max(0, 25 - Math.min(25, input.missing * 0.25 + (input.longestGapMs / Math.max(input.timeframeMs, 1)) * 0.15));
  const freshnessPoints = input.stale ? 0 : 15;
  const integrityRate = ((input.duplicates + input.malformed) / Math.max(input.actual, 1)) * 100;
  const integrityPoints = Math.max(0, 10 - Math.min(10, integrityRate * 5));
  const providerPoints = input.providerState === "completed" ? 5 : input.providerState === "partial" ? 2.5 : 0;
  const qualityScore = Number((coveragePoints + continuityPoints + freshnessPoints + integrityPoints + providerPoints).toFixed(2));
  return { coveragePercent: Number(coveragePercent.toFixed(4)), qualityScore, qualityRating: qualityRating(qualityScore, input.expected) };
}

function coverageStatus(actual: number, expected: number): CoverageStatus {
  if (!expected || !actual) return "MISSING";
  if (actual >= expected) return "AVAILABLE";
  return "PARTIAL";
}

function bestQuality(rows: Array<{ qualityRating: QualityRating }>): QualityRating {
  if (rows.some(row => row.qualityRating === "HIGH")) return "HIGH";
  if (rows.some(row => row.qualityRating === "MEDIUM")) return "MEDIUM";
  if (rows.some(row => row.qualityRating === "LOW")) return "LOW";
  return "UNAVAILABLE";
}

export async function seedMarketUniverseRegistry() {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  for (const candidate of REPRESENTATIVE_MARKET_UNIVERSE) {
    await db.insert(assets).values({ id: candidate.assetId, symbol: candidate.symbol, name: candidate.name, binanceSymbol: candidate.binanceSymbol, sector: candidate.sector, isActive: true }).onDuplicateKeyUpdate({ set: { symbol: candidate.symbol, name: candidate.name, binanceSymbol: candidate.binanceSymbol, sector: candidate.sector, isActive: true } });
    await db.insert(marketUniverseAssets).values({ assetId: candidate.assetId, symbol: candidate.symbol, name: candidate.name, coingeckoId: candidate.coingeckoId, exchangeIdentifiers: { binance: { perpetual: candidate.binanceSymbol, spot: candidate.binanceSymbol } }, priorityTier: candidate.tier, inclusionReason: candidate.reason, registrySector: candidate.sector, sectorClassificationStatus: "HISTORICAL_UNAVAILABLE", marketCapCoverageStatus: "UNAVAILABLE", ohlcvCoverageStatus: "UNAVAILABLE", dataQualityStatus: "UNAVAILABLE", sourceProvenance: { protocol: MARKET_UNIVERSE_PROTOCOL_VERSION, selectionBasis: "representative source-supported candidates; not a historical market-cap ranking", taxonomyBasis: "registry-only; historical sector classification unavailable", sources: ["Binance Public Data", "CoinGecko"] }, isEnabled: true }).onDuplicateKeyUpdate({ set: { symbol: candidate.symbol, name: candidate.name, coingeckoId: candidate.coingeckoId, exchangeIdentifiers: { binance: { perpetual: candidate.binanceSymbol, spot: candidate.binanceSymbol } }, priorityTier: candidate.tier, inclusionReason: candidate.reason, registrySector: candidate.sector, sectorClassificationStatus: "HISTORICAL_UNAVAILABLE", sourceProvenance: { protocol: MARKET_UNIVERSE_PROTOCOL_VERSION, selectionBasis: "representative source-supported candidates; not a historical market-cap ranking", taxonomyBasis: "registry-only; historical sector classification unavailable", sources: ["Binance Public Data", "CoinGecko"] }, isEnabled: true } });
  }
  return { seeded: REPRESENTATIVE_MARKET_UNIVERSE.length };
}

export async function resolveEnabledUniverseAssets(assetIds?: string[]) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const rows = await db.select().from(marketUniverseAssets).where(eq(marketUniverseAssets.isEnabled, true));
  const selected = assetIds?.length ? rows.filter(row => assetIds.includes(row.assetId)) : rows;
  return selected.map(row => {
    const identifiers = row.exchangeIdentifiers as { binance?: { perpetual?: string; spot?: string } };
    return { id: row.assetId, binanceSymbol: identifiers.binance?.perpetual ?? identifiers.binance?.spot ?? "", priorityTier: row.priorityTier, registrySector: row.registrySector };
  }).filter(row => Boolean(row.binanceSymbol));
}

export async function refreshMarketUniverseCoverage(datasetId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const registry = await db.select().from(marketUniverseAssets).where(eq(marketUniverseAssets.isEnabled, true));
  const quality = await db.select().from(historicalDataQuality).where(eq(historicalDataQuality.datasetId, datasetId));
  const marketCaps = await db.select().from(historicalMarketCaps).where(eq(historicalMarketCaps.datasetId, datasetId));
  for (const asset of registry) {
    const rows = quality.filter(row => row.assetId === asset.assetId);
    const capRows = marketCaps.filter(row => row.assetId === asset.assetId);
    const expected = rows.reduce((sum, row) => sum + row.expectedCandleCount, 0);
    const actual = rows.reduce((sum, row) => sum + row.actualCandleCount, 0);
    const firstObserved = rows.map(row => row.earliestCandleAt?.getTime() ?? Number.MAX_SAFE_INTEGER).reduce((min, value) => Math.min(min, value), Number.MAX_SAFE_INTEGER);
    const lastObserved = rows.map(row => row.latestCandleAt?.getTime() ?? 0).reduce((max, value) => Math.max(max, value), 0);
    const availableCaps = capRows.filter(row => row.availability === "AVAILABLE").length;
    const marketCapStatus: CoverageStatus = !capRows.length ? "UNAVAILABLE" : availableCaps === capRows.length ? "AVAILABLE" : availableCaps ? "PARTIAL" : "MISSING";
    await db.update(marketUniverseAssets).set({ firstObservedAt: firstObserved === Number.MAX_SAFE_INTEGER ? null : new Date(firstObserved), lastObservedAt: lastObserved ? new Date(lastObserved) : null, ohlcvCoverageStatus: rows.length ? coverageStatus(actual, expected) : "UNAVAILABLE", marketCapCoverageStatus: marketCapStatus, dataQualityStatus: bestQuality(rows as Array<{ qualityRating: QualityRating }>) }).where(eq(marketUniverseAssets.assetId, asset.assetId));
  }
  return { datasetId, assetsRefreshed: registry.length };
}

export async function listMarketUniverseRegistry() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(marketUniverseAssets).where(eq(marketUniverseAssets.isEnabled, true));
}

export async function getHistoricalUniverseSnapshot(datasetId: number) {
  const db = await getDb();
  if (!db) return null;
  const snapshot = (await db.select().from(historicalUniverseSnapshots).where(eq(historicalUniverseSnapshots.datasetId, datasetId)).limit(1))[0];
  if (!snapshot) return null;
  const members = await db.select().from(historicalUniverseMembers).where(eq(historicalUniverseMembers.universeSnapshotId, snapshot.id));
  return { ...snapshot, members };
}

export async function getMarketCoverageMatrix(datasetId: number) {
  const db = await getDb();
  if (!db) return null;
  const [registry, snapshot, quality, marketCaps, regimes, sectors] = await Promise.all([
    listMarketUniverseRegistry(),
    getHistoricalUniverseSnapshot(datasetId),
    db.select().from(historicalDataQuality).where(eq(historicalDataQuality.datasetId, datasetId)),
    db.select().from(historicalMarketCaps).where(eq(historicalMarketCaps.datasetId, datasetId)),
    db.select().from(historicalRegimeSnapshots).where(eq(historicalRegimeSnapshots.datasetId, datasetId)),
    db.select().from(historicalSectorSnapshots).where(eq(historicalSectorSnapshots.datasetId, datasetId)),
  ]);
  const snapshotMembers = new Map((snapshot?.members ?? []).map(member => [member.assetId, member]));
  const regimeAvailability = regimes.some(item => item.availability === "AVAILABLE") ? "AVAILABLE" : regimes.length ? "UNAVAILABLE" : "UNAVAILABLE";
  const rows = registry.map(asset => {
    const scopes = quality.filter(item => item.assetId === asset.assetId);
    const timeframe = Object.fromEntries(["15m", "1h", "4h", "1d"].map(value => {
      const scope = scopes.find(item => item.timeframe === value);
      return [value, scope ? { status: scope.status, expected: scope.expectedCandleCount, observed: scope.actualCandleCount, missing: scope.missingIntervalCount, duplicates: scope.duplicateCount, coveragePercent: scope.coveragePercent, longestGapMs: scope.longestGapMs, qualityScore: scope.qualityScore, qualityRating: scope.qualityRating, latestIngestionAt: scope.lastSuccessfulIngestionAt } : { status: "UNAVAILABLE", expected: 0, observed: 0, missing: 0, duplicates: 0, coveragePercent: 0, longestGapMs: 0, qualityScore: 0, qualityRating: "UNAVAILABLE", latestIngestionAt: null }];
    }));
    const capRows = marketCaps.filter(item => item.assetId === asset.assetId);
    const availableCaps = capRows.filter(item => item.availability === "AVAILABLE").length;
    const marketCapStatus: CoverageStatus = !capRows.length ? "UNAVAILABLE" : availableCaps === capRows.length ? "AVAILABLE" : availableCaps ? "PARTIAL" : "MISSING";
    const sectorRows = sectors.filter(item => item.assetId === asset.assetId);
    const sectorStatus = sectorRows.some(item => item.availability === "AVAILABLE") ? "AVAILABLE" : "UNAVAILABLE";
    const member = snapshotMembers.get(asset.assetId);
    return { assetId: asset.assetId, symbol: asset.symbol, name: asset.name, priorityTier: asset.priorityTier, inclusionReason: asset.inclusionReason, registrySector: asset.registrySector, sectorClassificationStatus: asset.sectorClassificationStatus, firstObservedAt: asset.firstObservedAt, lastObservedAt: asset.lastObservedAt, ohlcvCoverageStatus: asset.ohlcvCoverageStatus, marketCapStatus, regimeStatus: regimeAvailability, sectorStatus, dataQualityStatus: member?.dataQualityStatus ?? asset.dataQualityStatus, timeframes: timeframe, snapshotEvidence: member?.qualityEvidence ?? null };
  });
  return { datasetId, snapshot, rows };
}

export async function snapshotMarketUniverse(datasetId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const existing = (await db.select().from(historicalUniverseSnapshots).where(eq(historicalUniverseSnapshots.datasetId, datasetId)).limit(1))[0];
  if (existing) return existing;
  const registry = await db.select().from(marketUniverseAssets).where(eq(marketUniverseAssets.isEnabled, true));
  const quality = await db.select().from(historicalDataQuality).where(eq(historicalDataQuality.datasetId, datasetId));
  const marketCaps = await db.select().from(historicalMarketCaps).where(eq(historicalMarketCaps.datasetId, datasetId));
  const coverageSummary = { protocol: MARKET_UNIVERSE_PROTOCOL_VERSION, qualityScopes: quality.length, aggregateExpected: quality.reduce((sum, row) => sum + row.expectedCandleCount, 0), aggregateActual: quality.reduce((sum, row) => sum + row.actualCandleCount, 0), aggregateMissing: quality.reduce((sum, row) => sum + row.missingIntervalCount, 0) };
  await db.insert(historicalUniverseSnapshots).values({ datasetId, universeKind: "CURRENT_SURVIVOR_UNIVERSE", selectionMethod: "tiered representative registry with public-source availability verification", survivorshipWarning: "CURRENT SURVIVOR UNIVERSE: historical delisted and inactive assets are not reliably represented. This dataset lists intentionally included source-supported assets, not historical market membership.", historicalSectorStatus: "UNAVAILABLE", assetCount: registry.length, sectorCount: new Set(registry.map(row => row.registrySector).filter(Boolean)).size, coverageSummary, sourceProvenance: { protocol: MARKET_UNIVERSE_PROTOCOL_VERSION, sourceAssessment: "docs/market-universe-source-assessment.md", historicalSector: "HISTORICAL SECTOR DATA UNAVAILABLE" } });
  const snapshot = (await db.select().from(historicalUniverseSnapshots).where(eq(historicalUniverseSnapshots.datasetId, datasetId)).limit(1))[0];
  if (!snapshot) throw new Error("Historical universe snapshot creation failed.");
  const members = registry.map(item => {
    const rows = quality.filter(row => row.assetId === item.assetId);
    const capRows = marketCaps.filter(row => row.assetId === item.assetId && row.availability === "AVAILABLE");
    const earliest = rows.map(row => row.earliestCandleAt?.getTime() ?? Number.MAX_SAFE_INTEGER).reduce((min, value) => Math.min(min, value), Number.MAX_SAFE_INTEGER);
    const latest = rows.map(row => row.latestCandleAt?.getTime() ?? 0).reduce((max, value) => Math.max(max, value), 0);
    const expected = rows.reduce((sum, row) => sum + row.expectedCandleCount, 0);
    const actual = rows.reduce((sum, row) => sum + row.actualCandleCount, 0);
    return { universeSnapshotId: snapshot.id, assetId: item.assetId, priorityTier: item.priorityTier, inclusionReason: item.inclusionReason, registrySector: item.registrySector, sectorClassificationStatus: item.sectorClassificationStatus, availableFromAt: earliest === Number.MAX_SAFE_INTEGER ? null : new Date(earliest), availableToAt: latest ? new Date(latest) : null, ohlcvStatus: rows.length ? coverageStatus(actual, expected) : "UNAVAILABLE" as CoverageStatus, marketCapStatus: capRows.length ? "AVAILABLE" as CoverageStatus : "UNAVAILABLE" as CoverageStatus, dataQualityStatus: bestQuality(rows as Array<{ qualityRating: QualityRating }>), qualityEvidence: { scopes: rows.length, expected, actual, coveragePercent: expected ? Number(((actual / expected) * 100).toFixed(4)) : 0, missingCandles: rows.reduce((sum, row) => sum + row.missingIntervalCount, 0), longestGapMs: Math.max(0, ...rows.map(row => row.longestGapMs)), qualityScores: rows.map(row => row.qualityScore), marketCapObservations: capRows.length } };
  });
  if (members.length) await db.insert(historicalUniverseMembers).values(members);
  return snapshot;
}
