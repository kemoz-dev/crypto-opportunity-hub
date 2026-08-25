import type { Request } from "express";
import { ForbiddenError } from "@shared/_core/errors";
import { getAuthAdapter } from "../_core/authAdapter";
import { createHeartbeatJob, deleteHeartbeatJob, listHeartbeatJobs, updateHeartbeatJob, type HeartbeatJob, type HeartbeatJobInfo, type HeartbeatJobUpdate } from "../_core/heartbeat";

export type SchedulerJob = {
  taskUid: string;
  name: string;
  cron: string;
  path: string;
  method: "POST" | "PUT";
  payload: string;
  enabled: boolean;
  lastExecutedAt: string | null;
  nextExecutionAt: string | null;
};

export interface SchedulerAdapter {
  create(job: HeartbeatJob, actorSession: string): Promise<{ taskUid: string; nextExecutionAt: string | null }>;
  update(taskUid: string, patch: HeartbeatJobUpdate, actorSession: string): Promise<{ nextExecutionAt: string | null }>;
  disable(taskUid: string, actorSession: string): Promise<{ nextExecutionAt: string | null }>;
  delete(taskUid: string, actorSession: string): Promise<void>;
  list(actorSession: string, pagination?: { page?: number; pageSize?: number }): Promise<{ total: number; jobs: SchedulerJob[] }>;
  verifyInvocation(request: Request): Promise<{ taskUid: string; scheme: "manus-cron-session" }>;
}

function toSchedulerJob(job: HeartbeatJobInfo): SchedulerJob {
  return {
    taskUid: job.taskUid,
    name: job.name,
    cron: job.cronExpression,
    path: job.callbackPath,
    method: job.callbackMethod === "PUT" ? "PUT" : "POST",
    payload: job.callbackPayload,
    enabled: job.isEnable,
    lastExecutedAt: job.lastExecutedAt ?? null,
    nextExecutionAt: job.nextExecutionAt ?? null,
  };
}

class ManusSchedulerAdapter implements SchedulerAdapter {
  async create(job: HeartbeatJob, actorSession: string) {
    const created = await createHeartbeatJob(job, actorSession);
    return { taskUid: created.taskUid, nextExecutionAt: created.nextExecutionAt ?? null };
  }

  async update(taskUid: string, patch: HeartbeatJobUpdate, actorSession: string) {
    const updated = await updateHeartbeatJob(taskUid, patch, actorSession);
    return { nextExecutionAt: updated.nextExecutionAt ?? null };
  }

  disable(taskUid: string, actorSession: string) {
    return this.update(taskUid, { enable: false }, actorSession);
  }

  delete(taskUid: string, actorSession: string) {
    return deleteHeartbeatJob(taskUid, actorSession);
  }

  async list(actorSession: string, pagination?: { page?: number; pageSize?: number }) {
    const response = await listHeartbeatJobs(actorSession, pagination);
    return { total: response.total, jobs: response.jobs.map(toSchedulerJob) };
  }

  async verifyInvocation(request: Request) {
    const principal = await getAuthAdapter().authenticateRequest(request);
    if (!principal.isCron || !principal.taskUid) throw ForbiddenError("cron-only");
    return { taskUid: principal.taskUid, scheme: "manus-cron-session" as const };
  }
}

const activeSchedulerAdapter: SchedulerAdapter = new ManusSchedulerAdapter();

export function getSchedulerAdapter(): SchedulerAdapter {
  return activeSchedulerAdapter;
}
