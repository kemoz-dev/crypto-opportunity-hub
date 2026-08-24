import { assets, dataSources, marketData, scoreSnapshots, technicalSnapshots } from "../../drizzle/schema";
import type { ScannerResponse } from "../../shared/crypto";
import { getDb } from "../db";

export async function persistScannerSnapshot(scan: ScannerResponse): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    const observedAt = new Date(scan.generatedAt);
    const rowsWithAssets = scan.rows;
    if (rowsWithAssets.length) {
      await db.insert(assets).values(rowsWithAssets.map(({ asset }) => ({ id: asset.id, symbol: asset.symbol, name: asset.name, binanceSymbol: asset.binanceSymbol, sector: asset.sector, isActive: true }))).onDuplicateKeyUpdate({ set: { updatedAt: observedAt } });
      await db.insert(marketData).values(rowsWithAssets.map(({ asset, fundingRate, openInterest }) => ({
        assetId: asset.id, provider: asset.provider, observedAt, price: asset.price, marketCap: asset.marketCap, marketCapRank: asset.marketCapRank, volume24h: asset.volume24h,
        change1h: asset.change1h, change24h: asset.change24h, change7d: asset.change7d, fundingRate, openInterest,
      })));
    }
    const allStatuses = [...scan.dataStatus, ...rowsWithAssets.flatMap(row => row.dataStatus)];
    if (allStatuses.length) await db.insert(dataSources).values(allStatuses.map(status => ({ provider: status.provider ?? status.source.split(" ")[0], endpoint: status.source, status: status.status, fetchedAt: new Date(status.fetchedAt), message: status.message ?? null, metadata: { provider: status.provider ?? null, symbol: status.symbol ?? null, timeframe: status.timeframe ?? null, capability: status.capability ?? null, errorClass: status.errorClass ?? null, normalizationVersion: status.normalizationVersion ?? null, dataQuality: status.dataQuality ?? null } })));
    const technicalRows = rowsWithAssets.flatMap(row => (row.score?.technicalByTimeframe ?? []).map(analysis => ({
      assetId: row.asset.id, timeframe: analysis.timeframe, observedAt, sourceObservedAt: row.asset.lastUpdatedAt ? new Date(row.asset.lastUpdatedAt) : null,
      rsi: analysis.rsi, macdHistogram: analysis.macdHistogram, atrPercent: analysis.atrPercent, volumeExpansion: analysis.volumeExpansion, analysis,
    })));
    if (technicalRows.length) await db.insert(technicalSnapshots).values(technicalRows);
    const scoreRows = rowsWithAssets.flatMap(row => row.score ? [{
      assetId: row.asset.id, observedAt, opportunityScore: row.score.score, confidenceScore: row.score.confidence, technicalScore: row.score.technicalScore,
      momentumScore: row.score.momentumScore, sectorScore: row.score.sectorScore, riskScore: row.score.riskScore, setupType: row.score.setupType,
      direction: row.score.direction, riskLevel: row.score.riskLevel, configurationVersion: "phase-1-default-v1", components: row.score.reasons,
      explanation: row.score.explanation, missingConditions: row.score.missingConditions, dataStatus: row.dataStatus,
    }] : []);
    if (scoreRows.length) await db.insert(scoreSnapshots).values(scoreRows);
  } catch (error) {
    console.error("[Crypto persistence] Live scanner snapshot was not persisted:", error);
  }
}
