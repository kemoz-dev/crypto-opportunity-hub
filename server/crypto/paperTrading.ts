import { and, asc, eq } from "drizzle-orm";
import { paperPortfolios, paperTradeMonitoringEvents, paperTrades } from "../../drizzle/schema";
import type { OpportunityScore, ScannerResponse, ScoringConfig, ScannerRow } from "../../shared/crypto";
import { getDb } from "../db";
import { buildLiveScanner, getScannerLiveOhlcvBundle } from "./marketService";
import { buildTradeHealth, getTradeSetupForRow, type TradeSetupMode, type TradeSetupPlan } from "./tradeSetup";
import { buildLowTimeframeTradeHealth, getLowTimeframeScalpingIntelligence, type LowTimeframeScalpingPlan } from "./lowTimeframeScalping";

export type PaperTradeSetupMode = TradeSetupMode | "LOW_TIMEFRAME_SCALPING";

export type PaperTradeSnapshot = {
  scannerGeneratedAt: number;
  asset: { id: string; symbol: string; name: string; sector: string; price: number };
  dataStatus: ScannerRow["dataStatus"];
  opportunity: OpportunityScore;
  marketRegime: ScannerResponse["marketRegime"];
  configuration: ScoringConfig;
  observation: {
    timestamp: number;
    asset: string;
    sector: string;
    timeframes: string[];
    opportunityScore: number;
    confidenceScore: number;
    technicalScore: number;
    setupType: string;
    entryPrice: number;
    stopLoss: number;
    target: number;
    exactScoringComponents: OpportunityScore["reasons"];
    missingConditions: string[];
  };
  setupPlan?: TradeSetupPlan;
  lowTimeframeScalpingPlan?: LowTimeframeScalpingPlan;
};

function round(value: number, digits = 2) { return Number(value.toFixed(digits)); }

export function calculatePaperEntryTerms(entryPrice: number, atrPercent: number, side: "long" | "short", accountEquity: number, riskPercent: number) {
  const stopDistance = entryPrice * Math.max(atrPercent * 1.5 / 100, 0.003);
  const stopLoss = side === "long" ? entryPrice - stopDistance : entryPrice + stopDistance;
  const takeProfit = side === "long" ? entryPrice + stopDistance * 2 : entryPrice - stopDistance * 2;
  const positionSize = (accountEquity * (riskPercent / 100)) / stopDistance;
  return { stopLoss: round(stopLoss, 8), takeProfit: round(takeProfit, 8), positionSize: round(positionSize, 8), rewardRisk: 2 };
}

export function cloneImmutableEntrySnapshot<T>(snapshot: T): T {
  return JSON.parse(JSON.stringify(snapshot)) as T;
}

export function buildPaperTradeSnapshot(row: ScannerRow, marketRegime: ScannerResponse["marketRegime"], generatedAt: number, configuration: ScoringConfig, terms: { stopLoss: number; takeProfit: number }, setupPlan?: TradeSetupPlan, lowTimeframeScalpingPlan?: LowTimeframeScalpingPlan): PaperTradeSnapshot {
  if (!row.score || row.asset.price === null) throw new Error("A score and live price are required to create a paper-trade observation snapshot.");
  return cloneImmutableEntrySnapshot({
    scannerGeneratedAt: generatedAt,
    asset: { id: row.asset.id, symbol: row.asset.symbol, name: row.asset.name, sector: row.asset.sector, price: row.asset.price },
    dataStatus: row.dataStatus,
    opportunity: row.score,
    marketRegime,
    configuration,
    observation: {
      timestamp: generatedAt,
      asset: row.asset.symbol,
      sector: row.asset.sector,
      timeframes: row.score.technicalByTimeframe.map(item => item.timeframe),
      opportunityScore: row.score.score,
      confidenceScore: row.score.confidence,
      technicalScore: row.score.technicalScore,
      setupType: row.score.setupType,
      entryPrice: row.asset.price,
      stopLoss: terms.stopLoss,
      target: terms.takeProfit,
      exactScoringComponents: row.score.reasons,
      missingConditions: row.score.missingConditions,
    },
    ...(setupPlan ? { setupPlan } : {}),
    ...(lowTimeframeScalpingPlan ? { lowTimeframeScalpingPlan } : {}),
  });
}

