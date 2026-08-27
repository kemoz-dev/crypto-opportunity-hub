import { eq } from "drizzle-orm";
import { z } from "zod";
import { assets, userSettings } from "../../drizzle/schema";
import { DEFAULT_SCORING_CONFIG, type ScoringConfig } from "../../shared/crypto";
import { getDb } from "../db";

const percentage = z.number().min(0).max(100);
const timeframeSettingsSchema = z.object({
  "15m": z.object({ enabled: z.boolean(), weight: z.number().min(0).max(1) }),
  "1h": z.object({ enabled: z.boolean(), weight: z.number().min(0).max(1) }),
  "4h": z.object({ enabled: z.boolean(), weight: z.number().min(0).max(1) }),
  "1d": z.object({ enabled: z.boolean(), weight: z.number().min(0).max(1) }),
});

export const scoringConfigSchema = z.object({
  weights: z.object({
    technical: percentage,
    momentum: percentage,
    sector: percentage,
    catalyst: percentage,
    riskLiquidity: percentage,
  }).refine(value => Object.values(value).some(weight => weight > 0), "At least one score component must have a non-zero weight."),
  indicator: z.object({
    rsiPeriod: z.number().int().min(2).max(100),
    macdFast: z.number().int().min(2).max(100),
    macdSlow: z.number().int().min(3).max(200),
    macdSignal: z.number().int().min(2).max(100),
    emaFast: z.number().int().min(2).max(150),
    emaMedium: z.number().int().min(3).max(200),
    emaSlow: z.number().int().min(20).max(400),
    bollingerPeriod: z.number().int().min(5).max(100),
    atrPeriod: z.number().int().min(2).max(100),
    volumePeriod: z.number().int().min(2).max(100),
  }).refine(value => value.macdFast < value.macdSlow, "The MACD fast period must be lower than the slow period.").refine(value => value.emaFast < value.emaMedium && value.emaMedium < value.emaSlow, "EMA periods must increase from fast to medium to slow."),
  timeframes: timeframeSettingsSchema.refine(value => Object.values(value).some(item => item.enabled), "At least one timeframe must be enabled."),
  thresholds: z.object({ opportunity: percentage, confidence: percentage, technical: z.number().min(0).max(40) }),
  risk: z.object({ maxAtrPercent: z.number().positive().max(100), minimumMarketCap: z.number().nonnegative(), minimumVolumeToMarketCap: z.number().min(0).max(10) }),
  sectorModels: z.record(z.string(), z.object({ technicalMultiplier: z.number().min(0.25).max(2), riskMultiplier: z.number().min(0.25).max(2), description: z.string().min(1).max(240) })),
  paperCapital: z.number().positive().max(100_000_000),
});

export type ScoringConfigInput = z.infer<typeof scoringConfigSchema>;

function mergeWithDefaults(value: unknown): ScoringConfig {
  const parsed = scoringConfigSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_SCORING_CONFIG;
}

export async function getUserScoringConfig(userId: number): Promise<ScoringConfig> {
  const db = await getDb();
  if (!db) return DEFAULT_SCORING_CONFIG;
  const row = (await db.select({ scoringConfiguration: userSettings.scoringConfiguration }).from(userSettings).where(eq(userSettings.userId, userId)).limit(1))[0];
  return row ? mergeWithDefaults(row.scoringConfiguration) : DEFAULT_SCORING_CONFIG;
}

export async function saveUserScoringConfig(userId: number, configuration: ScoringConfigInput): Promise<ScoringConfig> {
  const validated = scoringConfigSchema.parse(configuration);
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; settings cannot be saved.");
  await db.insert(userSettings).values({ userId, scoringConfiguration: validated }).onDuplicateKeyUpdate({ set: { scoringConfiguration: validated } });
  return validated;
}

const watchlistSchema = z.array(z.string().trim().min(1).max(96)).max(100);

export async function getUserWatchlist(userId: number): Promise<string[]> {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; the watchlist cannot be loaded.");
  const row = (await db.select({ watchlist: userSettings.watchlist }).from(userSettings).where(eq(userSettings.userId, userId)).limit(1))[0];
  const parsed = watchlistSchema.safeParse(Array.isArray(row?.watchlist) ? row.watchlist : []);
  return parsed.success ? Array.from(new Set(parsed.data)) : [];
}

async function assertCanonicalAsset(assetId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; the watchlist cannot be changed.");
  const asset = (await db.select({ id: assets.id }).from(assets).where(eq(assets.id, assetId)).limit(1))[0];
  if (!asset) throw new Error("Select an asset from the canonical asset list.");
}

async function persistWatchlist(userId: number, watchlist: string[]) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable; the watchlist cannot be changed.");
  const validated = watchlistSchema.parse(Array.from(new Set(watchlist)));
  const existing = (await db.select({ userId: userSettings.userId }).from(userSettings).where(eq(userSettings.userId, userId)).limit(1))[0];
  if (existing) await db.update(userSettings).set({ watchlist: validated }).where(eq(userSettings.userId, userId));
  else await db.insert(userSettings).values({ userId, scoringConfiguration: DEFAULT_SCORING_CONFIG, watchlist: validated });
  return validated;
}

export async function addUserWatchlistAsset(userId: number, assetId: string) {
  await assertCanonicalAsset(assetId);
  return persistWatchlist(userId, [...await getUserWatchlist(userId), assetId]);
}

export async function removeUserWatchlistAsset(userId: number, assetId: string) {
  return persistWatchlist(userId, (await getUserWatchlist(userId)).filter(id => id !== assetId));
}
