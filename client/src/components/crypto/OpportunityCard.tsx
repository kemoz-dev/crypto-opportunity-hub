import { ArrowRight, Eye, Gauge, ShieldAlert, Target } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { directionTone, statusLabel, statusTone } from "./statusTokens";

export type OpportunityCardData = {
  assetId: string;
  symbol: string;
  name?: string | null;
  setupType?: string | null;
  timeframe?: string | null;
  status: string;
  score?: number | null;
  direction?: string | null;
  entryZone?: { low?: number | null; high?: number | null; preferred?: number | null } | null;
  targets?: Array<{ label?: string | null; price?: number | null; status?: string | null }>;
  stop?: { price?: number | null } | null;
  readiness?: number | null;
  health?: string | null;
  why?: string | null;
  reasons?: string[];
  confirmationGaps?: string[];
  provider?: string | null;
  dataTimestamp?: number | null;
  freshness?: string | null;
  dataQuality?: string | null;
  expectedDuration?: string | null;
  rewardRisk?: number | null;
  invalidationDistance?: number | null;
  canMonitor?: boolean;
  risk?: string | null;
  warning?: string | null;
};

const price = (value: number | null | undefined) => value == null ? "Unavailable" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: value >= 100 ? 2 : value >= 1 ? 3 : 5 }).format(value);
const score = (value: number | null | undefined) => value == null ? "Unavailable" : `${value}/100`;
const timeAgo = (timestamp: number | null | undefined) => {
  if (!timestamp) return "Unavailable";
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  return minutes < 1 ? "Just now" : minutes < 60 ? `${minutes}m ago` : `${Math.round(minutes / 60)}h ago`;
};

