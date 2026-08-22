import { desc, eq } from "drizzle-orm";
import { historicalDataQuality, historicalIngestionIssueEvents, historicalIngestionIssues, historicalIngestionSchedules, historicalRegimeSnapshots, historicalScheduleExecutions } from "../../drizzle/schema";
import type { Timeframe } from "../../shared/crypto";
import { getDb } from "../db";

export type ExecutionStatus = "SUCCESS" | "PARTIAL" | "FAILED" | "SKIPPED";
export type IssueKind = "PROVIDER_FAILURE" | "MISSING_RANGE" | "NO_NEW_CANDLES" | "SOURCE_UNAVAILABLE";
export type ScopeAddress = { datasetId?: number; scheduleExecutionId?: number; ingestionRunId?: number; assetId: string; exchange: string; provider: string; instrumentType: "spot" | "perpetual"; timeframe: Timeframe; expectedStartAt?: number; expectedEndAt?: number; actualStartAt?: number; actualEndAt?: number };

export function calculateResearchReadiness(input: { assetCount: number; timeframeCoverage: Record<string, { observed: number; expected: number }>; missingRanges: number; regimeCount: number; continuityPercent: number; incrementalExecutionCount: number }) {
  const populatedFrames = Object.values(input.timeframeCoverage).filter(scope => scope.observed > 0).length;
  const completeness = Object.values(input.timeframeCoverage).reduce((sum, scope) => sum + scope.observed, 0) / Math.max(1, Object.values(input.timeframeCoverage).reduce((sum, scope) => sum + scope.expected, 0)) * 100;
  const reasons = [
    `${input.assetCount} assets represented`,
    `${populatedFrames} timeframe scopes populated`,
    `${completeness.toFixed(2)}% observed versus expected coverage`,
    `${input.missingRanges} unresolved missing ranges`,
    `${input.regimeCount} recorded regime classifications`,
    `${input.incrementalExecutionCount} observed scheduled incremental executions`,
  ];
  const status = input.assetCount === 0 || populatedFrames === 0 ? "NOT_READY" : input.missingRanges > 0 || input.regimeCount < 2 || input.incrementalExecutionCount === 0 ? "ACCUMULATING" : "READY_FOR_REVIEW";
  return { status, completenessPercent: Number(completeness.toFixed(2)), continuityPercent: Number(input.continuityPercent.toFixed(2)), reasons };
}

export async function createHistoricalScheduleExecution(scheduleId: number, taskUid: string, startedAt = new Date()) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  await db.insert(historicalScheduleExecutions).values({ scheduleId, taskUid, status: "SKIPPED", assetsAttempted: 0, assetsSucceeded: 0, assetsFailed: 0, candlesInserted: 0, candlesSkipped: 0, duplicatesDetected: 0, gapsDetected: 0, providerErrors: [], retryCount: 0, startedAt });
  const execution = (await db.select().from(historicalScheduleExecutions).where(eq(historicalScheduleExecutions.taskUid, taskUid)).orderBy(desc(historicalScheduleExecutions.id)).limit(1))[0];
  if (!execution) throw new Error("Schedule execution creation failed.");
  return execution;
}

export async function finishHistoricalScheduleExecution(executionId: number, input: { status: ExecutionStatus; datasetId?: number; skipReason?: string; assetsAttempted: number; assetsSucceeded: number; assetsFailed: number; candlesInserted: number; candlesSkipped: number; duplicatesDetected: number; gapsDetected: number; providerErrors: unknown[]; retryCount: number; startedAt: Date }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const completedAt = new Date();
  await db.update(historicalScheduleExecutions).set({ ...input, datasetId: input.datasetId ?? null, skipReason: input.skipReason ?? null, providerErrors: input.providerErrors, completedAt, durationMs: Math.max(0, completedAt.getTime() - input.startedAt.getTime()) }).where(eq(historicalScheduleExecutions.id, executionId));
}

