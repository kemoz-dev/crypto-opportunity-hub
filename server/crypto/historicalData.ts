import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { createHash, randomUUID } from "node:crypto";
import { historicalCandles, historicalDataQuality, historicalDatasets, historicalIngestionRuns, historicalMissingIntervals } from "../../drizzle/schema";
import { calculateCoverageQuality } from "./marketUniverse";
import type { Candle, Timeframe } from "../../shared/crypto";
import { getDb } from "../db";

export const HISTORICAL_DATA_PROTOCOL_VERSION = "HISTORICAL_DATA_FOUNDATION_V1";
export type InstrumentType = "spot" | "perpetual";
export type QualityStatus = "COMPLETE" | "PARTIAL" | "MISSING" | "STALE" | "ERROR";
export const timeframeMs: Record<Timeframe, number> = { "15m": 15 * 60_000, "1h": 60 * 60_000, "4h": 4 * 60 * 60_000, "1d": 24 * 60 * 60_000 };

export type HistoricalCandleInput = Candle & { sourcePayload?: unknown };
export type HistoricalScope = { datasetId: number; assetId: string; exchange: string; provider: string; instrumentType: InstrumentType; timeframe: Timeframe };
export type CandleAudit = { valid: HistoricalCandleInput[]; malformed: Array<{ candle: HistoricalCandleInput; reason: string }>; internalDuplicates: HistoricalCandleInput[]; gaps: Array<{ startMs: number; endMs: number; expectedMissingCount: number }> };

const stable = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
  return JSON.stringify(value);
};
export const sourceHash = (candle: HistoricalCandleInput) => createHash("sha256").update(stable({ openTime: candle.openTime, closeTime: candle.closeTime, open: candle.open, high: candle.high, low: candle.low, close: candle.close, volume: candle.volume })).digest("hex");

export function validateHistoricalCandle(candle: HistoricalCandleInput): string | null {
  if (![candle.openTime, candle.closeTime, candle.open, candle.high, candle.low, candle.close, candle.volume].every(Number.isFinite)) return "non-finite value";
  if (candle.openTime < 0 || candle.closeTime <= candle.openTime) return "invalid candle interval";
  if (candle.open <= 0 || candle.high <= 0 || candle.low <= 0 || candle.close <= 0 || candle.volume < 0) return "non-positive OHLCV value";
  if (candle.high < Math.max(candle.open, candle.close) || candle.low > Math.min(candle.open, candle.close) || candle.high < candle.low) return "inconsistent OHLC geometry";
  return null;
}

export function auditHistoricalCandles(candles: HistoricalCandleInput[], timeframe: Timeframe): CandleAudit {
  const malformed: CandleAudit["malformed"] = [];
  const deduplicated = new Map<string, HistoricalCandleInput>();
  const internalDuplicates: HistoricalCandleInput[] = [];
  for (const candle of candles) {
    const error = validateHistoricalCandle(candle);
    if (error) { malformed.push({ candle, reason: error }); continue; }
    const key = `${candle.openTime}:${sourceHash(candle)}`;
    if (deduplicated.has(key)) { internalDuplicates.push(candle); continue; }
    deduplicated.set(key, candle);
  }
  const valid = Array.from(deduplicated.values()).sort((left, right) => left.openTime - right.openTime);
  const interval = timeframeMs[timeframe];
  const gaps: CandleAudit["gaps"] = [];
  for (let index = 1; index < valid.length; index += 1) {
    const difference = valid[index].openTime - valid[index - 1].openTime;
    if (difference > interval) gaps.push({ startMs: valid[index - 1].openTime + interval, endMs: valid[index].openTime - interval, expectedMissingCount: Math.round(difference / interval) - 1 });
  }
  return { valid, malformed, internalDuplicates, gaps };
}

