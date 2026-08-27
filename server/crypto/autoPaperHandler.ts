import type { Request, Response } from "express";
import { sdk } from "../_core/sdk";
import { getUserScoringConfig } from "./settings";
import { refreshAutoPaperForAllEnabled } from "./autoPaper";

export async function scheduledAutoPaperHandler(_req: Request, res: Response) {
  let taskUid: string | undefined;
  try {
    const user = await sdk.authenticateRequest(_req);
    taskUid = user.taskUid;
    if (!user.isCron || !taskUid) return res.status(403).json({ error: "cron-only" });
    const result = await refreshAutoPaperForAllEnabled(userId => getUserScoringConfig(userId));
    return res.status(200).json({ ok: true, taskUid, result });
  } catch {
    return res.status(500).json({ error: "Scheduled Auto Paper refresh failed.", code: "AUTO_PAPER_REFRESH_FAILED", taskUid: taskUid ?? null, timestamp: new Date().toISOString() });
  }
}
