import { inheritHistoricalDatasetContext } from "../server/crypto/historicalContext.ts";

const result = await inheritHistoricalDatasetContext(180001, 210001);
console.log(JSON.stringify({ repairedDatasetId: 210001, ...result }, null, 2));
