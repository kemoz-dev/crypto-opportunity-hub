import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { assets, executionCostModels, executionCostStudies, historicalCandles, historicalDatasets, historicalFundingRates, historicalLiquidityObservations, historicalMarketCaps } from "../../drizzle/schema";
import type { Timeframe } from "../../shared/crypto";
import { getDb } from "../db";
import { calculateNetOutcome, calculateStressScenarios, calculateCostSensitivity, classifyLiquidityTier, type Availability, type ExecutionCostModel, type ExecutionInstrumentType, type HistoricalExecutionState, type HistoricalFundingState, type HistoricalLiquidityState, type HistoricalTrade, type LiquidityTier, type TradeSide } from "./executionCostEngine";
import { timeframeMs } from "./historicalData";
import { fetchBinanceHistoricalFundingRates } from "./providers";

const COST_MODEL_VERSION = "EXECUTION_COST_LIQUIDITY_RESEARCH_V1";
const EXCHANGE = "Binance";
const FUNDING_SOURCE = "Binance USD-M funding history";

const stable = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
  return JSON.stringify(value);
};
const fingerprint = (value: unknown) => createHash("sha256").update(stable(value)).digest("hex");
const sanitize = (error: unknown) => error instanceof Error ? error.message.replace(/https?:\/\/\S+/g, "provider endpoint") : "Execution-cost study failed.";

export type ExecutionCostStudyInput = {
  name: string;
  datasetId: number;
  assetId: string;
  timeframe: Timeframe;
  instrumentType: ExecutionInstrumentType;
  side: TradeSide;
  entryAt: number;
  exitAt: number;
  tradeSizeUsd: number;
  fee: { entryKind: "maker" | "taker"; entryPercent: number; exitKind: "maker" | "taker"; exitPercent: number; source: string };
  slippage: { entryBps: number; exitBps: number; source: string };
  liquidityImpact: { enabled: boolean; lookbackHours: number; participationCoefficient: number; capBps: number; source: string };
  funding: { mode: "ACTUAL" | "ASSUMED" | "EXCLUDED" | "UNAVAILABLE"; assumedPercent?: number | null; source?: string | null };
};

type ClosedCandle = { openTime: number; closeTime: number; close: number; volume: number };

function buildCostModel(input: ExecutionCostStudyInput): ExecutionCostModel {
  return {
    version: COST_MODEL_VERSION,
    instrumentType: input.instrumentType,
    exchange: EXCHANGE,
    applicability: { assetId: input.assetId, tradeSizeUsd: input.tradeSizeUsd },
    fee: { entry: { kind: input.fee.entryKind, percent: input.fee.entryPercent, source: input.fee.source }, exit: { kind: input.fee.exitKind, percent: input.fee.exitPercent, source: input.fee.source } },
    slippage: { mode: "FIXED", entryBps: input.slippage.entryBps, exitBps: input.slippage.exitBps, source: input.slippage.source },
    liquidityImpact: { mode: input.liquidityImpact.enabled ? "ESTIMATED_VOLUME_IMPACT" : "NONE", lookbackHours: input.liquidityImpact.lookbackHours, participationCoefficient: input.liquidityImpact.participationCoefficient, capBps: input.liquidityImpact.capBps, source: input.liquidityImpact.source },
    funding: input.instrumentType === "spot" ? { mode: "EXCLUDED", source: "Spot funding is not applicable" } : input.funding,
  };
}

async function selectedDataset(datasetId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const dataset = (await db.select().from(historicalDatasets).where(eq(historicalDatasets.id, datasetId)).limit(1))[0];
  if (!dataset || dataset.status !== "sealed" || !dataset.sealedAt) throw new Error("Select a sealed historical dataset before calculating execution costs.");
  return dataset;
}

async function selectedAsset(assetId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const asset = (await db.select().from(assets).where(eq(assets.id, assetId)).limit(1))[0];
  if (!asset) throw new Error("Select a configured historical asset.");
  return asset;
}

