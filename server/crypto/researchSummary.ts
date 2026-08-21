import { desc } from "drizzle-orm";
import { researchReports } from "../../drizzle/schema";
import { getDb } from "../db";

export async function getLatestResearchReport() {
  const db = await getDb();
  if (!db) return null;
  return (await db.select().from(researchReports).orderBy(desc(researchReports.asOf)).limit(1))[0] ?? null;
}
