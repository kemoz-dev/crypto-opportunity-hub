import { describe, expect, it } from "vitest";
import { filterPaperTrades, type FilterablePaperTrade } from "../../client/src/components/crypto/paperTradingWorkspaceFilters";

const trades: FilterablePaperTrade[] = [
  { assetId: "solana", status: "open", side: "long", unrealizedPnl: 12.5, realizedPnl: null, entrySnapshot: { asset: { symbol: "SOL" }, setupPlan: { mode: "SCALP" } }, tradeHealth: { state: "HEALTHY" } },
  { assetId: "ethereum", status: "closed", side: "short", unrealizedPnl: null, realizedPnl: -8.25, entrySnapshot: { asset: { symbol: "ETH" }, setupPlan: { mode: "SWING" } }, tradeHealth: { state: "REVERSAL RISK" } },
  { assetId: "chainlink", status: "closed", side: "long", unrealizedPnl: null, realizedPnl: 0, entrySnapshot: { asset: { symbol: "LINK" } }, tradeHealth: { state: "HEALTH UNKNOWN" } },
];

describe("Paper Trading workspace filters", () => {
  it("filters current open positions using their real unrealized P&L without modifying inputs", () => {
    const before = structuredClone(trades);
    expect(filterPaperTrades(trades, { status: "open", side: "long", result: "winning", health: "healthy", strategy: "scalp", assetQuery: "sol" })).toEqual([trades[0]]);
    expect(trades).toEqual(before);
  });

  it("filters closed outcomes and asset symbols while leaving unavailable P&L out of result buckets", () => {
    expect(filterPaperTrades(trades, { status: "closed", side: "all", result: "losing", health: "reversal-risk", strategy: "swing", assetQuery: "eth" })).toEqual([trades[1]]);
    expect(filterPaperTrades(trades, { status: "all", side: "all", result: "breakeven", health: "health-unknown", strategy: "all", assetQuery: "" })).toEqual([trades[2]]);
  });
});
