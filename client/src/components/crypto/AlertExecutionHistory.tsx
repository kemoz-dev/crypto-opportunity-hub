import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { ChevronRight, Clock3, Database, Loader2, ShieldCheck, TriangleAlert } from "lucide-react";
import { useState } from "react";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function executionOutcome(execution: { outcomeStatus: "SUCCESS" | "NO_MATCH" | "FAILED" | "SKIPPED" | null; status: "completed" | "failed"; triggered: boolean }) {
  if (execution.outcomeStatus) return execution.outcomeStatus;
  if (execution.status === "failed") return "FAILED";
  return execution.triggered ? "SUCCESS" : "NO_MATCH";
}

function outcomeStyle(outcome: string) {
  if (outcome === "SUCCESS") return "border-emerald-300/20 bg-emerald-300/[.08] text-emerald-200";
  if (outcome === "NO_MATCH") return "border-sky-300/20 bg-sky-300/[.08] text-sky-200";
  if (outcome === "FAILED") return "border-rose-300/20 bg-rose-300/[.08] text-rose-200";
  return "border-slate-300/15 bg-slate-300/[.07] text-slate-300";
}

function formatTime(value: Date | string | null) {
  return value ? new Date(value).toLocaleString() : "Unavailable";
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="rounded-lg border border-white/[.07] bg-white/[.025] px-3 py-2.5"><p className="text-[9px] font-semibold uppercase tracking-[.15em] text-slate-500">{label}</p><div className="mt-1 text-xs text-slate-200">{value}</div></div>;
}

