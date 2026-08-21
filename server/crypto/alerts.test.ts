import { describe, expect, it } from "vitest";
import { DEFAULT_SCORING_CONFIG, type ScannerResponse } from "../../shared/crypto";
import { buildPointInTimeExecutionSnapshot, createConfigurationIdentity, qualifiesForAlert } from "./alerts";

const conditions = { minimumOpportunity: 75, minimumConfidence: 70, minimumTechnical: 26, assetIds: ["bitcoin"], cooldownMinutes: 15, requireNotRiskOff: false, requireBullishSetup: false, notificationEnabled: false };
const bullishScore = { score: 82, confidence: 79, technicalScore: 28, direction: "bullish" as const, technicalByTimeframe: [{ timeframe: "4h" as const, bias: "bullish" as const }] };

describe("explainable alert qualification", () => {
  it("requires every configured score threshold and asset scope to pass", () => {
    expect(qualifiesForAlert(bullishScore, "bitcoin", conditions, "RISK ON")).toBe(true);
    expect(qualifiesForAlert({ ...bullishScore, score: 74 }, "bitcoin", conditions, "RISK ON")).toBe(false);
    expect(qualifiesForAlert({ ...bullishScore, confidence: 69 }, "bitcoin", conditions, "RISK ON")).toBe(false);
    expect(qualifiesForAlert({ ...bullishScore, technicalScore: 25 }, "bitcoin", conditions, "RISK ON")).toBe(false);
    expect(qualifiesForAlert(bullishScore, "ethereum", conditions, "RISK ON")).toBe(false);
  });

  it("allows any tracked asset when the user leaves the asset scope empty", () => {
    expect(qualifiesForAlert(bullishScore, "ethereum", { ...conditions, assetIds: [] }, "RISK ON")).toBe(true);
  });

  it("enforces non–Risk Off, bullish-setup, and selected-timeframe constraints", () => {
    const strict = { ...conditions, assetIds: [], requireNotRiskOff: true, requireBullishSetup: true, requiredTimeframe: "4h" as const, notificationEnabled: true };
    expect(qualifiesForAlert(bullishScore, "bitcoin", strict, "RISK ON")).toBe(true);
    expect(qualifiesForAlert(bullishScore, "bitcoin", strict, "RISK OFF")).toBe(false);
    expect(qualifiesForAlert({ ...bullishScore, direction: "neutral" }, "bitcoin", strict, "RISK ON")).toBe(false);
    expect(qualifiesForAlert({ ...bullishScore, technicalByTimeframe: [{ timeframe: "4h", bias: "neutral" }] }, "bitcoin", strict, "RISK ON")).toBe(false);
  });
});

const pointInTimeScore = {
  score: 86,
  confidence: 78,
  technicalScore: 31,
  momentumScore: 14,
  sectorScore: 64,
  riskScore: 73,
  setupType: "Trend Continuation",
  direction: "bullish" as const,
  riskLevel: "low" as const,
  multiTimeframeScore: 75,
  reasons: [{ key: "technical", label: "Technical aggregation", score: 31, maxScore: 40, direction: "positive" as const, detail: "Captured at evaluation." }],
  missingConditions: [],
  explanation: "Captured research context.",
  technicalByTimeframe: [{ timeframe: "4h" as const, score: 7.8, maxScore: 10, bias: "bullish" as const, rsi: 59, macdHistogram: 0.23, ema20: 101, ema50: 99, ema200: 94, bollinger: { middle: 98, upper: 104, lower: 92, width: 0.12 }, atrPercent: 2.1, volumeExpansion: 1.4, priceStructure: ["Higher low"], reasons: [] }],
};

