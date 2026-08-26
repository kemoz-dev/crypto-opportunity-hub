import { useMemo, useState } from "react";
import { Activity, Archive, CheckCircle2, Clock3, RefreshCw, ShieldAlert, Target, XCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { usePwaStatus } from "@/pwa/PwaStatus";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const statusTone = (status: string) => status === "QUALIFIED" || status.includes("TARGET") ? "border-emerald-300/25 bg-emerald-300/[.07] text-emerald-200" : status === "INVALIDATED" || status === "ARCHIVED" ? "border-rose-300/25 bg-rose-300/[.07] text-rose-200" : status === "DATA_UNAVAILABLE" ? "border-slate-300/20 bg-slate-300/[.06] text-slate-300" : "border-amber-300/25 bg-amber-300/[.07] text-amber-200";
const label = (status: string) => status.replaceAll("_", " ");
const json = (value: unknown) => value && typeof value === "object" ? value as Record<string, any> : {};
const date = (value: string | Date | null | undefined) => value ? new Date(value).toLocaleString() : "Unavailable";

export function SetupMonitorWorkspace() {
  const { online } = usePwaStatus();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const active = trpc.crypto.setupMonitorActive.useQuery(undefined, { enabled: online, refetchOnWindowFocus: false });
  const history = trpc.crypto.setupMonitorHistory.useQuery(undefined, { enabled: online, refetchOnWindowFocus: false });
  const detail = trpc.crypto.setupMonitorDetail.useQuery({ instanceId: selectedId ?? 0 }, { enabled: online && selectedId !== null, refetchOnWindowFocus: false });
  const refresh = trpc.crypto.refreshSetupMonitor.useMutation({ onSuccess: () => { void active.refetch(); void history.refetch(); void detail.refetch(); } });
  const archive = trpc.crypto.archiveSetupMonitor.useMutation({ onSuccess: () => { void active.refetch(); void history.refetch(); void detail.refetch(); } });
  const selected = detail.data;
  const records = useMemo(() => [...(active.data ?? []), ...(history.data ?? [])], [active.data, history.data]);
  return <section className="space-y-5">
    <header className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[.035] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-cyan-200">Persistent setup monitor</p><h1 className="mt-2 text-2xl font-semibold text-slate-100">Active setups, preserved snapshots</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Explicitly saved Potential, Qualified, and Watch setups are re-evaluated only on an authenticated refresh. Monitoring never opens a Paper Trade, sends an alert, or changes the original evidence.</p></div><Badge variant="outline" className="border-cyan-300/20 bg-cyan-300/[.06] text-cyan-100">{online ? "ONLINE · SERVER AUTHORITATIVE" : "OFFLINE · READ ONLY"}</Badge></div>
    </header>
    {!online && <div className="rounded-xl border border-amber-300/20 bg-amber-300/[.05] p-4 text-sm text-amber-100">Monitoring refresh, archive, and event writes are disabled offline. Previously loaded information remains read-only and may be stale.</div>}
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]">
      <div className="space-y-5">
        <MonitorGroup title="Active setups" icon={<Activity className="h-4 w-4" />} rows={active.data ?? []} selectedId={selectedId} onSelect={setSelectedId} />
        <MonitorGroup title="History" icon={<Clock3 className="h-4 w-4" />} rows={history.data ?? []} selectedId={selectedId} onSelect={setSelectedId} history />
      </div>
      <aside className="rounded-2xl border border-white/[.08] bg-slate-950/50 p-5">
        {!selected ? <div className="grid min-h-64 place-items-center text-center text-sm text-slate-500"><Target className="mb-3 h-6 w-6 text-slate-600" /><p>Select a monitored setup to inspect original versus current state.</p></div> : <div className="space-y-5">
          <div className="flex items-start justify-between gap-3"><div><p className="font-mono text-xs text-cyan-200">{selected.symbol} · {selected.setupType}</p><h2 className="mt-1 text-lg font-semibold text-slate-100">Setup #{selected.instanceId}</h2></div><Badge variant="outline" className={statusTone(String(selected.current.status))}>{label(String(selected.current.status))}</Badge></div>
          <div className="grid grid-cols-2 gap-2"><Snapshot title="Original setup" value={json(selected.original).status ?? "Unavailable"} detail={`Created ${date(json(selected.original).capturedAt as string | undefined)}`} /><Snapshot title="Current state" value={label(String(selected.current.status))} detail={`Checked ${date(selected.current.lastValidatedAt as string | Date | null)}`} /></div>
          <div className="rounded-xl border border-white/[.07] bg-white/[.025] p-4"><p className="text-[10px] font-semibold uppercase tracking-[.17em] text-slate-500">Current explanation</p><p className="mt-2 text-sm leading-6 text-slate-300">{String(selected.current.stateReason ?? "No current explanation available.")}</p><p className="mt-3 text-xs text-slate-500">Provider: {String(json(selected.current.providerProvenance).provider ?? "Unavailable")} · Timeframe: {selected.timeframe}</p></div>
          <div className="flex flex-wrap gap-2"><Button size="sm" disabled={!online || refresh.isPending || selected.current.status === "ARCHIVED"} onClick={() => refresh.mutate({ instanceId: selected.instanceId })}><RefreshCw className={cn("mr-2 h-3.5 w-3.5", refresh.isPending && "animate-spin")} />Refresh now</Button><Button size="sm" variant="outline" disabled={!online || archive.isPending || selected.current.status === "ARCHIVED"} onClick={() => archive.mutate({ instanceId: selected.instanceId })}><Archive className="mr-2 h-3.5 w-3.5" />Archive</Button></div>
          <div><p className="mb-2 text-[10px] font-semibold uppercase tracking-[.17em] text-slate-500">Monitoring history</p><div className="space-y-2">{selected.events.length === 0 ? <p className="text-xs text-slate-500">No events recorded.</p> : selected.events.map(event => <div key={event.id} className="rounded-lg border border-white/[.06] bg-white/[.02] p-3"><div className="flex items-center justify-between gap-3"><span className="text-xs font-medium text-slate-200">{label(event.eventType)}</span><span className="font-mono text-[10px] text-slate-500">{date(event.createdAt)}</span></div><p className="mt-1 text-xs leading-5 text-slate-400">{event.reason}</p></div>)}</div></div>
          <div className="rounded-xl border border-amber-300/15 bg-amber-300/[.04] p-3 text-xs leading-5 text-amber-100/80"><ShieldAlert className="mr-2 inline h-3.5 w-3.5 text-amber-300" />Monitoring is evidence only. Paper Trading remains a separate explicit action and no automatic action is performed.</div>
        </div>}
      </aside>
    </div>
  </section>;
}