export function summarizeQuality(candles: HistoricalCandleInput[], audit: CandleAudit, timeframe: Timeframe, now = Date.now(), freshnessThresholdMs = timeframeMs[timeframe] * 2): { status: QualityStatus; expected: number; actual: number; latest: number | null } {
  const bounds = candles.reduce<{ earliest: number; latest: number } | null>((current, candle) => current ? { earliest: Math.min(current.earliest, candle.openTime), latest: Math.max(current.latest, candle.closeTime) } : { earliest: candle.openTime, latest: candle.closeTime }, null);
  const latest = bounds?.latest ?? null;
  const earliest = bounds?.earliest ?? null;
  const expected = earliest !== null && latest !== null ? Math.floor((latest - earliest) / timeframeMs[timeframe]) + 1 : 0;
  if (!candles.length) return { status: "MISSING", expected, actual: 0, latest };
  if (now - (latest ?? 0) > freshnessThresholdMs) return { status: "STALE", expected, actual: candles.length, latest };
  if (audit.gaps.length || audit.malformed.length || audit.internalDuplicates.length) return { status: "PARTIAL", expected, actual: candles.length, latest };
  return { status: "COMPLETE", expected, actual: candles.length, latest };
}

export async function createHistoricalDataset(notes: string, basedOnDatasetId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const now = new Date();
  const prefix = `DATASET-${now.toISOString().slice(0, 10)}-`;
  const previous = await db.select().from(historicalDatasets).where(sql`${historicalDatasets.version} LIKE ${`${prefix}%`}`).orderBy(desc(historicalDatasets.id)).limit(1);
  const sequence = previous[0] ? Number(previous[0].version.split("-").at(-1)) + 1 : 1;
  const version = `${prefix}${String(sequence).padStart(3, "0")}`;
  await db.insert(historicalDatasets).values({ version, status: "building", protocolVersion: HISTORICAL_DATA_PROTOCOL_VERSION, basedOnDatasetId: basedOnDatasetId ?? null, ingestionCutoffAt: now, providerManifest: { providers: [], instrumentTypes: [] }, coverageManifest: { state: "building" }, notes });
  const dataset = (await db.select().from(historicalDatasets).where(eq(historicalDatasets.version, version)).limit(1))[0];
  if (!dataset) throw new Error("Historical dataset creation failed.");
  if (basedOnDatasetId) {
    const inheritedQuality = await db.select().from(historicalDataQuality).where(eq(historicalDataQuality.datasetId, basedOnDatasetId));
    if (inheritedQuality.length) await db.insert(historicalDataQuality).values(inheritedQuality.map(row => ({ datasetId: dataset.id, assetId: row.assetId, exchange: row.exchange, provider: row.provider, instrumentType: row.instrumentType, timeframe: row.timeframe, status: row.status, earliestCandleAt: row.earliestCandleAt, latestCandleAt: row.latestCandleAt, expectedCandleCount: row.expectedCandleCount, actualCandleCount: row.actualCandleCount, coveragePercent: row.coveragePercent, missingIntervalCount: row.missingIntervalCount, longestGapMs: row.longestGapMs, duplicateCount: row.duplicateCount, malformedCount: row.malformedCount, qualityScore: row.qualityScore, qualityRating: row.qualityRating, lastSuccessfulIngestionAt: row.lastSuccessfulIngestionAt, lastIngestionRunId: row.lastIngestionRunId, freshnessThresholdMs: row.freshnessThresholdMs, details: { inheritedFromDatasetId: basedOnDatasetId, inheritedDetails: row.details } })));
    const inheritedGaps = await db.select().from(historicalMissingIntervals).where(eq(historicalMissingIntervals.datasetId, basedOnDatasetId));
    if (inheritedGaps.length) await db.insert(historicalMissingIntervals).values(inheritedGaps.map(gap => ({ datasetId: dataset.id, assetId: gap.assetId, exchange: gap.exchange, instrumentType: gap.instrumentType, timeframe: gap.timeframe, gapStartMs: gap.gapStartMs, gapEndMs: gap.gapEndMs, expectedMissingCount: gap.expectedMissingCount })));
  }
  return dataset;
}

