import { runHistoricalBackfill } from "../server/crypto/historicalIngestion.ts";

const options = Object.fromEntries(process.argv.slice(2).map(argument => {
  const [key, value = "true"] = argument.replace(/^--/, "").split("=");
  return [key, value];
}));

const endAt = Date.parse(options.end ?? new Date().toISOString());
const startAt = Date.parse(options.start ?? "2025-08-01T00:00:00.000Z");
const timeframes = (options.timeframes ?? "1d").split(",");
const assetIds = options.assets ? options.assets.split(",") : undefined;
const instrumentType = options.instrument === "spot" ? "spot" : "perpetual";

if (!Number.isFinite(startAt) || !Number.isFinite(endAt)) throw new Error("Use ISO UTC --start and --end values.");

const outcome = await runHistoricalBackfill({
  notes: `Manual public-source ${instrumentType} backfill from ${new Date(startAt).toISOString()} to ${new Date(endAt).toISOString()}.`,
  assetIds,
  timeframes,
  instrumentType,
  startAt,
  endAt,
  maximumMonths: Number(options.months ?? 48),
  basedOnDatasetId: options.base ? Number(options.base) : undefined,
});

console.log(JSON.stringify(outcome, null, 2));