function ExecutionInspector({ alertId, executionId, open, onOpenChange }: { alertId: number; executionId: number | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const execution = trpc.crypto.alertExecution.useQuery({ alertId, executionId: executionId ?? 1 }, { enabled: open && executionId !== null });
  const detail = execution.data;
  const snapshot = asRecord(detail?.executionSnapshot);
  const regime = asRecord(detail?.marketRegimeSnapshot ?? snapshot.marketRegime);
  const finalRegime = asRecord(regime.final);
  const signals = asArray(detail?.signalSnapshots ?? snapshot.signalSnapshots);
  const sectors = asArray(detail?.sectorSnapshots ?? snapshot.sectorSnapshots);
  const provenance = detail?.dataProvenance ?? snapshot.dataProvenance;
  const outcome = detail ? executionOutcome(detail) : "SKIPPED";
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-5xl border-white/[.1] bg-[#0b1220] p-0 text-slate-100 sm:rounded-xl"><DialogHeader className="border-b border-white/[.07] px-6 py-5"><DialogTitle className="flex flex-wrap items-center gap-2 text-base">{detail?.alertName ?? "Alert execution"}{detail ? <span className={`rounded-full border px-2 py-0.5 text-[9px] ${outcomeStyle(outcome)}`}>{outcome}</span> : null}</DialogTitle><DialogDescription className="mt-1 text-xs text-slate-500">POINT-IN-TIME SNAPSHOT — this inspection shows only the data captured during the original execution. It never recomputes historical values from current market data.</DialogDescription></DialogHeader><ScrollArea className="h-[min(74vh,720px)]"><div className="space-y-5 p-6">{execution.isLoading ? <div className="grid h-56 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-amber-300" /></div> : !detail ? <div className="rounded-xl border border-rose-300/15 bg-rose-300/[.04] p-4 text-sm text-rose-100">The execution could not be loaded.</div> : <><section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Field label="Execution ID" value={`#${detail.id}`} /><Field label="Timestamp" value={formatTime(detail.completedAt)} /><Field label="Duration" value={detail.durationMs === null ? "Unavailable" : `${detail.durationMs} ms`} /><Field label="HTTP / result" value={`${detail.httpStatus ?? "—"} / ${outcome}`} /><Field label="Assets scanned" value={detail.assetsScanned ?? "Unavailable"} /><Field label="Qualifying opportunities" value={detail.qualifyingOpportunities ?? 0} /><Field label="Score config" value={detail.configurationVersion ?? "Legacy snapshot"} /><Field label="Notification" value={detail.notificationStatus ?? "Unavailable"} /></section><section className="rounded-xl border border-cyan-300/15 bg-cyan-300/[.035] p-4"><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-cyan-200" /><h3 className="text-sm font-semibold text-cyan-100">Point-in-time market regime</h3></div><p className="mt-1 text-xs text-slate-500">Captured source/freshness and unavailable inputs are retained exactly as evaluated.</p><div className="mt-3 grid gap-3 sm:grid-cols-3"><Field label="Classification" value={String(finalRegime.classification ?? regime.availability ?? "Unavailable")} /><Field label="Regime score" value={String(finalRegime.score ?? "Unavailable")} /><Field label="Snapshot timestamp" value={String(regime.timestamp ?? snapshot.generatedAt ?? "Unavailable")} /></div><details className="mt-3 rounded-lg border border-white/[.07] bg-black/10 p-3"><summary className="cursor-pointer text-xs text-cyan-100">Inspect regime inputs and provenance</summary><pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-[10px] leading-4 text-slate-400">{JSON.stringify(regime, null, 2)}</pre></details></section><section className="rounded-xl border border-violet-300/15 bg-violet-300/[.035] p-4"><div className="flex items-center gap-2"><Database className="h-4 w-4 text-violet-200" /><h3 className="text-sm font-semibold text-violet-100">Immutable signal and sector evidence</h3></div><p className="mt-1 text-xs text-slate-500">Matched signals: {signals.length}. Sector state is retained for all scanned assets rather than re-queried today.</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="Signal snapshots" value={signals.length ? signals.map(item => String(asRecord(asRecord(item).asset).symbol ?? "Asset")).join(", ") : "No qualifying opportunity"} /><Field label="Sector snapshots" value={`${sectors.length} captured asset sector states`} /></div><details className="mt-3 rounded-lg border border-white/[.07] bg-black/10 p-3"><summary className="cursor-pointer text-xs text-violet-100">Inspect complete signal and sector snapshots</summary><pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-[10px] leading-4 text-slate-400">{JSON.stringify({ signals, sectors }, null, 2)}</pre></details></section><section className="rounded-xl border border-amber-300/15 bg-amber-300/[.035] p-4"><div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-amber-200" /><h3 className="text-sm font-semibold text-amber-100">Configuration and data provenance</h3></div><p className="mt-1 text-xs text-slate-500">The execution remains tied to its original configuration fingerprint, conditions, and provider-freshness record.</p><details className="mt-3 rounded-lg border border-white/[.07] bg-black/10 p-3"><summary className="cursor-pointer text-xs text-amber-100">Inspect captured configuration, conditions, and data sources</summary><pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-[10px] leading-4 text-slate-400">{JSON.stringify({ conditions: snapshot.conditions, scoringConfiguration: snapshot.scoringConfiguration, scoringConfigurationVersion: snapshot.scoringConfigurationVersion, dataProvenance: provenance }, null, 2)}</pre></details></section>{detail.errorMessage ? <section className="rounded-xl border border-rose-300/15 bg-rose-300/[.04] p-4"><div className="flex items-center gap-2"><TriangleAlert className="h-4 w-4 text-rose-200" /><h3 className="text-sm font-semibold text-rose-100">Recorded error detail</h3></div><p className="mt-2 text-xs leading-5 text-rose-100/80">{detail.errorMessage}</p></section> : null}</>}</div></ScrollArea></DialogContent></Dialog>;
}

export function AlertExecutionHistory({ alertId, alertName }: { alertId: number; alertName: string }) {
  const history = trpc.crypto.alertExecutions.useQuery({ alertId });
  const [selectedExecutionId, setSelectedExecutionId] = useState<number | null>(null);
  return <section className="mt-4 border-t border-white/[.07] pt-4"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-slate-500">Execution history</p><p className="mt-1 text-[11px] text-slate-500">Scheduled and manual point-in-time records. Zero matches are a successful evaluation state.</p></div><span className="rounded-full border border-white/[.08] px-2 py-1 text-[9px] text-slate-400">{history.data?.length ?? 0} records</span></div>{history.isLoading ? <div className="grid h-24 place-items-center"><Loader2 className="h-4 w-4 animate-spin text-amber-300" /></div> : history.data?.length ? <div className="mt-3 overflow-x-auto rounded-xl border border-white/[.07]"><table className="min-w-[720px] w-full text-left text-[10px]"><thead className="bg-white/[.025] text-slate-500"><tr><th className="px-3 py-2.5 font-medium">Time</th><th className="px-3 py-2.5 font-medium">Alert</th><th className="px-3 py-2.5 font-medium">Status</th><th className="px-3 py-2.5 font-medium">Assets scanned</th><th className="px-3 py-2.5 font-medium">Matches</th><th className="px-3 py-2.5 font-medium">Score config</th><th className="px-3 py-2.5 font-medium">Notification</th><th className="px-3 py-2.5" /></tr></thead><tbody>{history.data.map(execution => { const outcome = executionOutcome(execution); return <tr key={execution.id} className="border-t border-white/[.06] text-slate-300 hover:bg-white/[.025]"><td className="px-3 py-3 text-slate-400">{formatTime(execution.completedAt)}</td><td className="px-3 py-3 font-medium text-slate-200">{alertName}</td><td className="px-3 py-3"><span className={`rounded-full border px-2 py-0.5 text-[9px] ${outcomeStyle(outcome)}`}>{outcome === "NO_MATCH" ? "NO MATCH" : outcome}</span></td><td className="px-3 py-3">{execution.assetsScanned ?? "—"}</td><td className="px-3 py-3">{execution.qualifyingOpportunities ?? 0}</td><td className="max-w-28 truncate px-3 py-3 font-mono text-slate-400">{execution.configurationVersion ?? "Legacy"}</td><td className="px-3 py-3 text-slate-400">{execution.notificationStatus ?? "—"}</td><td className="px-3 py-3"><Button variant="ghost" size="sm" onClick={() => setSelectedExecutionId(execution.id)} className="h-7 px-2 text-[10px] text-cyan-100 hover:bg-cyan-300/[.08]">Inspect <ChevronRight className="ml-1 h-3 w-3" /></Button></td></tr>; })}</tbody></table></div> : <div className="mt-3 rounded-xl border border-dashed border-white/[.1] p-4 text-center text-xs text-slate-500">No execution records are available yet.</div>}<ExecutionInspector alertId={alertId} executionId={selectedExecutionId} open={selectedExecutionId !== null} onOpenChange={open => !open && setSelectedExecutionId(null)} /></section>;
}