async function candlesBefore(datasetId: number, sealedAt: Date, assetId: string, instrumentType: ExecutionInstrumentType, timeframe: Timeframe, at: number, startAt?: number): Promise<ClosedCandle[]> {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const rows = await db.select({ id: historicalCandles.id, openTime: historicalCandles.sourceOpenTimeMs, closeTime: historicalCandles.sourceCloseTimeMs, close: historicalCandles.close, volume: historicalCandles.volume, ingestedAt: historicalCandles.ingestedAt }).from(historicalCandles).where(and(eq(historicalCandles.assetId, assetId), eq(historicalCandles.exchange, EXCHANGE), eq(historicalCandles.instrumentType, instrumentType), eq(historicalCandles.timeframe, timeframe), lte(historicalCandles.sourceCloseTimeMs, at), startAt === undefined ? undefined : gte(historicalCandles.sourceCloseTimeMs, startAt), lte(historicalCandles.ingestedAt, sealedAt))).orderBy(desc(historicalCandles.ingestedAt), desc(historicalCandles.id));
  const newestByOpen = new Map<number, ClosedCandle>();
  for (const row of rows) if (!newestByOpen.has(row.openTime)) newestByOpen.set(row.openTime, { openTime: row.openTime, closeTime: row.closeTime, close: row.close, volume: row.volume });
  return Array.from(newestByOpen.values()).sort((left, right) => left.openTime - right.openTime);
}

async function liquidityState(datasetId: number, sealedAt: Date, assetId: string, instrumentType: ExecutionInstrumentType, timeframe: Timeframe, at: number, lookbackHours: number): Promise<HistoricalLiquidityState> {
  const windowMs = Math.max(1, lookbackHours) * 60 * 60_000;
  const candles = await candlesBefore(datasetId, sealedAt, assetId, instrumentType, timeframe, at, at - windowMs);
  const expectedBars = Math.max(1, Math.floor(windowMs / timeframeMs[timeframe]));
  const quoteVolume = candles.reduce((sum, candle) => sum + candle.close * candle.volume, 0);
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const cap = (await db.select().from(historicalMarketCaps).where(and(eq(historicalMarketCaps.datasetId, datasetId), eq(historicalMarketCaps.assetId, assetId), eq(historicalMarketCaps.availability, "AVAILABLE"), lte(historicalMarketCaps.sourceObservedAt, new Date(at)))).orderBy(desc(historicalMarketCaps.sourceObservedAt)).limit(1))[0];
  const status: Availability = !candles.length ? "UNAVAILABLE" : candles.length >= expectedBars * 0.95 ? "AVAILABLE" : "PARTIAL";
  const marketCap = cap?.marketCap ?? null;
  const ratio = marketCap && marketCap > 0 ? quoteVolume / marketCap : null;
  return { status, tier: status === "UNAVAILABLE" ? "UNAVAILABLE" : classifyLiquidityTier(quoteVolume), quoteVolume: status === "UNAVAILABLE" ? null : quoteVolume, marketCap, volumeMarketCapRatio: ratio, observedBars: candles.length, expectedBars, source: "Sealed Binance historical OHLCV", observedAt: candles.at(-1)?.closeTime ?? null };
}

async function persistLiquidityObservation(datasetId: number, assetId: string, instrumentType: ExecutionInstrumentType, timeframe: Timeframe, state: HistoricalLiquidityState, at: number, lookbackHours: number) {
  const db = await getDb();
  if (!db || state.observedAt === null) return;
  const exists = (await db.select({ id: historicalLiquidityObservations.id }).from(historicalLiquidityObservations).where(and(eq(historicalLiquidityObservations.datasetId, datasetId), eq(historicalLiquidityObservations.assetId, assetId), eq(historicalLiquidityObservations.exchange, EXCHANGE), eq(historicalLiquidityObservations.instrumentType, instrumentType), eq(historicalLiquidityObservations.timeframe, timeframe), eq(historicalLiquidityObservations.observedAt, new Date(state.observedAt)))).limit(1))[0];
  if (exists) return;
  await db.insert(historicalLiquidityObservations).values({ datasetId, assetId, exchange: EXCHANGE, instrumentType, timeframe, observedAt: new Date(state.observedAt), windowStartAt: new Date(at - lookbackHours * 60 * 60_000), windowEndAt: new Date(at), quoteVolume: state.quoteVolume, marketCap: state.marketCap, volumeMarketCapRatio: state.volumeMarketCapRatio, liquidityTier: state.tier, dataQuality: state.status, source: state.source, evidence: { observedBars: state.observedBars, expectedBars: state.expectedBars, classification: "point-in-time OHLCV quote-volume tier" } });
}

async function existingFunding(datasetId: number, assetId: string, entryAt: number, exitAt: number): Promise<HistoricalFundingState | null> {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const rows = await db.select().from(historicalFundingRates).where(and(eq(historicalFundingRates.datasetId, datasetId), eq(historicalFundingRates.assetId, assetId), eq(historicalFundingRates.source, FUNDING_SOURCE), gte(historicalFundingRates.fundingTime, new Date(entryAt)), lte(historicalFundingRates.fundingTime, new Date(exitAt)))).orderBy(historicalFundingRates.fundingTime);
  if (!rows.length) return null;
  return { status: rows.some(row => row.dataQuality === "PARTIAL") ? "PARTIAL" : "AVAILABLE", cumulativeRatePercent: rows.reduce((sum, row) => sum + row.fundingRate * 100, 0), recordCount: rows.length, source: FUNDING_SOURCE, intervalEvidence: Array.from(new Set(rows.map(row => row.intervalEvidence))).join(", ") };
}