export async function ingestHistoricalCandleBatch(scope: HistoricalScope, runKind: "backfill" | "incremental", candles: HistoricalCandleInput[], requestedStartAt?: number, requestedEndAt?: number, sourceDetails?: Record<string, unknown>) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const batchId = `INGEST-${randomUUID()}`;
  const audit = auditHistoricalCandles(candles, scope.timeframe);
  await db.insert(historicalIngestionRuns).values({ batchId, datasetId: scope.datasetId, runKind, status: "running", provider: scope.provider, exchange: scope.exchange, instrumentType: scope.instrumentType, assetId: scope.assetId, timeframes: [scope.timeframe], requestedStartAt: requestedStartAt ? new Date(requestedStartAt) : null, requestedEndAt: requestedEndAt ? new Date(requestedEndAt) : null, insertedCount: 0, duplicateCount: 0, malformedCount: audit.malformed.length, missingIntervalCount: audit.gaps.reduce((sum, gap) => sum + gap.expectedMissingCount, 0), details: { validation: { malformed: audit.malformed.map(item => item.reason), internalDuplicates: audit.internalDuplicates.length }, sourceDetails: sourceDetails ?? null } });
  const run = (await db.select().from(historicalIngestionRuns).where(eq(historicalIngestionRuns.batchId, batchId)).limit(1))[0];
  if (!run) throw new Error("Historical ingestion run creation failed.");
  try {
    const existing = await db.select({ sourceOpenTimeMs: historicalCandles.sourceOpenTimeMs, sourceHash: historicalCandles.sourceHash }).from(historicalCandles).where(and(eq(historicalCandles.assetId, scope.assetId), eq(historicalCandles.exchange, scope.exchange), eq(historicalCandles.instrumentType, scope.instrumentType), eq(historicalCandles.timeframe, scope.timeframe), gte(historicalCandles.sourceOpenTimeMs, requestedStartAt ?? 0), lte(historicalCandles.sourceOpenTimeMs, requestedEndAt ?? Number.MAX_SAFE_INTEGER)));
    const existingKeys = new Set(existing.map(item => `${item.sourceOpenTimeMs}:${item.sourceHash}`));
    const fresh = audit.valid.filter(candle => !existingKeys.has(`${candle.openTime}:${sourceHash(candle)}`));
    const candleRows = fresh.map(candle => ({ ingestionRunId: run.id, assetId: scope.assetId, exchange: scope.exchange, provider: scope.provider, instrumentType: scope.instrumentType, timeframe: scope.timeframe, sourceOpenTimeMs: candle.openTime, sourceCloseTimeMs: candle.closeTime, open: candle.open, high: candle.high, low: candle.low, close: candle.close, volume: candle.volume, sourceHash: sourceHash(candle), sourcePayload: candle.sourcePayload ?? null }));
    for (let offset = 0; offset < candleRows.length; offset += 500) await db.insert(historicalCandles).values(candleRows.slice(offset, offset + 500));
    const scopeCandles = await db.select({ openTime: historicalCandles.sourceOpenTimeMs, closeTime: historicalCandles.sourceCloseTimeMs, open: historicalCandles.open, high: historicalCandles.high, low: historicalCandles.low, close: historicalCandles.close, volume: historicalCandles.volume }).from(historicalCandles).where(and(eq(historicalCandles.assetId, scope.assetId), eq(historicalCandles.exchange, scope.exchange), eq(historicalCandles.instrumentType, scope.instrumentType), eq(historicalCandles.timeframe, scope.timeframe))).orderBy(asc(historicalCandles.sourceOpenTimeMs));
    const allCandleAudit = auditHistoricalCandles(scopeCandles.map(candle => ({ openTime: candle.openTime, closeTime: candle.closeTime, open: candle.open, high: candle.high, low: candle.low, close: candle.close, volume: candle.volume })), scope.timeframe);
    const quality = summarizeQuality(allCandleAudit.valid, allCandleAudit, scope.timeframe);
    const missingCandles = allCandleAudit.gaps.reduce((sum, gap) => sum + gap.expectedMissingCount, 0);
    const longestGapMs = Math.max(0, ...allCandleAudit.gaps.map(gap => gap.endMs - gap.startMs + timeframeMs[scope.timeframe]));
    const qualityRank = calculateCoverageQuality({ expected: quality.expected, actual: quality.actual, missing: missingCandles, longestGapMs, timeframeMs: timeframeMs[scope.timeframe], duplicates: audit.internalDuplicates.length + (audit.valid.length - fresh.length), malformed: audit.malformed.length, stale: quality.status === "STALE", providerState: quality.status === "COMPLETE" ? "completed" : quality.status === "ERROR" ? "failed" : "partial" });
    const qualityDetails = { gaps: allCandleAudit.gaps, malformedReasons: audit.malformed.map(item => item.reason), sourceScope: scope, sourceDetails: sourceDetails ?? null };
    await db.insert(historicalDataQuality).values({ datasetId: scope.datasetId, assetId: scope.assetId, exchange: scope.exchange, provider: scope.provider, instrumentType: scope.instrumentType, timeframe: scope.timeframe, status: quality.status, earliestCandleAt: allCandleAudit.valid[0] ? new Date(allCandleAudit.valid[0].openTime) : null, latestCandleAt: quality.latest ? new Date(quality.latest) : null, expectedCandleCount: quality.expected, actualCandleCount: quality.actual, coveragePercent: qualityRank.coveragePercent, missingIntervalCount: missingCandles, longestGapMs, duplicateCount: audit.internalDuplicates.length + (audit.valid.length - fresh.length), malformedCount: audit.malformed.length, qualityScore: qualityRank.qualityScore, qualityRating: qualityRank.qualityRating, lastSuccessfulIngestionAt: new Date(), lastIngestionRunId: run.id, freshnessThresholdMs: timeframeMs[scope.timeframe] * 2, details: qualityDetails }).onDuplicateKeyUpdate({ set: { status: quality.status, earliestCandleAt: allCandleAudit.valid[0] ? new Date(allCandleAudit.valid[0].openTime) : null, latestCandleAt: quality.latest ? new Date(quality.latest) : null, expectedCandleCount: quality.expected, actualCandleCount: quality.actual, coveragePercent: qualityRank.coveragePercent, missingIntervalCount: missingCandles, longestGapMs, duplicateCount: audit.internalDuplicates.length + (audit.valid.length - fresh.length), malformedCount: audit.malformed.length, qualityScore: qualityRank.qualityScore, qualityRating: qualityRank.qualityRating, lastSuccessfulIngestionAt: new Date(), lastIngestionRunId: run.id, details: qualityDetails } });
    if (allCandleAudit.gaps.length) await db.insert(historicalMissingIntervals).values(allCandleAudit.gaps.map(gap => ({ datasetId: scope.datasetId, assetId: scope.assetId, exchange: scope.exchange, instrumentType: scope.instrumentType, timeframe: scope.timeframe, gapStartMs: gap.startMs, gapEndMs: gap.endMs, expectedMissingCount: gap.expectedMissingCount }))).onDuplicateKeyUpdate({ set: { expectedMissingCount: sql`VALUES(expectedMissingCount)`, detectedAt: new Date() } });
    await db.update(historicalIngestionRuns).set({ status: audit.malformed.length || allCandleAudit.gaps.length ? "partial" : "completed", sourceStartAt: audit.valid[0] ? new Date(audit.valid[0].openTime) : null, sourceEndAt: audit.valid.at(-1) ? new Date(audit.valid.at(-1)!.closeTime) : null, insertedCount: fresh.length, duplicateCount: audit.internalDuplicates.length + (audit.valid.length - fresh.length), malformedCount: audit.malformed.length, missingIntervalCount: allCandleAudit.gaps.reduce((sum, gap) => sum + gap.expectedMissingCount, 0), completedAt: new Date() }).where(eq(historicalIngestionRuns.id, run.id));
    return { runId: run.id, batchId, insertedCount: fresh.length, duplicateCount: audit.internalDuplicates.length + (audit.valid.length - fresh.length), malformedCount: audit.malformed.length, gaps: allCandleAudit.gaps, quality: quality.status };
  } catch (error) {
    const message = error instanceof Error ? error.message.replace(/https?:\/\/\S+/g, "provider endpoint") : "Historical ingestion failed.";
    await db.update(historicalIngestionRuns).set({ status: "failed", providerError: message, completedAt: new Date() }).where(eq(historicalIngestionRuns.id, run.id));
    throw error;
  }
}

