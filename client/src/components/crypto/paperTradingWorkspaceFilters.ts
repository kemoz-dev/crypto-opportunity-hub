export type PaperTradeFilter = {
  status: "all" | "open" | "closed";
  side: "all" | "long" | "short";
  result: "all" | "winning" | "losing" | "breakeven";
  health: "all" | "healthy" | "caution" | "reversal-risk" | "invalidated" | "health-unknown";
  strategy: "all" | "scalp" | "swing";
  assetQuery: string;
};

export type FilterablePaperTrade = {
  status: "open" | "closed" | "cancelled";
  side: "long" | "short";
  assetId: string;
  entrySnapshot: { asset?: { symbol?: string }; setupPlan?: { mode?: "SCALP" | "SWING" } };
  unrealizedPnl: number | null;
  realizedPnl: number | null;
  tradeHealth: { state: "HEALTHY" | "CAUTION" | "REVERSAL RISK" | "INVALIDATED" | "HEALTH UNKNOWN" };
};

export function filterPaperTrades<T extends FilterablePaperTrade>(trades: T[], filter: PaperTradeFilter): T[] {
  const query = filter.assetQuery.trim().toLowerCase();
  return trades.filter(trade => {
    if (filter.status !== "all" && trade.status !== filter.status) return false;
    if (filter.side !== "all" && trade.side !== filter.side) return false;
    const pnl = trade.status === "open" ? trade.unrealizedPnl : trade.realizedPnl;
    if (filter.result === "winning" && !(pnl !== null && pnl > 0)) return false;
    if (filter.result === "losing" && !(pnl !== null && pnl < 0)) return false;
    if (filter.result === "breakeven" && pnl !== 0) return false;
    const health = trade.tradeHealth.state;
    if (filter.health === "healthy" && health !== "HEALTHY") return false;
    if (filter.health === "caution" && health !== "CAUTION") return false;
    if (filter.health === "reversal-risk" && health !== "REVERSAL RISK") return false;
    if (filter.health === "invalidated" && health !== "INVALIDATED") return false;
    if (filter.health === "health-unknown" && health !== "HEALTH UNKNOWN") return false;
    const strategy = trade.entrySnapshot.setupPlan?.mode;
    if (filter.strategy === "scalp" && strategy !== "SCALP") return false;
    if (filter.strategy === "swing" && strategy !== "SWING") return false;
    return !query || trade.assetId.toLowerCase().includes(query) || (trade.entrySnapshot.asset?.symbol ?? "").toLowerCase().includes(query);
  });
}
