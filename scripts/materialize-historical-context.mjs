import { persistHistoricalDatasetContext } from "../server/crypto/historicalContext.ts";

const datasetId = Number(process.argv.find(argument => argument.startsWith("--dataset="))?.split("=")[1]);
if (!Number.isInteger(datasetId) || datasetId <= 0) throw new Error("Use --dataset=<sealed dataset ID>.");

const result = await persistHistoricalDatasetContext(datasetId);
console.log(JSON.stringify({ datasetId, result }, null, 2));