async function actualFunding(datasetId: number, assetId: string, symbol: string, entryAt: number, exitAt: number): Promise<HistoricalFundingState> {
  const cached = await existingFunding(datasetId, assetId, entryAt, exitAt);
  if (cached) return cached;
  try {
    const publicFacts = await fetchBinanceHistoricalFundingRates(symbol, entryAt, exitAt);
    const db = await getDb();
    if (!db) throw new Error("Database is unavailable.");
    if (publicFacts.length) {
      await db.insert(historicalFundingRates).values(publicFacts.map((fact, index) => ({ datasetId, assetId, exchange: EXCHANGE, symbol: fact.symbol, fundingTime: new Date(fact.fundingTime), fundingRate: fact.fundingRate, markPrice: fact.markPrice, rateType: fact.rateType, fundingIntervalMs: index ? fact.fundingTime - publicFacts[index - 1]!.fundingTime : null, intervalEvidence: index ? "DERIVED_FROM_ADJACENT_SETTLEMENT" : "NOT_PROVIDED_BY_SOURCE", dataQuality: "AVAILABLE" as const, source: FUNDING_SOURCE, sourcePayload: fact }))).onDuplicateKeyUpdate({ set: { id: sql`id` } });
    }
    return { status: "AVAILABLE", cumulativeRatePercent: publicFacts.reduce((sum, fact) => sum + fact.fundingRate * 100, 0), recordCount: publicFacts.length, source: FUNDING_SOURCE, intervalEvidence: publicFacts.length > 1 ? "DERIVED_FROM_ADJACENT_SETTLEMENT" : "NOT_PROVIDED_BY_SOURCE", ...(publicFacts.length ? {} : { reason: "No funding settlement occurred inside the selected holding window." }) };
  } catch (error) {
    return { status: "UNAVAILABLE", cumulativeRatePercent: null, recordCount: 0, source: FUNDING_SOURCE, intervalEvidence: null, reason: sanitize(error) };
  }
}

async function fundingState(input: ExecutionCostStudyInput, assetSymbol: string, model: ExecutionCostModel, allowFundingFetch: boolean): Promise<HistoricalFundingState> {
  if (input.instrumentType === "spot") return { status: "AVAILABLE", cumulativeRatePercent: 0, recordCount: 0, source: null, intervalEvidence: null, reason: "Spot funding is excluded." };
  if (model.funding.mode === "UNAVAILABLE") return { status: "UNAVAILABLE", cumulativeRatePercent: null, recordCount: 0, source: null, intervalEvidence: null, reason: "FUNDING DATA UNAVAILABLE by declared model." };
  if (model.funding.mode === "ASSUMED" || model.funding.mode === "EXCLUDED") return { status: "AVAILABLE", cumulativeRatePercent: model.funding.mode === "EXCLUDED" ? 0 : null, recordCount: 0, source: model.funding.source ?? null, intervalEvidence: null };
  const cached = await existingFunding(input.datasetId, input.assetId, input.entryAt, input.exitAt);
  if (cached) return cached;
  if (!allowFundingFetch) return { status: "UNAVAILABLE", cumulativeRatePercent: null, recordCount: 0, source: FUNDING_SOURCE, intervalEvidence: null, reason: "No cached historical funding evidence exists for preview. Persist a study to retrieve and preserve public funding evidence." };
  return actualFunding(input.datasetId, input.assetId, assetSymbol, input.entryAt, input.exitAt);
}

