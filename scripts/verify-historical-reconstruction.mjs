import { DEFAULT_SCORING_CONFIG } from "../shared/crypto.ts";
import { reconstructState } from "../server/crypto/reconstruction.ts";

const result = await reconstructState("bitcoin", "1h", Date.parse("2026-07-31T20:00:00.000Z"), 180001, "perpetual", DEFAULT_SCORING_CONFIG);
console.log(JSON.stringify({ dataset: result.dataset, decisionAt: result.decisionAt, completeness: result.completeness, score: { score: result.score.score, confidence: result.score.confidence, technical: result.score.technicalScore, status: result.score.status }, marketCapAvailability: result.marketCap.availability, regime: result.regime.classification, sectorAvailability: result.sector.availability, unavailable: result.unavailable }, null, 2));
