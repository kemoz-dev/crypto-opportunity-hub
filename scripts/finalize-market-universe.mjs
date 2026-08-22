import { recomputeHistoricalQuality } from "../server/crypto/historicalData.ts";
import { refreshMarketUniverseCoverage, snapshotMarketUniverse } from "../server/crypto/marketUniverse.ts";

const datasetId = Number(process.argv.find(argument => argument.startsWith("--dataset="))?.split("=")[1]);
if (!Number.isInteger(datasetId) || datasetId <= 0) throw new Error("Use --dataset=<sealed dataset ID>.");

const quality = await recomputeHistoricalQuality(datasetId);
const coverage = await refreshMarketUniverseCoverage(datasetId);
const universeSnapshot = await snapshotMarketUniverse(datasetId);
console.log(JSON.stringify({ datasetId, quality, coverage, universeSnapshotId: universeSnapshot.id }, null, 2));
