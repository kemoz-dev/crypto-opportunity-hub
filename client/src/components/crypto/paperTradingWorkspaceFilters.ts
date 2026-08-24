export type PaperTradeFilter = {
  status: "all" | "open" | "closed";
  side: "all" | "long" | "short";
  result: "all" | "winning" | "losing" | "breakeven";
  assetQuery: string;
};

export type FilterablePaperTrade = {
  status: "open" | "closed" | "cancelled";
  side: "long" | "short";
  assetId: string;
  entrySnapshot: { asset?: { symbol?: string } };
  unrealizedPnl: number | null;
  realizedPnl: number | null;
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
    return !query || trade.assetId.toLowerCase().includes(query) || (trade.entrySnapshot.asset?.symbol ?? "").toLowerCase().includes(query);
  });
}