const pointInTimeScan: ScannerResponse = {
  generatedAt: 1_700_000_000_000,
  note: "Test-only point-in-time scan.",
  dataStatus: [{ source: "CoinGecko markets", status: "live", fetchedAt: 1_700_000_000_000 }],
  marketRegime: { score: 72, classification: "RISK ON", btcDominance: 52, breadth: 68, reasons: [{ key: "btc-trend", label: "BTC 24h trend", score: 66, maxScore: 100, direction: "positive", detail: "Captured." }, { key: "total-market", label: "Total market", score: 61, maxScore: 100, direction: "positive", detail: "Captured." }, { key: "breadth", label: "Breadth", score: 68, maxScore: 100, direction: "positive", detail: "Captured." }] },
  rows: [
    { asset: { id: "bitcoin", symbol: "BTC", name: "Bitcoin", binanceSymbol: "BTCUSDT", sector: "Large Cap", price: 100, marketCap: 1_000_000, marketCapRank: 1, volume24h: 10_000, change1h: 0.5, change24h: 2, change7d: 5, lastUpdatedAt: 1_700_000_000_000, provider: "CoinGecko" }, score: { ...pointInTimeScore, score: 70, setupType: "No Setup", direction: "neutral" }, dataStatus: [{ source: "Binance 4h OHLCV", status: "live", fetchedAt: 1_700_000_000_000 }], fundingRate: null, openInterest: null },
    { asset: { id: "ethereum", symbol: "ETH", name: "Ethereum", binanceSymbol: "ETHUSDT", sector: "L1", price: 200, marketCap: 500_000, marketCapRank: 2, volume24h: 8_000, change1h: 1, change24h: 3.5, change7d: 8, lastUpdatedAt: 1_700_000_000_000, provider: "CoinGecko" }, score: pointInTimeScore, dataStatus: [{ source: "Binance 4h OHLCV", status: "live", fetchedAt: 1_700_000_000_000 }], fundingRate: 0.01, openInterest: 100_000 },
  ],
};

describe("point-in-time alert execution snapshots", () => {
  it("preserves exact regime, sector, signal, indicator, provenance, and configuration evidence without current-state reconstruction", () => {
    const snapshot = buildPointInTimeExecutionSnapshot(pointInTimeScan, DEFAULT_SCORING_CONFIG, { ...conditions, assetIds: [], requiredTimeframe: "4h", requireBullishSetup: true }, [pointInTimeScan.rows[1]]);
    expect(snapshot.snapshotType).toBe("POINT_IN_TIME_ALERT_EXECUTION_V2");
    expect(snapshot.assetsScanned).toBe(2);
    expect(snapshot.qualifyingOpportunities).toBe(1);
    expect(snapshot.marketRegime.final).toMatchObject({ classification: "RISK ON", score: 72 });
    expect(snapshot.marketRegime.inputs.marketVolume).toMatchObject({ availability: "unavailable" });
    expect(snapshot.sectorSnapshots).toHaveLength(2);
    expect(snapshot.signalSnapshots[0]).toMatchObject({ asset: { symbol: "ETH", price: 200 }, scores: { opportunity: 86, technical: 31 }, technicalState: [{ timeframe: "4h", rsi: 59, ema20: 101, bollinger: { upper: 104 } }] });
    expect(snapshot.signalSnapshots[0].dataProvenance.asset[0]).toMatchObject({ source: "Binance 4h OHLCV", status: "live" });
    expect(snapshot.scoringConfigurationVersion.version).toMatch(/^score-config-v1-/);
  });

  it("stores an immutable detached snapshot so later source/configuration mutations cannot alter historical research", () => {
    const config = structuredClone(DEFAULT_SCORING_CONFIG);
    const scan = structuredClone(pointInTimeScan);
    const snapshot = buildPointInTimeExecutionSnapshot(scan, config, { ...conditions, assetIds: [] }, [scan.rows[1]]);
    scan.rows[1].asset.price = 999;
    scan.marketRegime!.classification = "RISK OFF";
    config.weights.technical = 1;
    expect(snapshot.signalSnapshots[0].asset.price).toBe(200);
    expect(snapshot.marketRegime.final).toMatchObject({ classification: "RISK ON" });
    expect(snapshot.scoringConfiguration.weights.technical).toBe(40);
  });

  it("preserves a configuration version identity and changes it only when configuration changes", () => {
    const original = createConfigurationIdentity(DEFAULT_SCORING_CONFIG);
    const changed = structuredClone(DEFAULT_SCORING_CONFIG);
    changed.weights.technical = 41;
    expect(createConfigurationIdentity(DEFAULT_SCORING_CONFIG)).toEqual(original);
    expect(createConfigurationIdentity(changed).fingerprint).not.toBe(original.fingerprint);
  });

  it("represents zero-match executions as a successful scanned snapshot with no signal snapshot and no trade action", () => {
    const snapshot = buildPointInTimeExecutionSnapshot(pointInTimeScan, DEFAULT_SCORING_CONFIG, { ...conditions, assetIds: [] }, []);
    const execution = { outcomeStatus: "NO_MATCH" as const, triggered: false, assetsScanned: snapshot.assetsScanned, qualifyingOpportunities: snapshot.qualifyingOpportunities, signalSnapshots: snapshot.signalSnapshots, paperTradeAction: "none" as const, realTradeAction: "none" as const };
    expect(execution).toEqual({ outcomeStatus: "NO_MATCH", triggered: false, assetsScanned: 2, qualifyingOpportunities: 0, signalSnapshots: [], paperTradeAction: "none", realTradeAction: "none" });
  });
});
