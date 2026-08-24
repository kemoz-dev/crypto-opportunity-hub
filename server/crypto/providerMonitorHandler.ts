import type { Request, Response } from "express";
import { sdk } from "../_core/sdk";
import { runProviderMonitorByTaskUid } from "./providerMonitor";

export async function scheduledProviderMonitorHandler(req: Request, res: Response) {
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
    const result = await runProviderMonitorByTaskUid(taskUid);
    return res.json({ ok: true, result, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error("[ProviderMonitor] scheduled health check failed", { taskUid: taskUid ?? "unknown", message: error instanceof Error ? error.message : "Unknown error" });
    return res.status(500).json({ error: "Provider monitor failed.", code: "PROVIDER_MONITOR_FAILED", taskUid: taskUid ?? null, timestamp: new Date().toISOString() });
  }
}