async function assembleStudy(input: ExecutionCostStudyInput, persistLiquidity: boolean, allowFundingFetch: boolean) {
  const [dataset, asset] = await Promise.all([selectedDataset(input.datasetId), selectedAsset(input.assetId)]);
  if (input.exitAt < input.entryAt) throw new Error("Exit time must be at or after entry time.");
  const [entryCandle, exitCandle] = await Promise.all([
    candlesBefore(dataset.id, dataset.sealedAt!, input.assetId, input.instrumentType, input.timeframe, input.entryAt),
    candlesBefore(dataset.id, dataset.sealedAt!, input.assetId, input.instrumentType, input.timeframe, input.exitAt),
  ]);
  const entry = entryCandle.at(-1);
  const exit = exitCandle.at(-1);
  if (!entry || !exit) throw new Error("No completed stored candles are available at one or both selected timestamps for this dataset, asset, instrument, and timeframe.");
  const model = buildCostModel(input);
  const [entryLiquidity, exitLiquidity, funding] = await Promise.all([
    liquidityState(dataset.id, dataset.sealedAt!, input.assetId, input.instrumentType, input.timeframe, entry.closeTime, model.liquidityImpact.lookbackHours),
    liquidityState(dataset.id, dataset.sealedAt!, input.assetId, input.instrumentType, input.timeframe, exit.closeTime, model.liquidityImpact.lookbackHours),
    fundingState(input, asset.binanceSymbol, model, allowFundingFetch),
  ]);
  if (persistLiquidity) await Promise.all([persistLiquidityObservation(dataset.id, input.assetId, input.instrumentType, input.timeframe, entryLiquidity, entry.closeTime, model.liquidityImpact.lookbackHours), persistLiquidityObservation(dataset.id, input.assetId, input.instrumentType, input.timeframe, exitLiquidity, exit.closeTime, model.liquidityImpact.lookbackHours)]);
  const trade: HistoricalTrade = { side: input.side, instrumentType: input.instrumentType, tradeSizeUsd: input.tradeSizeUsd, grossEntryPrice: entry.close, grossExitPrice: exit.close, entryAt: entry.closeTime, exitAt: exit.closeTime };
  const state: HistoricalExecutionState = { entryLiquidity, exitLiquidity, funding, orderBookStatus: "UNAVAILABLE" };
  const provenance = { protocolVersion: COST_MODEL_VERSION, dataset: { id: dataset.id, version: dataset.version, fingerprint: dataset.contentFingerprint, sealedAt: dataset.sealedAt, ingestionCutoffAt: dataset.ingestionCutoffAt }, source: { ohlcv: "Sealed Binance historical OHLCV", orderBook: "HISTORICAL ORDER-BOOK DATA UNAVAILABLE", funding: funding.source, fundingIntervalEvidence: funding.intervalEvidence }, pointInTime: { entryCandleClose: new Date(entry.closeTime).toISOString(), exitCandleClose: new Date(exit.closeTime).toISOString(), entryLiquidityObservedAt: entryLiquidity.observedAt ? new Date(entryLiquidity.observedAt).toISOString() : null, exitLiquidityObservedAt: exitLiquidity.observedAt ? new Date(exitLiquidity.observedAt).toISOString() : null }, availability: { entryLiquidity: entryLiquidity.status, exitLiquidity: exitLiquidity.status, funding: funding.status } };
  return { dataset, asset, model, trade, state, provenance };
}

export async function previewExecutionCostStudy(input: ExecutionCostStudyInput) {
  const assembled = await assembleStudy(input, false, false);
  return { model: assembled.model, trade: assembled.trade, state: assembled.state, provenance: assembled.provenance, outcome: calculateNetOutcome(assembled.trade, assembled.state, assembled.model), sensitivity: calculateCostSensitivity(assembled.trade, assembled.state, assembled.model, { feesPercent: [0.05, 0.1, 0.15, 0.2], slippagePercent: [0, 0.05, 0.1, 0.2, 0.5], tradeSizesUsd: [1_000, 5_000, 10_000, 50_000, 100_000] }), stress: calculateStressScenarios(assembled.trade, assembled.state, assembled.model) };
}

async function findOrCreateCostModel(userId: number, name: string, model: ExecutionCostModel) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const configurationFingerprint = fingerprint(model);
  const existing = (await db.select().from(executionCostModels).where(and(eq(executionCostModels.userId, userId), eq(executionCostModels.configurationFingerprint, configurationFingerprint))).limit(1))[0];
  if (existing) return existing;
  await db.insert(executionCostModels).values({ userId, name, version: model.version, configurationFingerprint, configuration: model });
  const created = (await db.select().from(executionCostModels).where(and(eq(executionCostModels.userId, userId), eq(executionCostModels.configurationFingerprint, configurationFingerprint))).limit(1))[0];
  if (!created) throw new Error("Execution cost model persistence failed.");
  return created;
}