export type PaperTradePresentationInput = { id?: number; assetId: string; status: string; side: string; entryPrice: number; positionSize: number; realizedPnl: number | null; exitPrice: number | null; entryAt: Date; exitAt: Date | null };

export function buildPaperPortfolioPresentation(startingCapital: number, trades: PaperTradePresentationInput[], currentPrices: Map<string, number>) {
  const closed = trades.filter(trade => trade.status === "closed" && trade.realizedPnl !== null);
  const open = trades.filter(trade => trade.status === "open");
  const realizedPnl = closed.reduce((sum, trade) => sum + (trade.realizedPnl ?? 0), 0);
  const unrealizedPnl = open.reduce((sum, trade) => {
    const price = currentPrices.get(trade.assetId);
    if (!price) return sum;
    return sum + (trade.side === "long" ? price - trade.entryPrice : trade.entryPrice - price) * trade.positionSize;
  }, 0);
  const returns = closed.map(trade => (trade.realizedPnl ?? 0) / Math.max(trade.entryPrice * trade.positionSize, Number.EPSILON));
  const wins = closed.filter(trade => (trade.realizedPnl ?? 0) > 0);
  const losses = closed.filter(trade => (trade.realizedPnl ?? 0) < 0);
  const grossProfit = wins.reduce((sum, trade) => sum + (trade.realizedPnl ?? 0), 0);
  const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + (trade.realizedPnl ?? 0), 0));
  let peak = startingCapital;
  let equity = startingCapital;
  let maxDrawdown = 0;
  const equityCurve: Array<{ timestamp: number; equity: number; kind: "INITIAL" | "CLOSED_TRADE" | "CURRENT" }> = [{ timestamp: 0, equity: round(startingCapital), kind: "INITIAL" }];
  [...closed].sort((left, right) => (left.exitAt?.getTime() ?? 0) - (right.exitAt?.getTime() ?? 0)).forEach(trade => {
    equity += trade.realizedPnl ?? 0;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, (peak - equity) / peak * 100);
    equityCurve.push({ timestamp: trade.exitAt?.getTime() ?? trade.entryAt.getTime(), equity: round(equity), kind: "CLOSED_TRADE" as const });
  });
  const currentEquity = round(startingCapital + realizedPnl + unrealizedPnl);
  if (open.length) equityCurve.push({ timestamp: Date.now(), equity: currentEquity, kind: "CURRENT" as const });
  const mean = returns.length ? returns.reduce((sum, value) => sum + value, 0) / returns.length : 0;
  const variance = returns.length > 1 ? returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1) : 0;
  const sharpe = variance > 0 ? mean / Math.sqrt(variance) * Math.sqrt(returns.length) : null;
  const openNotional = open.reduce((sum, trade) => sum + trade.entryPrice * trade.positionSize, 0);
  return {
    startingCapital,
    currentEquity,
    availableCash: round(startingCapital + realizedPnl - openNotional),
    realizedPnl: round(realizedPnl),
    unrealizedPnl: round(unrealizedPnl),
    totalPnl: round(realizedPnl + unrealizedPnl),
    totalReturnPercent: startingCapital > 0 ? round((realizedPnl + unrealizedPnl) / startingCapital * 100) : null,
    winRate: closed.length ? round(wins.length / closed.length * 100) : null,
    averageWin: wins.length ? round(grossProfit / wins.length) : null,
    averageLoss: losses.length ? round(losses.reduce((sum, trade) => sum + (trade.realizedPnl ?? 0), 0) / losses.length) : null,
    openPositions: open.length,
    closedPositions: closed.length,
    tradeCount: trades.length,
    averageReturn: returns.length ? round(mean * 100) : null,
    averageR: returns.length ? round(mean * 100) : null,
    maxDrawdown: round(maxDrawdown),
    profitFactor: grossLoss > 0 ? round(grossProfit / grossLoss) : grossProfit > 0 ? null : 0,
    sharpeRatio: sharpe === null ? null : round(sharpe),
    equityCurve,
  };
}

