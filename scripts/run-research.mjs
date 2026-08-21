import { getUserScoringConfig } from "../server/crypto/settings.ts";
import { runResearchExperiment } from "../server/crypto/researchLab.ts";

const userId = 330001;
const configuration = await getUserScoringConfig(userId);
const base = {
  assetIds: [],
  timeframe: "1h",
  candleLimit: 1000,
  minimumOpportunity: 60,
  minimumConfidence: 60,
  holdingBars: 24,
  riskPercent: 1,
  stopAtrMultiplier: 1.5,
  takeProfitRule: "risk-reward",
  targetRiskReward: 2,
  trainPercent: 70,
  regime: "ALL",
};

const selectedExperiments = process.argv.slice(2).length ? process.argv.slice(2) : ["A", "B", "C", "D", "E"];
for (const experimentId of selectedExperiments) {
  const result = await runResearchExperiment(userId, { ...base, experimentId, name: `2026-08 controlled technical-core ${experimentId}` }, configuration);
  const aggregate = result.results.find(item => item.dimension === "aggregate");
  console.log(JSON.stringify({ experimentId, experimentIdPersisted: result.experimentId, signals: aggregate?.signalCount, status: aggregate?.evidenceStatus, averageReturn: aggregate?.metrics.averageReturn }, null, 2));
}
