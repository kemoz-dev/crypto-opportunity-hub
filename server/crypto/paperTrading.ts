import { and, asc, eq } from "drizzle-orm";
import { paperPortfolios, paperTrades } from "../../drizzle/schema";
import type { OpportunityScore, ScannerResponse, ScoringConfig } from "../../shared/crypto";
import { getDb } from "../db";
import { buildLiveScanner } from "./marketService";

type PaperTradeSnapshot = {
  scannerGeneratedAt: number;
  asset: { id: string; symbol: string; name: string; sector: string; price: number };
  opportunity: OpportunityScore;
  marketRegime: ScannerResponse["marketRegime"];
  configuration: ScoringConfig;
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

function calculateMetrics(startingCapital: number, trades: Array<{ status: string; side: string; entryPrice: number; positionSize: number; realizedPnl: number | null; exitPrice: number | null; entryAt: Date; exitAt: Date | null }>, currentPrices: Map<string, number>) {
  const closed = trades.filter(trade => trade.status === "closed" && trade.realizedPnl !== null);
  const open = trades.filter(trade => trade.status === "open");
  const realizedPnl = closed.reduce((sum, trade) => sum + (trade.realizedPnl ?? 0), 0);
  const unrealizedPnl = open.reduce((sum, trade) => {
    const price = currentPrices.get((trade as typeof trade & { assetId?: string }).assetId ?? "");
    if (!price) return sum;
    return sum + (trade.side === "long" ? price - trade.entryPrice : trade.entryPrice - price) * trade.positionSize;
  }, 0);
  const returns = closed.map(trade => (trade.realizedPnl ?? 0) / Math.max(trade.entryPrice * trade.positionSize, Number.EPSILON));
  const wins = closed.filter(trade => (trade.realizedPnl ?? 0) > 0);
  const grossProfit = wins.reduce((sum, trade) => sum + (trade.realizedPnl ?? 0), 0);
  const grossLoss = Math.abs(closed.filter(trade => (trade.realizedPnl ?? 0) < 0).reduce((sum, trade) => sum + (trade.realizedPnl ?? 0), 0));
  let peak = startingCapital;
  let equity = startingCapital;
  let maxDrawdown = 0;
  closed.sort((left, right) => (left.exitAt?.getTime() ?? 0) - (right.exitAt?.getTime() ?? 0)).forEach(trade => { equity += trade.realizedPnl ?? 0; peak = Math.max(peak, equity); maxDrawdown = Math.max(maxDrawdown, (peak - equity) / peak * 100); });
  const mean = returns.length ? returns.reduce((sum, value) => sum + value, 0) / returns.length : 0;
  const variance = returns.length > 1 ? returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1) : 0;
  const sharpe = variance > 0 ? mean / Math.sqrt(variance) * Math.sqrt(returns.length) : null;
  return { startingCapital, currentEquity: round(startingCapital + realizedPnl + unrealizedPnl), realizedPnl: round(realizedPnl), unrealizedPnl: round(unrealizedPnl), winRate: closed.length ? round(wins.length / closed.length * 100) : null, openPositions: open.length, closedPositions: closed.length, tradeCount: trades.length, averageReturn: returns.length ? round(mean * 100) : null, averageR: returns.length ? round(mean * 100) : null, maxDrawdown: round(maxDrawdown), profitFactor: grossLoss > 0 ? round(grossProfit / grossLoss) : grossProfit > 0 ? null : 0, sharpeRatio: sharpe === null ? null : round(sharpe) };
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

export async function openLivePaperTrade(userId: number, assetId: string, side: "long" | "short", riskPercent: number, configuration: ScoringConfig) {
  const scan = await buildLiveScanner(false, configuration);
  const row = scan.rows.find(candidate => candidate.asset.id === assetId);
  if (!row?.score || row.asset.price === null) throw new Error("A current live score and price are required before opening a paper trade.");
  const portfolio = await getOrCreatePortfolio(userId, configuration.paperCapital);
  const atrPercent = row.score.technicalByTimeframe.find(item => item.timeframe === "4h")?.atrPercent ?? row.score.technicalByTimeframe.at(0)?.atrPercent ?? null;
  if (atrPercent === null) throw new Error("ATR is unavailable, so a risk-normalized stop cannot be calculated.");
  const entryPrice = row.asset.price;
  const terms = calculatePaperEntryTerms(entryPrice, atrPercent, side, portfolio.currentEquity, riskPercent);
  const snapshot: PaperTradeSnapshot = cloneImmutableEntrySnapshot({ scannerGeneratedAt: scan.generatedAt, asset: { id: row.asset.id, symbol: row.asset.symbol, name: row.asset.name, sector: row.asset.sector, price: entryPrice }, opportunity: row.score, marketRegime: scan.marketRegime, configuration });
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; the paper trade cannot be recorded.");
  await db.insert(paperTrades).values({ portfolioId: portfolio.id, assetId, status: "open", side, entryAt: new Date(scan.generatedAt), entryPrice, stopLoss: terms.stopLoss, takeProfit: [{ label: "2R", price: terms.takeProfit }], positionSize: terms.positionSize, riskPercent, rewardRisk: terms.rewardRisk, immutableEntrySnapshot: snapshot });
  return { entryPrice: round(entryPrice, 8), stopLoss: terms.stopLoss, takeProfit: terms.takeProfit, positionSize: terms.positionSize, portfolioId: portfolio.id, snapshot };
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
  const prices = new Map(scan.rows.flatMap(row => row.asset.price === null ? [] : [[row.asset.id, row.asset.price] as const]));
  const metrics = calculateMetrics(portfolio.startingCapital, rows as Array<typeof paperTrades.$inferSelect & { assetId: string }>, prices);
  return { portfolio, metrics, trades: rows, generatedAt: scan.generatedAt };
}