async function getOrCreatePortfolio(userId: number, paperCapital: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; the paper portfolio cannot be loaded.");
  const existing = (await db.select().from(paperPortfolios).where(eq(paperPortfolios.userId, userId)).orderBy(asc(paperPortfolios.id)).limit(1))[0];
  if (existing) return existing;
  await db.insert(paperPortfolios).values({ userId, name: "Primary paper portfolio", startingCapital: paperCapital, currentEquity: paperCapital });
  const created = (await db.select().from(paperPortfolios).where(eq(paperPortfolios.userId, userId)).orderBy(asc(paperPortfolios.id)).limit(1))[0];
  if (!created) throw new Error("Paper portfolio creation failed.");
  return created;
}

export async function openLivePaperTrade(userId: number, assetId: string, side: "long" | "short", riskPercent: number, configuration: ScoringConfig, setupMode?: PaperTradeSetupMode) {
  const scan = await buildLiveScanner(false, configuration);
  const row = scan.rows.find(candidate => candidate.asset.id === assetId);
  if (!row?.score || row.asset.price === null) throw new Error("A current live score and price are required before opening a paper trade.");
  const portfolio = await getOrCreatePortfolio(userId, configuration.paperCapital);
  const atrPercent = row.score.technicalByTimeframe.find(item => item.timeframe === "4h")?.atrPercent ?? row.score.technicalByTimeframe.at(0)?.atrPercent ?? null;
  if (atrPercent === null) throw new Error("ATR is unavailable, so a risk-normalized stop cannot be calculated.");
  const entryPrice = row.asset.price;
  const terms = calculatePaperEntryTerms(entryPrice, atrPercent, side, portfolio.currentEquity, riskPercent);
  const setupPlan = setupMode && setupMode !== "LOW_TIMEFRAME_SCALPING" ? await getTradeSetupForRow(setupMode, row, scan.marketRegime, configuration, undefined, getScannerLiveOhlcvBundle(scan, row.asset.symbol)) : undefined;
  if (setupPlan && (!setupPlan.actionable || setupPlan.direction.toLowerCase() !== side)) throw new Error("The current validated setup plan is unavailable or does not support the selected simulated direction.");
  const lowTimeframeScalpingPlan = setupMode === "LOW_TIMEFRAME_SCALPING" ? (await getLowTimeframeScalpingIntelligence(configuration, [assetId])).setups[0] : undefined;
  if (lowTimeframeScalpingPlan && (!lowTimeframeScalpingPlan.actionable || lowTimeframeScalpingPlan.direction.toLowerCase() !== side)) throw new Error("The current validated low-timeframe Scalping plan is unavailable or does not support the selected simulated direction.");
  const snapshot = buildPaperTradeSnapshot(row, scan.marketRegime, scan.generatedAt, configuration, terms, setupPlan, lowTimeframeScalpingPlan);
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; the paper trade cannot be recorded.");
  await db.insert(paperTrades).values({ portfolioId: portfolio.id, assetId, status: "open", side, entryAt: new Date(scan.generatedAt), entryPrice, stopLoss: terms.stopLoss, takeProfit: [{ label: "2R", price: terms.takeProfit }], positionSize: terms.positionSize, riskPercent, rewardRisk: terms.rewardRisk, immutableEntrySnapshot: snapshot });
  return { entryPrice: round(entryPrice, 8), stopLoss: terms.stopLoss, takeProfit: terms.takeProfit, positionSize: terms.positionSize, portfolioId: portfolio.id, snapshot };
}

