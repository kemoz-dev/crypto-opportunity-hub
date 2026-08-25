import type { Request, Response } from "express";
import { getSchedulerAdapter } from "../adapters/scheduler";
import { runProviderMonitorByTaskUid } from "./providerMonitor";

export async function scheduledProviderMonitorHandler(req: Request, res: Response) {
  let taskUid: string | undefined;
  try {
    const invocation = await getSchedulerAdapter().verifyInvocation(req);
    taskUid = invocation.taskUid;
  } catch {
    return res.status(403).json({ error: "cron-only" });
  }
  try {
    if (!taskUid) return res.status(403).json({ error: "cron-only" });
    const result = await runProviderMonitorByTaskUid(taskUid);
    return res.json({ ok: true, result, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error("[ProviderMonitor] scheduled health check failed", { taskUid: taskUid ?? "unknown", message: error instanceof Error ? error.message : "Unknown error" });
    return res.status(500).json({ error: "Provider monitor failed.", code: "PROVIDER_MONITOR_FAILED", taskUid: taskUid ?? null, timestamp: new Date().toISOString() });
  }
}
