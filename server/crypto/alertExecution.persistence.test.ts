import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SCORING_CONFIG, type ScannerResponse } from "../../shared/crypto";
import { alertExecutions, alerts } from "../../drizzle/schema";

const hoisted = vi.hoisted(() => ({ getDb: vi.fn(), buildLiveScanner: vi.fn(), getUserScoringConfig: vi.fn(), notifyOwner: vi.fn() }));
vi.mock("../db", () => ({ getDb: hoisted.getDb }));
vi.mock("./marketService", () => ({ buildLiveScanner: hoisted.buildLiveScanner }));
vi.mock("./settings", () => ({ getUserScoringConfig: hoisted.getUserScoringConfig }));
vi.mock("../_core/notification", () => ({ notifyOwner: hoisted.notifyOwner }));

import { evaluateAlert, getAlertExecution, listAlertExecutions } from "./alerts";

const conditions = { minimumOpportunity: 80, minimumConfidence: 70, minimumTechnical: 30, assetIds: [], cooldownMinutes: 60, requireNotRiskOff: true, requiredTimeframe: "4h" as const, requireBullishSetup: true, notificationEnabled: true };
const noMatchScan: ScannerResponse = {
  generatedAt: 1_700_000_000_000,
  note: "Integration fixture.",
  dataStatus: [{ source: "CoinGecko markets", status: "live", fetchedAt: 1_700_000_000_000 }],
  marketRegime: { score: 71, classification: "RISK ON", btcDominance: 51, breadth: 64, reasons: [] },
  rows: [{ asset: { id: "bitcoin", symbol: "BTC", name: "Bitcoin", binanceSymbol: "BTCUSDT", sector: "Large Cap", price: 100, marketCap: 1_000_000, marketCapRank: 1, volume24h: 10_000, change1h: 0, change24h: 2, change7d: 3, lastUpdatedAt: 1_700_000_000_000, provider: "CoinGecko" }, score: { score: 79, confidence: 76, technicalScore: 31, momentumScore: 13, sectorScore: 60, riskScore: 72, setupType: "Trend Continuation", direction: "bullish", riskLevel: "low", multiTimeframeScore: 70, reasons: [], missingConditions: [], explanation: "Fixture", technicalByTimeframe: [{ timeframe: "4h", score: 7, maxScore: 10, bias: "bullish", rsi: 55, macdHistogram: 0.1, ema20: 100, ema50: 99, ema200: 90, bollinger: { middle: 98, upper: 104, lower: 92, width: 0.12 }, atrPercent: 2, volumeExpansion: 1.2, priceStructure: ["Higher low"], reasons: [] }] }, dataStatus: [{ source: "Binance 4h OHLCV", status: "live", fetchedAt: 1_700_000_000_000 }], fundingRate: null, openInterest: null }],
};

function createMockDb() {
  const executionRows: Array<Record<string, unknown>> = [];
  const alert = { id: 1, userId: 7, name: "Test Alert — High Opportunity 4H", isEnabled: true, conditions, scheduleCronTaskUid: "task-1", lastTriggeredAt: null, lastSignalSnapshot: null, createdAt: new Date(), updatedAt: new Date() };
  const alertRows = [alert] as unknown as Array<typeof alert> & { limit?: (count: number) => Promise<typeof alert[]> };
  alertRows.limit = async () => [alert];
  const executionChain = () => {
    const chain = {
      limit: async () => executionRows,
      orderBy: () => ({ limit: async () => executionRows }),
    };
    return chain;
  };
  const db = {
    select: () => ({ from: (table: unknown) => ({ where: () => table === alerts ? alertRows : executionChain() }) }),
    insert: () => ({ values: async (value: Record<string, unknown>) => { executionRows.push({ ...value, id: executionRows.length + 1 }); } }),
    update: () => ({ set: () => ({ where: async () => undefined }) }),
  };
  return { db, executionRows };
}

describe("alert execution persistence and historical retrieval", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    hoisted.getUserScoringConfig.mockResolvedValue(structuredClone(DEFAULT_SCORING_CONFIG));
    hoisted.buildLiveScanner.mockResolvedValue(structuredClone(noMatchScan));
    hoisted.notifyOwner.mockResolvedValue(true);
  });

  it("persists a NO_MATCH execution with immutable point-in-time fields and returns it through list/detail retrieval", async () => {
    const { db, executionRows } = createMockDb();
    hoisted.getDb.mockResolvedValue(db);
    const result = await evaluateAlert(1, "task-1");
    expect(result).toMatchObject({ triggered: false, skipped: "threshold-not-met", assetsScanned: 1, qualifyingOpportunities: 0 });
    expect(executionRows).toHaveLength(1);
    expect(executionRows[0]).toMatchObject({ outcomeStatus: "NO_MATCH", executionKind: "scheduled", assetsScanned: 1, qualifyingOpportunities: 0, notificationStatus: "not_sent", httpStatus: 200 });
    expect(executionRows[0].marketRegimeSnapshot).toMatchObject({ final: { classification: "RISK ON", score: 71 } });
    expect(executionRows[0].sectorSnapshots).toHaveLength(1);
    expect(executionRows[0].signalSnapshots).toEqual([]);
    const listed = await listAlertExecutions(7, 1);
    const detail = await getAlertExecution(7, 1, 1);
    expect(listed[0]).toMatchObject({ id: 1, alertName: "Test Alert — High Opportunity 4H", outcomeStatus: "NO_MATCH" });
    expect(detail).toMatchObject({ id: 1, alertName: "Test Alert — High Opportunity 4H", outcomeStatus: "NO_MATCH" });
  });
});