/** Manual-only low-timeframe observation. It performs no automatic close, event write, target edit, or alert action. */
export async function refreshLowTimeframePaperTradeHealth(userId: number, tradeId: number, configuration: ScoringConfig) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; the paper trade cannot be checked.");
  const matched = (await db.select().from(paperTrades).innerJoin(paperPortfolios, eq(paperTrades.portfolioId, paperPortfolios.id)).where(and(eq(paperTrades.id, tradeId), eq(paperPortfolios.userId, userId))).limit(1))[0];
  if (!matched) throw new Error("Paper trade not found in this portfolio.");
  const entrySnapshot = matched.paperTrades.immutableEntrySnapshot as PaperTradeSnapshot;
  const entryPlan = entrySnapshot.lowTimeframeScalpingPlan;
  const current = entryPlan ? (await getLowTimeframeScalpingIntelligence(configuration, [matched.paperTrades.assetId])).setups[0] : null;
  return { health: buildLowTimeframeTradeHealth(entryPlan, current), observedAt: Date.now(), manualOnly: true as const };
}

export async function closeLivePaperTrade(userId: number, tradeId: number, configuration: ScoringConfig) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; the paper trade cannot be closed.");
  const matched = (await db.select().from(paperTrades).innerJoin(paperPortfolios, eq(paperTrades.portfolioId, paperPortfolios.id)).where(and(eq(paperTrades.id, tradeId), eq(paperPortfolios.userId, userId))).limit(1))[0];
  if (!matched) throw new Error("Paper trade not found in this portfolio.");
  if (matched.paperTrades.status !== "open") throw new Error("Only open paper trades can be closed.");
  const scan = await buildLiveScanner(false, configuration);
  const row = scan.rows.find(candidate => candidate.asset.id === matched.paperTrades.assetId);
  if (!row?.asset.price) throw new Error("A current live price is required before closing a paper trade.");
  const exitPrice = row.asset.price;
  const realizedPnl = (matched.paperTrades.side === "long" ? exitPrice - matched.paperTrades.entryPrice : matched.paperTrades.entryPrice - exitPrice) * matched.paperTrades.positionSize;
  await db.update(paperTrades).set({ status: "closed", exitAt: new Date(scan.generatedAt), exitPrice, realizedPnl }).where(eq(paperTrades.id, tradeId));
  return { exitPrice: round(exitPrice, 8), realizedPnl: round(realizedPnl), closedAt: scan.generatedAt };
}

