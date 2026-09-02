import { describe, expect, it } from "vitest";
import { buildLifecycleEvent, lifecycleEventKey, lifecycleSnapshot } from "./opportunityLifecycle";
import { shouldDispatchLifecycleNotification, shouldNotifyLifecycleEvent } from "./opportunityEventStore";
import type { OpportunityDiscoveryItem } from "./opportunityDiscovery";

function item(overrides: Partial<OpportunityDiscoveryItem> = {}) {
  return {
    version: "OPPORTUNITY_DISCOVERY_V2",
    assetId: "bitcoin",
    symbol: "BTC",
    mode: "SWING",
    status: "POTENTIAL",
    maturity: "DEVELOPING",
    setupReadiness: { version: "SETUP_READINESS_V1", state: "NEAR_READY", score: 82, components: { timeframeAlignment: 20, positiveEvidence: 20, technicalPlan: 20, rewardRisk: 15, regime: 7 }, explanation: "Validated evidence." },
    tradeReadiness: "WAITING",
    paperTradeEligible: false,
    potentialAlertEligible: false,
    rank: 1,
    opportunityScore: 86,
    technicalScore: 34,
    direction: "LONG",
    provider: "Binance Futures",
    dataTimestamp: 1_700_000_000_000,
    freshness: "LIVE",
    validationStatus: "VALID",
    timeframes: { execution: "1h", confirmation: "4h", context: "1d" },
    regime: { classification: "RISK ON", restricted: false },
    timeframeAgreement: { aligned: 2, required: 3, direction: "LONG", label: "2/3 timeframes align LONG" },
    whyInteresting: ["Higher low", "Momentum expansion"],
    missingEvidence: ["One confirmation"],
    confirmationRequirements: ["One confirmation"],
    invalidationExplanation: "Structural stop.",
    whatWouldChange: ["One confirmation"],
    conditionalEntry: null,
    readinessPlan: { availability: "SUPPORTED", currentPrice: 183.27, entryZone: { low: 182, high: 184, preferred: 183.27, reason: "Validated zone" }, confirmation: "Close above structure", invalidation: { price: 178, reason: "Below structure" }, targets: [{ label: "TP1", price: 193, distancePercent: 5.3, rMultiple: 2, reason: "Next structure" }], rewardRisk: 2, reason: "Validated plan", health: { state: "WAITING", reason: "Awaiting confirmation" } },
    exactReason: "Developing setup.",
    dataReason: null,
    sourcePresentationStatus: "WATCH",
    adaptive: {} as OpportunityDiscoveryItem["adaptive"],
    opportunityQuality: { level: "GOOD", score: 78, confidence: "MEDIUM", explanation: "Validated quality." },
    sourcePlan: { actionable: false, currentPrice: 183.27, entryZone: { low: 182, high: 184, preferred: 183.27, reason: "Validated zone" }, stop: { label: "STOP", price: 178, reason: "Structure", priority: "PRIMARY" }, invalidation: { label: "INVALIDATION", price: 178, reason: "Structure", priority: "PRIMARY" }, targets: [{ label: "TP1", price: 193, reason: "Next structure", priority: "PRIMARY" }], rewardRisk: 2, readinessCandidate: null, evidence: [], risks: [], diagnostics: [] },
    ...overrides,
  } as OpportunityDiscoveryItem;
}

describe("canonical opportunity lifecycle timeline and notification boundaries", () => {
  it("records WATCH to POTENTIAL with frozen point-in-time evidence", () => {
    const current = item({ status: "POTENTIAL", opportunityScore: 82, technicalScore: 31 });
    const event = buildLifecycleEvent("WATCH", current, 1_700_000_123_000);
    expect(event).toMatchObject({ from: "WATCH", to: "POTENTIAL", type: "POTENTIAL_STARTED", price: 183.27 });
    expect(event?.snapshot).toMatchObject({ from: "WATCH", state: "POTENTIAL", price: 183.27, opportunityScore: 82, technicalScore: 31, rewardRisk: 2 });
    current.readinessPlan.currentPrice = 999;
    current.opportunityScore = 5;
    expect(event?.snapshot).toMatchObject({ price: 183.27, opportunityScore: 82 });
  });

  it("records POTENTIAL to QUALIFIED and notifies only newly inserted qualifying events", () => {
    const event = buildLifecycleEvent("POTENTIAL", item({ status: "QUALIFIED", opportunityScore: 91, technicalScore: 37 }), 1_700_000_124_000);
    expect(event).toMatchObject({ from: "POTENTIAL", to: "QUALIFIED", type: "QUALIFIED_STARTED" });
    expect(shouldNotifyLifecycleEvent(event)).toBe(true);
    expect(shouldDispatchLifecycleNotification(true, event)).toBe(true);
    expect(shouldDispatchLifecycleNotification(false, event)).toBe(false);
  });

  it("allows a later WATCH to POTENTIAL cycle while keeping event keys distinct", () => {
    const first = lifecycleEventKey("WATCH", "POTENTIAL", 1_700_000_000_000);
    const second = lifecycleEventKey("WATCH", "POTENTIAL", 1_700_000_360_000);
    expect(first).not.toBe(second);
    expect(shouldNotifyLifecycleEvent(buildLifecycleEvent("WATCH", item({ status: "POTENTIAL" }), 1_700_000_360_000))).toBe(true);
  });

  it("does not notify non-qualifying lifecycle events", () => {
    const watch = buildLifecycleEvent("POTENTIAL", item({ status: "WATCH" }), 1_700_000_125_000);
    expect(shouldNotifyLifecycleEvent(watch)).toBe(false);
    expect(shouldDispatchLifecycleNotification(true, watch)).toBe(false);
    expect(shouldNotifyLifecycleEvent(null)).toBe(false);
  });

  it("keeps direct lifecycle snapshots immutable and preserves LONG/SHORT direction evidence", () => {
    const long = lifecycleSnapshot(item({ direction: "LONG" }), "POTENTIAL", 1_700_000_126_000, "WATCH");
    const short = lifecycleSnapshot(item({ direction: "SHORT", readinessPlan: { ...item().readinessPlan, currentPrice: 100, entryZone: { low: 99, high: 101, preferred: 100, reason: "Short zone" }, invalidation: { price: 105, reason: "Above structure" }, targets: [{ label: "TP1", price: 90, distancePercent: 10, rMultiple: 2, reason: "Support" }], rewardRisk: 2 } }), "POTENTIAL", 1_700_000_127_000, "WATCH");
    expect(long).toMatchObject({ direction: "LONG", from: "WATCH", rewardRisk: 2 });
    expect(short).toMatchObject({ direction: "SHORT", from: "WATCH", price: 100, rewardRisk: 2 });
  });
});