export async function recomputeHistoricalQuality(datasetId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const rows = await db.select().from(historicalDataQuality).where(eq(historicalDataQuality.datasetId, datasetId));
  for (const row of rows) {
    const candles = await db.select({ openTime: historicalCandles.sourceOpenTimeMs, closeTime: historicalCandles.sourceCloseTimeMs, open: historicalCandles.open, high: historicalCandles.high, low: historicalCandles.low, close: historicalCandles.close, volume: historicalCandles.volume }).from(historicalCandles).where(and(eq(historicalCandles.assetId, row.assetId), eq(historicalCandles.exchange, row.exchange), eq(historicalCandles.instrumentType, row.instrumentType), eq(historicalCandles.timeframe, row.timeframe))).orderBy(asc(historicalCandles.sourceOpenTimeMs));
    const audit = auditHistoricalCandles(candles.map(candle => ({ openTime: candle.openTime, closeTime: candle.closeTime, open: candle.open, high: candle.high, low: candle.low, close: candle.close, volume: candle.volume })), row.timeframe);
    const quality = summarizeQuality(audit.valid, audit, row.timeframe);
    const missingCandles = audit.gaps.reduce((sum, gap) => sum + gap.expectedMissingCount, 0);
    const longestGapMs = Math.max(0, ...audit.gaps.map(gap => gap.endMs - gap.startMs + timeframeMs[row.timeframe]));
    const providerState = quality.status === "ERROR" ? "failed" : quality.status === "MISSING" || quality.status === "PARTIAL" ? "partial" : "completed";
    const qualityRank = calculateCoverageQuality({ expected: quality.expected, actual: quality.actual, missing: missingCandles, longestGapMs, timeframeMs: timeframeMs[row.timeframe], duplicates: row.duplicateCount, malformed: row.malformedCount, stale: quality.status === "STALE", providerState });
    await db.update(historicalDataQuality).set({ status: quality.status, earliestCandleAt: audit.valid[0] ? new Date(audit.valid[0].openTime) : null, latestCandleAt: quality.latest ? new Date(quality.latest) : null, expectedCandleCount: quality.expected, actualCandleCount: quality.actual, coveragePercent: qualityRank.coveragePercent, missingIntervalCount: missingCandles, longestGapMs, qualityScore: qualityRank.qualityScore, qualityRating: qualityRank.qualityRating, details: { ...(row.details as Record<string, unknown>), qualityRecomputedAt: new Date().toISOString(), qualityFormula: "coverage-45-continuity-25-freshness-15-integrity-10-provider-5" } }).where(eq(historicalDataQuality.id, row.id));
  }
  return { datasetId, scopesRecomputed: rows.length };
}