export async function getPaperPortfolio(userId: number, configuration: ScoringConfig) {
  const portfolio = await getOrCreatePortfolio(userId, configuration.paperCapital);
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; the paper portfolio cannot be loaded.");
  const rows = await db.select().from(paperTrades).where(eq(paperTrades.portfolioId, portfolio.id)).orderBy(asc(paperTrades.entryAt));
  const scan = await buildLiveScanner(false, configuration);
  const byAsset = new Map(scan.rows.map(row => [row.asset.id, row] as const));
  const prices = new Map(scan.rows.flatMap(row => row.asset.price === null ? [] : [[row.asset.id, row.asset.price] as const]));
  const metrics = buildPaperPortfolioPresentation(portfolio.startingCapital, rows as Array<typeof paperTrades.$inferSelect & { assetId: string }>, prices);
  const trades = rows.map(trade => {
    const current = byAsset.get(trade.assetId);
    const currentBundle = current ? getScannerLiveOhlcvBundle(scan, current.asset.symbol) : null;
    const currentAvailability = currentBundle?.state === "STALE" ? "STALE" as const : currentBundle?.eligibleForScoring && currentBundle.coherent ? "LIVE" as const : "UNAVAILABLE" as const;
    const currentPrice = current?.asset.price ?? null;
    const unrealizedPnl = trade.status === "open" && currentPrice !== null ? round((trade.side === "long" ? currentPrice - trade.entryPrice : trade.entryPrice - currentPrice) * trade.positionSize) : null;
    const basis = trade.entryPrice * trade.positionSize;
    const entrySnapshot = trade.immutableEntrySnapshot as PaperTradeSnapshot;
    const setupPlan = entrySnapshot.setupPlan;
    return {
      ...trade,
      entryNotional: round(basis),
      currentPrice,
      currentNotional: currentPrice === null ? null : round(currentPrice * trade.positionSize),
      unrealizedPnl,
      unrealizedReturnPercent: unrealizedPnl === null || basis <= 0 ? null : round(unrealizedPnl / basis * 100),
      realizedReturnPercent: trade.realizedPnl === null || basis <= 0 ? null : round(trade.realizedPnl / basis * 100),
      entrySnapshot,
      currentState: current ? { score: current.score, dataStatus: current.dataStatus, marketRegime: scan.marketRegime, generatedAt: scan.generatedAt } : null,
      tradeHealth: buildTradeHealth(setupPlan, {
        price: currentPrice,
        execution: setupPlan ? current?.score?.technicalByTimeframe.find(item => item.timeframe === setupPlan.timeframes.execution) ?? null : null,
        confirmation: setupPlan ? current?.score?.technicalByTimeframe.find(item => item.timeframe === setupPlan.timeframes.confirmation) ?? null : null,
        context: setupPlan ? current?.score?.technicalByTimeframe.find(item => item.timeframe === setupPlan.timeframes.context) ?? null : null,
        generatedAt: current ? scan.generatedAt : null,
        provider: currentBundle?.provider ?? null,
        availability: currentAvailability,
      }),
    };
  });
  return { portfolio, metrics, trades, generatedAt: scan.generatedAt };
}

export async function recordPaperTradeMonitoring(userId: number, tradeId: number, configuration: ScoringConfig) {
  const presentation = await getPaperPortfolio(userId, configuration);
  const trade = presentation.trades.find(item => item.id === tradeId);
  if (!trade) throw new Error("Paper trade not found in this private portfolio.");
  if (trade.status !== "open") throw new Error("Only open simulated positions can be monitored.");
  const candidates = [
    ...trade.tradeHealth.targetProgress.filter(target => target.reached).map(target => ({ eventKey: `TARGET_REACHED:${target.label}:${target.price}`, eventType: "TARGET_REACHED" as const, observation: { target, health: trade.tradeHealth, observedAt: presentation.generatedAt } })),
    ...(trade.tradeHealth.state === "REVERSAL RISK" ? [{ eventKey: "REVERSAL_WARNING:REVERSAL_RISK", eventType: "REVERSAL_WARNING" as const, observation: { health: trade.tradeHealth, observedAt: presentation.generatedAt } }] : []),
    ...(trade.tradeHealth.state === "INVALIDATED" ? [{ eventKey: "SETUP_INVALIDATED:INVALIDATED", eventType: "SETUP_INVALIDATED" as const, observation: { health: trade.tradeHealth, observedAt: presentation.generatedAt } }] : []),
  ];
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; monitoring events cannot be recorded.");
  const existing = await db.select({ eventKey: paperTradeMonitoringEvents.eventKey }).from(paperTradeMonitoringEvents).where(eq(paperTradeMonitoringEvents.tradeId, tradeId));
  const known = new Set(existing.map(item => item.eventKey));
  const inserted = candidates.filter(candidate => !known.has(candidate.eventKey));
  if (inserted.length) await db.insert(paperTradeMonitoringEvents).values(inserted.map(candidate => ({ tradeId, ...candidate })));
  return { health: trade.tradeHealth, recordedEvents: inserted.map(item => ({ eventKey: item.eventKey, eventType: item.eventType })), observedAt: presentation.generatedAt };
}