function MonitorGroup({ title, icon, rows, selectedId, onSelect, history = false }: { title: string; icon: React.ReactNode; rows: any[]; selectedId: number | null; onSelect: (id: number) => void; history?: boolean }) {
  return <section className="rounded-2xl border border-white/[.08] bg-slate-950/45 p-4"><div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-semibold text-slate-200">{icon}{title}</h2><span className="font-mono text-xs text-slate-500">{rows.length}</span></div>{rows.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">{history ? "No terminal setups yet." : "No saved setups. Save a Potential, Qualified, or Watch setup from Discovery."}</p> : <div className="space-y-2">{rows.map(row => <button key={row.instanceId} onClick={() => onSelect(row.instanceId)} className={cn("w-full rounded-xl border p-3 text-left transition-colors hover:bg-white/[.04]", selectedId === row.instanceId ? "border-cyan-300/35 bg-cyan-300/[.06]" : "border-white/[.06] bg-white/[.02]")}><div className="flex items-center justify-between gap-3"><span className="font-semibold text-slate-100">{row.symbol}<span className="ml-2 text-xs font-normal text-slate-500">{row.setupType} · {row.timeframe}</span></span><Badge variant="outline" className={statusTone(String(row.current.status))}>{label(String(row.current.status))}</Badge></div><div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400"><span>Original: {label(String(row.original.status ?? "UNAVAILABLE"))}</span><span>Last checked: {date(row.current.lastValidatedAt as string | Date | null)}</span></div></button>)}</div>}</section>;
}

function Snapshot({ title, value, detail }: { title: string; value: string; detail: string }) { return <div className="rounded-xl border border-white/[.06] bg-white/[.02] p-3"><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-500">{title}</p><p className="mt-2 text-sm font-semibold text-slate-100">{value}</p><p className="mt-1 text-[11px] text-slate-500">{detail}</p></div>; }