export async function recordHistoricalIngestionIssue(scope: ScopeAddress, issueKind: IssueKind, errorReason: string | null, missingIntervalCount: number, evidence: Record<string, unknown>) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const observedAt = new Date();
  await db.insert(historicalIngestionIssues).values({ datasetId: scope.datasetId ?? null, scheduleExecutionId: scope.scheduleExecutionId ?? null, ingestionRunId: scope.ingestionRunId ?? null, issueKind, assetId: scope.assetId, exchange: scope.exchange, provider: scope.provider, instrumentType: scope.instrumentType, timeframe: scope.timeframe, expectedStartAt: scope.expectedStartAt ? new Date(scope.expectedStartAt) : null, expectedEndAt: scope.expectedEndAt ? new Date(scope.expectedEndAt) : null, actualStartAt: scope.actualStartAt ? new Date(scope.actualStartAt) : null, actualEndAt: scope.actualEndAt ? new Date(scope.actualEndAt) : null, missingIntervalCount, errorReason, firstDetectedAt: observedAt, evidence });
  const issue = (await db.select().from(historicalIngestionIssues).where(eq(historicalIngestionIssues.assetId, scope.assetId)).orderBy(desc(historicalIngestionIssues.id)).limit(1))[0];
  if (!issue) throw new Error("Ingestion issue creation failed.");
  await db.insert(historicalIngestionIssueEvents).values({ issueId: issue.id, scheduleExecutionId: scope.scheduleExecutionId ?? null, ingestionRunId: scope.ingestionRunId ?? null, eventType: "DETECTED", retryAttempt: 0, observedAt, details: evidence });
  return issue;
}

export async function findOpenScopeIssues(scope: Pick<ScopeAddress, "assetId" | "instrumentType" | "timeframe">) {
  const db = await getDb();
  if (!db) return [];
  const [issues, events] = await Promise.all([
    db.select().from(historicalIngestionIssues).where(eq(historicalIngestionIssues.assetId, scope.assetId)),
    db.select().from(historicalIngestionIssueEvents),
  ]);
  return issues.filter(issue => issue.instrumentType === scope.instrumentType && issue.timeframe === scope.timeframe && !events.some(event => event.issueId === issue.id && event.eventType === "RETRY_SUCCEEDED")).map(issue => ({ ...issue, nextRetryAttempt: Math.max(0, ...events.filter(event => event.issueId === issue.id).map(event => event.retryAttempt)) + 1 }));
}

export async function appendHistoricalIssueEvent(issueIds: number[], input: { scheduleExecutionId?: number; ingestionRunId?: number; eventType: "RETRY_STARTED" | "RETRY_SUCCEEDED" | "RETRY_FAILED" | "RECHECKED"; retryAttempt: number; details: Record<string, unknown> }) {
  if (!issueIds.length) return;
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const observedAt = new Date();
  await db.insert(historicalIngestionIssueEvents).values(issueIds.map(issueId => ({ issueId, scheduleExecutionId: input.scheduleExecutionId ?? null, ingestionRunId: input.ingestionRunId ?? null, eventType: input.eventType, retryAttempt: input.retryAttempt, observedAt, details: input.details })));
}

export async function listHistoricalIngestionHealth() {
  const db = await getDb();
  if (!db) return null;
  const [schedules, executions, issues, events, quality, regimes] = await Promise.all([
    db.select().from(historicalIngestionSchedules).orderBy(desc(historicalIngestionSchedules.updatedAt)),
    db.select().from(historicalScheduleExecutions).orderBy(desc(historicalScheduleExecutions.createdAt)),
    db.select().from(historicalIngestionIssues).orderBy(desc(historicalIngestionIssues.createdAt)),
    db.select().from(historicalIngestionIssueEvents).orderBy(desc(historicalIngestionIssueEvents.createdAt)),
    db.select().from(historicalDataQuality),
    db.select().from(historicalRegimeSnapshots),
  ]);
  const latestByStatus = (status: ExecutionStatus) => executions.find(execution => execution.status === status) ?? null;
  const unresolved = issues.filter(issue => !events.some(event => event.issueId === issue.id && event.eventType === "RETRY_SUCCEEDED"));
  const frameCoverage = Object.fromEntries(["15m", "1h", "4h", "1d"].map(frame => {
    const rows = quality.filter(row => row.timeframe === frame);
    return [frame, { observed: rows.reduce((sum, row) => sum + row.actualCandleCount, 0), expected: rows.reduce((sum, row) => sum + row.expectedCandleCount, 0) }];
  }));
  const continuity = quality.length ? quality.reduce((sum, row) => sum + row.coveragePercent, 0) / quality.length : 0;
  const regimeCount = new Set(regimes.filter(regime => regime.availability === "AVAILABLE" && regime.classification !== "UNAVAILABLE").map(regime => regime.classification)).size;
  const incrementalExecutionCount = executions.filter(execution => execution.status === "SUCCESS" || execution.status === "PARTIAL").length;
  const readiness = calculateResearchReadiness({ assetCount: new Set(quality.map(row => row.assetId)).size, timeframeCoverage: frameCoverage, missingRanges: unresolved.filter(issue => issue.issueKind === "MISSING_RANGE").length, regimeCount, continuityPercent: continuity, incrementalExecutionCount });
  return { schedules, executions, latest: { success: latestByStatus("SUCCESS"), partial: latestByStatus("PARTIAL"), failed: latestByStatus("FAILED") }, unresolvedIssues: unresolved, readiness };
}