function Evidence({ label, value, tone, icon }: { label: string; value: string; tone: "cyan" | "rose" | "amber" | "slate"; icon?: ReactNode }) { const toneClass = { cyan: "border-cyan-300/15 bg-cyan-300/[.035] text-cyan-100", rose: "border-rose-300/15 bg-rose-300/[.035] text-rose-100", amber: "border-amber-300/15 bg-amber-300/[.035] text-amber-100", slate: "border-white/[.07] bg-white/[.02] text-slate-300" }[tone]; return <div className={cn("min-w-0 rounded-lg border p-2.5", toneClass)}><div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[.14em] opacity-70">{icon}{label}</div><p className="mt-1 text-[11px] leading-4">{value}</p></div>; }

export function OpportunityCard({ data, onView, onMonitor, onPaper, paperDisabled = false }: { data: OpportunityCardData; onView?: () => void; onMonitor?: () => void; onPaper?: () => void; paperDisabled?: boolean }) {
  const targets = data.targets?.filter(target => target.price != null).slice(0, 3) ?? [];
  const entry = data.entryZone;
  const isUnavailable = data.status === "DATA UNAVAILABLE";
  const reasons = data.reasons?.slice(0, 3) ?? [];
  const riskMessage = data.risk ?? (data.health && data.health !== "HEALTHY" ? data.health : data.rewardRisk != null ? `Validated R:R ${data.rewardRisk.toFixed(2)}` : "No separate risk assessment returned.");
  const warningMessage = data.warning ?? (data.confirmationGaps?.[0] ?? (isUnavailable ? "Required validated source data is unavailable." : "No additional warning returned by the server."));
  return <article className="group flex min-w-0 flex-col rounded-2xl border border-white/[.08] bg-[#0a111e]/90 p-4 shadow-[0_12px_35px_rgba(2,8,23,.12)] transition-colors hover:border-cyan-300/20">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-base font-semibold text-slate-100">{data.symbol}</h3>{data.setupType ? <span className="text-[10px] uppercase tracking-[.14em] text-slate-500">{data.setupType}</span> : null}{data.timeframe ? <span className="rounded border border-cyan-300/15 bg-cyan-300/[.05] px-1.5 py-0.5 font-mono text-[9px] text-cyan-200">{data.timeframe}</span> : null}</div>{data.name ? <p className="mt-1 truncate text-[11px] text-slate-500">{data.name}</p> : null}</div>
      <span role="status" className={cn("shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[.08em]", statusTone(data.status))}>{statusLabel(data.status)}</span>
    </div>
    <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
      <div className="rounded-lg border border-white/[.06] bg-white/[.02] p-2"><p className="text-[9px] uppercase tracking-[.12em] text-slate-500">Opportunity</p><p className="mt-1 font-mono text-lg text-cyan-200">{score(data.score)}</p></div>
      <div className="rounded-lg border border-white/[.06] bg-white/[.02] p-2"><p className="text-[9px] uppercase tracking-[.12em] text-slate-500">Direction</p><p className={cn("mt-1 inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold", directionTone(data.direction))}>{data.direction ?? "Unavailable"}</p></div>
      <div className="rounded-lg border border-white/[.06] bg-white/[.02] p-2"><p className="text-[9px] uppercase tracking-[.12em] text-slate-500">Readiness</p><p className="mt-1 font-mono text-sm text-slate-200">{score(data.readiness)}</p></div>
      <div className="rounded-lg border border-white/[.06] bg-white/[.02] p-2"><p className="text-[9px] uppercase tracking-[.12em] text-slate-500">Health</p><p className={cn("mt-1 text-[10px] font-semibold uppercase", statusTone(data.health).split(" ").find(token => token.startsWith("text-")) ?? "text-slate-300")}>{statusLabel(data.health)}</p></div>
    </div>
    <div className="mt-4 grid gap-3 border-t border-white/[.06] pt-3 text-xs sm:grid-cols-[1fr_auto]">
      <div className="min-w-0"><div className="flex flex-wrap gap-x-4 gap-y-2"><span><strong className="mr-1 text-[9px] uppercase tracking-[.12em] text-slate-500">Entry</strong>{entry?.low != null && entry.high != null ? `${price(entry.low)} – ${price(entry.high)}` : "No valid level"}</span><span><strong className="mr-1 text-[9px] uppercase tracking-[.12em] text-slate-500">Stop</strong>{data.stop?.price != null ? price(data.stop.price) : "No valid level"}</span>{data.rewardRisk != null ? <span><strong className="mr-1 text-[9px] uppercase tracking-[.12em] text-slate-500">R:R</strong>{data.rewardRisk.toFixed(2)}</span> : null}</div><div className="mt-2 flex flex-wrap gap-2"><strong className="text-[9px] uppercase tracking-[.12em] text-slate-500">Targets</strong>{targets.length ? targets.map((target, index) => <span key={`${target.label ?? "TP"}-${index}`} className={cn("font-mono", target.status === "REACHED" ? "text-emerald-300" : "text-slate-300")}>{target.label ?? `TP${index + 1}`} {price(target.price)}{target.status === "REACHED" ? " · reached" : ""}</span>) : <span className="text-slate-500">No valid level</span>}</div>{data.invalidationDistance != null ? <p className="mt-2 text-[10px] text-slate-500">Distance to invalidation: <span className="font-mono text-slate-300">{data.invalidationDistance.toFixed(2)}%</span></p> : null}</div>
      <div className="flex flex-wrap items-end justify-end gap-2"><Button type="button" variant="ghost" size="sm" onClick={onView} disabled={!onView} className="h-8 px-2 text-[11px] text-slate-300"><Eye className="mr-1.5 h-3.5 w-3.5" />View Asset</Button>{data.canMonitor && onMonitor ? <Button type="button" variant="outline" size="sm" onClick={onMonitor} className="h-8 border-cyan-300/20 px-2 text-[11px] text-cyan-100"><Target className="mr-1.5 h-3.5 w-3.5" />Monitor Setup</Button> : null}{onPaper ? <Button type="button" size="sm" onClick={onPaper} disabled={paperDisabled} className="h-8 bg-emerald-300 px-2 text-[11px] text-slate-950 hover:bg-emerald-200 disabled:bg-slate-700"><ArrowRight className="mr-1.5 h-3.5 w-3.5" />Paper Trade</Button> : null}</div>
    </div>
    <div className="mt-4 grid gap-2 border-t border-white/[.06] pt-3 sm:grid-cols-2"><Evidence label="WHY" value={data.why ?? (isUnavailable ? "Required validated source data is unavailable." : "Server-derived evidence is available in the detail workspace.")} tone="cyan" icon={isUnavailable ? <ShieldAlert className="h-3.5 w-3.5" /> : <Gauge className="h-3.5 w-3.5" />} /><Evidence label="RISK" value={riskMessage} tone="rose" /><Evidence label="WARNING" value={warningMessage} tone="amber" /><Evidence label="DATA" value={`${data.provider ?? "Provider unavailable"} · ${data.freshness ?? (data.dataTimestamp ? timeAgo(data.dataTimestamp) : "Freshness unavailable")} · ${data.dataQuality ?? "Quality unavailable"}`} tone="slate" />{onView ? <button type="button" onClick={onView} className="col-span-full flex items-center justify-end gap-1 text-[10px] font-semibold uppercase tracking-[.12em] text-cyan-200 hover:text-cyan-100">Open asset workspace <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></button> : null}</div>
    {reasons.length ? <div className="mt-3 grid gap-1.5 border-t border-white/[.05] pt-3">{reasons.map((reason, index) => <p key={`${reason}-${index}`} className="text-[10px] leading-4 text-slate-400"><span className="mr-1.5 font-mono text-cyan-300">{String(index + 1).padStart(2, "0")}</span>{reason}</p>)}</div> : null}
    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-white/[.05] pt-3 text-[10px] text-slate-500"><span>{data.provider ?? "Provider unavailable"}</span><span>{data.freshness ?? (data.dataTimestamp ? timeAgo(data.dataTimestamp) : "Freshness unavailable")}</span><span>{data.dataQuality ?? "Data quality unavailable"}</span>{data.expectedDuration ? <span>{data.expectedDuration}</span> : null}</div>
  </article>;
}
