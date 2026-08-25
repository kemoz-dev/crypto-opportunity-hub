import type { Request, Response } from "express";
import { getSchedulerAdapter } from "../adapters/scheduler";
import { evaluateAlertByTaskUid } from "./alerts";

export async function scheduledAlertHandler(req: Request, res: Response) {
  let taskUid: string | undefined;
  try {
    const invocation = await getSchedulerAdapter().verifyInvocation(req);
    taskUid = invocation.taskUid;
  } catch {
    return res.status(403).json({ error: "cron-only" });
  }
  try {
    if (!taskUid) return res.status(403).json({ error: "cron-only" });
    const result = await evaluateAlertByTaskUid(taskUid);
    return res.json({ ok: true, result, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error("[ScheduledAlert] evaluation failed", { taskUid: taskUid ?? "unknown", message: error instanceof Error ? error.message : "Unknown error" });
    return res.status(500).json({ error: "Scheduled alert evaluation failed.", code: "ALERT_EVALUATION_FAILED", taskUid: taskUid ?? null, timestamp: new Date().toISOString() });
  }
}