export async function createExecutionCostStudy(userId: number, input: ExecutionCostStudyInput) {
  const provisional = await assembleStudy({ ...input, funding: input.instrumentType === "perpetual" && input.funding.mode === "ACTUAL" ? { ...input.funding, mode: "UNAVAILABLE" } : input.funding }, true, false);
  const model = buildCostModel(input);
  const savedModel = await findOrCreateCostModel(userId, input.name, model);
  const configuration = { protocolVersion: COST_MODEL_VERSION, input, model, costModelId: savedModel.id };
  const configurationFingerprint = fingerprint(configuration);
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  await db.insert(executionCostStudies).values({ userId, modelId: savedModel.id, name: input.name, status: "running", datasetId: provisional.dataset.id, datasetVersion: provisional.dataset.version, datasetFingerprint: provisional.dataset.contentFingerprint, assetId: input.assetId, exchange: EXCHANGE, instrumentType: input.instrumentType, timeframe: input.timeframe, entryAt: new Date(provisional.trade.entryAt), exitAt: new Date(provisional.trade.exitAt), tradeSizeUsd: input.tradeSizeUsd, grossEntryPrice: provisional.trade.grossEntryPrice, grossExitPrice: provisional.trade.grossExitPrice, grossReturnPercent: (provisional.trade.grossExitPrice - provisional.trade.grossEntryPrice) / provisional.trade.grossEntryPrice * 100, configurationFingerprint, configuration, dataProvenance: provisional.provenance });
  const study = (await db.select().from(executionCostStudies).where(and(eq(executionCostStudies.userId, userId), eq(executionCostStudies.configurationFingerprint, configurationFingerprint))).orderBy(desc(executionCostStudies.id)).limit(1))[0];
  if (!study) throw new Error("Execution cost study persistence failed.");
  try {
    const assembled = await assembleStudy(input, true, true);
    const outcome = calculateNetOutcome(assembled.trade, assembled.state, assembled.model);
    const resultSnapshot = { generatedAt: new Date().toISOString(), trade: assembled.trade, outcome, sensitivity: calculateCostSensitivity(assembled.trade, assembled.state, assembled.model, { feesPercent: [0.05, 0.1, 0.15, 0.2], slippagePercent: [0, 0.05, 0.1, 0.2, 0.5], tradeSizesUsd: [1_000, 5_000, 10_000, 50_000, 100_000] }), stress: calculateStressScenarios(assembled.trade, assembled.state, assembled.model), model: assembled.model, protocol: COST_MODEL_VERSION };
    await db.update(executionCostStudies).set({ status: "completed", dataProvenance: assembled.provenance, resultSnapshot, completedAt: new Date() }).where(eq(executionCostStudies.id, study.id));
    return { id: study.id, status: "completed" as const, configurationFingerprint, ...resultSnapshot, provenance: assembled.provenance };
  } catch (error) {
    await db.update(executionCostStudies).set({ status: "failed", errorMessage: sanitize(error), completedAt: new Date() }).where(eq(executionCostStudies.id, study.id));
    throw error;
  }
}

export async function listExecutionCostStudies(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(executionCostStudies).where(eq(executionCostStudies.userId, userId)).orderBy(desc(executionCostStudies.createdAt));
}

export async function getExecutionCostStudy(userId: number, studyId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const study = (await db.select().from(executionCostStudies).where(and(eq(executionCostStudies.id, studyId), eq(executionCostStudies.userId, userId))).limit(1))[0];
  if (!study) throw new Error("Execution cost study not found.");
  return study;
}

export async function exportExecutionCostStudy(userId: number, studyId: number, format: "json" | "csv") {
  const study = await getExecutionCostStudy(userId, studyId);
  if (format === "json") return { filename: `execution-cost-study-${study.id}.json`, mimeType: "application/json", content: JSON.stringify(study, null, 2) };
  const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const header = ["studyId", "name", "status", "datasetId", "datasetVersion", "datasetFingerprint", "assetId", "exchange", "instrumentType", "timeframe", "entryAt", "exitAt", "tradeSizeUsd", "grossEntryPrice", "grossExitPrice", "grossReturnPercent", "configurationFingerprint", "configurationJson", "dataProvenanceJson", "resultSnapshotJson", "createdAt", "completedAt"];
  const row = [study.id, study.name, study.status, study.datasetId, study.datasetVersion, study.datasetFingerprint, study.assetId, study.exchange, study.instrumentType, study.timeframe, study.entryAt.toISOString(), study.exitAt.toISOString(), study.tradeSizeUsd, study.grossEntryPrice, study.grossExitPrice, study.grossReturnPercent, study.configurationFingerprint, JSON.stringify(study.configuration), JSON.stringify(study.dataProvenance), JSON.stringify(study.resultSnapshot), study.createdAt.toISOString(), study.completedAt?.toISOString() ?? null].map(escape).join(",");
  return { filename: `execution-cost-study-${study.id}.csv`, mimeType: "text/csv", content: [header.join(","), row].join("\n") };
}
