import type { Request, Response } from "express";
import { sdk } from "../_core/sdk";
import { evaluateHistoricalIngestionByTaskUid } from "./historicalSchedule";

export async function scheduledHistoricalIngestionHandler(req: Request, res: Response) {
  let taskUid: string | undefined;
  let user;
  try {
    user = await sdk.authenticateRequest(req);
  } catch {
    return res.status(403).json({ error: "cron-only" });
  }
  if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
  try {
    taskUid = user.taskUid;
    const result = await evaluateHistoricalIngestionByTaskUid(taskUid);
    return res.json({ ok: true, result, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error("[ScheduledHistoricalIngestion] execution failed", { taskUid: taskUid ?? "unknown", message: error instanceof Error ? error.message : "Unknown error" });
    return res.status(500).json({ error: "Historical ingestion execution failed.", code: "HISTORICAL_INGESTION_FAILED", taskUid: taskUid ?? null, timestamp: new Date().toISOString() });
  }
}