export async function sealHistoricalDataset(datasetId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const qualityRows = await db.select().from(historicalDataQuality).where(eq(historicalDataQuality.datasetId, datasetId));
  const runs = await db.select().from(historicalIngestionRuns).where(eq(historicalIngestionRuns.datasetId, datasetId));
  const coverageManifest = { scopes: qualityRows.map(row => ({ assetId: row.assetId, instrumentType: row.instrumentType, timeframe: row.timeframe, status: row.status, earliestCandleAt: row.earliestCandleAt?.toISOString() ?? null, latestCandleAt: row.latestCandleAt?.toISOString() ?? null, expected: row.expectedCandleCount, actual: row.actualCandleCount, gaps: row.missingIntervalCount })), ingestionRuns: runs.map(run => ({ batchId: run.batchId, status: run.status, provider: run.provider, inserted: run.insertedCount, malformed: run.malformedCount, duplicates: run.duplicateCount })) };
  const providerManifest = { providers: Array.from(new Set(runs.map(run => run.provider))), exchangeInstrumentPairs: Array.from(new Set(runs.map(run => `${run.exchange}:${run.instrumentType}`))), completedCandleOnly: true };
  const contentFingerprint = createHash("sha256").update(stable({ coverageManifest, providerManifest })).digest("hex");
  await db.update(historicalDatasets).set({ status: "sealed", providerManifest, coverageManifest, contentFingerprint, sealedAt: new Date() }).where(eq(historicalDatasets.id, datasetId));
  return { datasetId, providerManifest, coverageManifest, contentFingerprint };
}

export async function listHistoricalDataQuality(datasetId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (!datasetId) return db.select().from(historicalDataQuality).orderBy(desc(historicalDataQuality.createdAt));
  const dataset = (await db.select().from(historicalDatasets).where(eq(historicalDatasets.id, datasetId)).limit(1))[0];
  if (!dataset || dataset.status !== "sealed" || !dataset.sealedAt) return [];
  return db.select().from(historicalDataQuality).where(eq(historicalDataQuality.datasetId, datasetId)).orderBy(desc(historicalDataQuality.createdAt));
}

export async function listHistoricalDatasets() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(historicalDatasets).where(eq(historicalDatasets.status, "sealed")).orderBy(desc(historicalDatasets.sealedAt));
}
