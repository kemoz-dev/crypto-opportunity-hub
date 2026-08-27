import { useMemo, useState } from "react";
import { ArrowLeft, BarChart3, BookOpen, CircleAlert, Filter, LockKeyhole, Radar, ShieldAlert, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { usePwaStatus } from "@/pwa/PwaStatus";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const STATUS_ORDER = ["QUALIFIED", "POTENTIAL", "WATCH", "NO TRADE", "DATA UNAVAILABLE"] as const;
type Status = (typeof STATUS_ORDER)[number];
type Strategy = "SCALP" | "SWING";
type StatusFilter = "ALL" | Status;
type StrategyFilter = "ALL" | Strategy;
type DirectionFilter = "ALL" | "LONG" | "SHORT";
type RegimeFilter = "ALL" | "RISK ON" | "SELECTIVE" | "NEUTRAL" | "RISK OFF" | "UNAVAILABLE";
type HealthFilter = "ALL" | "HEALTHY" | "WARNING" | "REVERSAL RISK" | "INVALIDATED" | "UNKNOWN";
type TimeframeFilter = "ALL" | "15M" | "1H" | "4H" | "1D";

type DiscoveryItem = {
  assetId: string;
  symbol: string;
  status: Status;
  direction: "LONG" | "SHORT" | "NO TRADE";
  opportunityScore: number | null;
  adaptive?: { status?: string; quality?: { score: number | null; confidence: string }; warnings?: string[] };
  setupReadiness?: { score: number | null };
  tradeReadiness?: string;
  provider?: string | null;
  dataTimestamp: number | null;
  regime?: { classification: string | null; restricted: boolean };
  timeframes?: { execution?: string; confirmation?: string; context?: string };
  exactReason?: string;
  sourcePlan?: {
    entryZone: { preferred: number; reason: string } | null;
    stop: { price: number; reason: string } | null;
    targets: Array<{ label: string; price: number; reason: string }>;
    rewardRisk: number | null;
  };
};

type DiscoveryResponse = {
  generatedAt?: number;
  marketRegime?: { classification: string; score: number } | null;
  discovery?: { items: DiscoveryItem[]; summary: { evaluated: number; qualified: number; potential: number; watch: number; noTrade: number; dataUnavailable: number; restrictedByRiskOff: number } };
};

type WorkspaceItem = DiscoveryItem & { strategy: Strategy };
type Trial = {
  id: number;
  assetId: string;
  strategy: string;
  timeframe: string;
  direction: string;
  mode: string;
  status: string;
  realizedPnl: number | null;
  currentPnl: number | null;
  createdAt: Date | string;
  completedAt?: Date | string | null;
  immutablePlanSnapshot: unknown;
  currentSnapshot?: unknown;
};
type CompareRow = { label: string; trials: number; completed: number; wins: number; pnl: number };

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const date = (value: Date | string | number | null | undefined) => value ? new Date(value).toLocaleString() : "UNAVAILABLE";
const number = (value: number | null | undefined, digits = 2) => value == null || !Number.isFinite(value) ? "UNAVAILABLE" : value.toFixed(digits);

function healthFor(item: WorkspaceItem): HealthFilter {
  if (item.status === "QUALIFIED") return "HEALTHY";
  if (item.status === "POTENTIAL" || item.status === "WATCH") return item.regime?.restricted ? "WARNING" : "WARNING";
  if (item.status === "NO TRADE") return "INVALIDATED";
  return "UNKNOWN";
}

function timeframeFor(item: WorkspaceItem) {
  return String(item.timeframes?.execution ?? "UNAVAILABLE").toUpperCase();
}

function snapshotObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" ? value as Record<string, any> : {};
}

function qualificationFor(trial: Trial) {
  const snapshot = snapshotObject(trial.immutablePlanSnapshot);
  const adaptive = snapshot.adaptiveQualification;
  const qualification = snapshot.qualification;
  return typeof adaptive?.status === "string" ? adaptive.status : typeof qualification?.status === "string" ? qualification.status : "UNAVAILABLE";
}

function regimeFor(trial: Trial) {
  const snapshot = snapshotObject(trial.immutablePlanSnapshot);
  return typeof snapshot.regime === "string" ? snapshot.regime : typeof snapshot.marketRegime === "string" ? snapshot.marketRegime : "UNAVAILABLE";
}

function trialPnl(trial: Trial) {
  const terminal = ["STOPPED", "CLOSED", "COMPLETED", "EXPIRED"].includes(trial.status);
  return Number(terminal ? trial.realizedPnl ?? 0 : trial.currentPnl ?? 0);
}

function groupTrials(trials: Trial[], labelFor: (trial: Trial) => string): CompareRow[] {
  const labels = Array.from(new Set(trials.map(labelFor))).sort((left, right) => left.localeCompare(right));
  return labels.map(label => {
    const group = trials.filter(trial => labelFor(trial) === label);
    const completed = group.filter(trial => ["STOPPED", "CLOSED", "COMPLETED", "EXPIRED"].includes(trial.status));
    return { label, trials: group.length, completed: completed.length, wins: completed.filter(trial => Number(trial.realizedPnl ?? 0) > 0).length, pnl: group.reduce((sum, trial) => sum + trialPnl(trial), 0) };
  });
}

export function TradingIntelligenceWorkspace({ onBack, onOpenAutoPaper }: { onBack: () => void; onOpenAutoPaper: () => void }) {
  const { online } = usePwaStatus();
  const { isAuthenticated } = useAuth();
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [strategy, setStrategy] = useState<StrategyFilter>("ALL");
  const [direction, setDirection] = useState<DirectionFilter>("ALL");
  const [regime, setRegime] = useState<RegimeFilter>("ALL");
  const [health, setHealth] = useState<HealthFilter>("ALL");
  const [timeframe, setTimeframe] = useState<TimeframeFilter>("ALL");
  const scalpQuery = trpc.crypto.tradeSetups.useQuery({ mode: "SCALP" }, { enabled: online, staleTime: 30_000, refetchOnWindowFocus: false });
  const swingQuery = trpc.crypto.tradeSetups.useQuery({ mode: "SWING" }, { enabled: online, staleTime: 30_000, refetchOnWindowFocus: false });
  const performanceQuery = trpc.crypto.autoPaperPerformance.useQuery(undefined, { enabled: online && isAuthenticated, staleTime: 20_000, refetchOnWindowFocus: false });
  const historyQuery = trpc.crypto.autoPaperHistory.useQuery(undefined, { enabled: online && isAuthenticated, staleTime: 20_000, refetchOnWindowFocus: false });
  const items = useMemo(() => {
    const sources: Array<[Strategy, unknown]> = [["SCALP", scalpQuery.data], ["SWING", swingQuery.data]];
    return sources.flatMap(([sourceStrategy, raw]) => {
      const response = raw as DiscoveryResponse | undefined;
      return (response?.discovery?.items ?? []).map(item => ({ ...item, strategy: sourceStrategy }));
    });
  }, [scalpQuery.data, swingQuery.data]);
  const filtered = useMemo(() => items.filter(item => {
    const itemRegime = String(item.regime?.classification ?? "UNAVAILABLE").toUpperCase() as RegimeFilter;
    return (status === "ALL" || item.status === status)
      && (strategy === "ALL" || item.strategy === strategy)
      && (direction === "ALL" || item.direction === direction)
      && (regime === "ALL" || itemRegime === regime)
      && (health === "ALL" || healthFor(item) === health)
      && (timeframe === "ALL" || timeframeFor(item) === timeframe);
  }), [items, status, strategy, direction, regime, health, timeframe]);
  const funnel = useMemo(() => STATUS_ORDER.map(label => ({ label, count: items.filter(item => item.status === label).length })), [items]);
  const totalEvaluated = scalpQuery.data || swingQuery.data ? items.length : null;
  const currentRegime = (swingQuery.data as DiscoveryResponse | undefined)?.marketRegime ?? (scalpQuery.data as DiscoveryResponse | undefined)?.marketRegime ?? null;
  const trials = useMemo(() => ((historyQuery.data ?? []) as unknown as Trial[]).toSorted((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()), [historyQuery.data]);
  const journal = trials.slice(0, 16);
  const autoPaperRows = useMemo(() => ({
    strategy: groupTrials(trials, trial => trial.strategy === "SCALP" ? "FAST SCALP" : trial.strategy),
    qualification: groupTrials(trials, qualificationFor),
    direction: groupTrials(trials, trial => trial.direction.toUpperCase()),
    regime: groupTrials(trials, regimeFor),
  }), [trials]);
  const publicLoading = scalpQuery.isLoading || swingQuery.isLoading;
  const publicError = scalpQuery.error?.message ?? swingQuery.error?.message;
  return <section className="min-h-screen rounded-2xl border border-white/[.08] bg-[#080e19]/95 p-4 shadow-2xl sm:p-6">
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[.07] pb-5"><div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-300/[.12] text-cyan-200"><Radar className="h-5 w-5" /></span><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-cyan-300">Trading intelligence · read only</p><h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-100">Strategy experiment command center</h1><p className="mt-2 max-w-3xl text-xs leading-5 text-slate-400">A transparent view of where opportunities qualify, wait, disappear, or become unavailable. This layer reuses server-authoritative discovery and persisted Auto Paper evidence; it does not alter scoring, gates, or accounting.</p></div></div><Button variant="outline" onClick={onBack} className="border-white/[.1] bg-white/[.025] text-slate-200"><ArrowLeft className="mr-2 h-4 w-4" />Back to Dashboard</Button></header>
    {!online ? <div role="status" className="mt-5 rounded-xl border border-amber-300/25 bg-amber-300/[.06] p-4 text-xs text-amber-100"><strong>OFFLINE · READ ONLY.</strong> Current opportunities and private Auto Paper comparisons require a fresh server response.</div> : null}
    {currentRegime?.classification === "RISK OFF" ? <div className="mt-5 flex gap-3 rounded-xl border border-rose-300/25 bg-rose-300/[.06] p-4 text-xs text-rose-100"><ShieldAlert className="h-4 w-4 shrink-0" /><p><strong>RISK OFF.</strong> Technical Potential and Watch items remain visible below for monitoring, but trade qualification and Paper actions stay restricted.</p></div> : null}
    <section className="mt-5 rounded-2xl border border-cyan-300/15 bg-cyan-300/[.025] p-4"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-cyan-300">Opportunity funnel</p><h2 className="mt-1 text-sm font-semibold text-slate-100">Where the current universe lands</h2></div><span className="text-[11px] text-slate-500">{totalEvaluated == null ? "Awaiting server response" : `${totalEvaluated} assets evaluated across Scalp + Swing`}</span></div><div className="mt-4 grid gap-2 sm:grid-cols-5">{funnel.map(item => <div key={item.label} className="rounded-lg border border-white/[.07] bg-white/[.025] p-3"><div className="flex items-center justify-between gap-2"><span className="text-[10px] font-semibold uppercase tracking-[.12em] text-slate-500">{item.label}</span><strong className="font-mono text-lg text-slate-100">{totalEvaluated == null ? "—" : item.count}</strong></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-cyan-300" style={{ width: totalEvaluated ? `${item.count / totalEvaluated * 100}%` : "0%" }} /></div></div>)}</div><p className="mt-3 text-[11px] text-slate-500">Counts are derived from the two current discovery responses. A Potential item is not silently converted to No Trade because of RISK OFF; it remains visible with a restriction warning.</p></section>
    <section className="mt-5 rounded-xl border border-white/[.07] bg-white/[.018] p-4"><div className="flex items-center gap-2"><Filter className="h-4 w-4 text-cyan-300" /><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-cyan-300">Adaptive display filters</p><span className="text-[10px] text-slate-500">presentation only</span></div><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"><SelectField label="Status" value={status} options={["ALL", ...STATUS_ORDER]} onChange={value => setStatus(value as StatusFilter)} /><SelectField label="Strategy" value={strategy} options={["ALL", "SCALP", "SWING"]} onChange={value => setStrategy(value as StrategyFilter)} /><SelectField label="Direction" value={direction} options={["ALL", "LONG", "SHORT"]} onChange={value => setDirection(value as DirectionFilter)} /><SelectField label="Regime" value={regime} options={["ALL", "RISK ON", "SELECTIVE", "NEUTRAL", "RISK OFF", "UNAVAILABLE"]} onChange={value => setRegime(value as RegimeFilter)} /><SelectField label="Health" value={health} options={["ALL", "HEALTHY", "WARNING", "REVERSAL RISK", "INVALIDATED", "UNKNOWN"]} onChange={value => setHealth(value as HealthFilter)} /><SelectField label="Timeframe" value={timeframe} options={["ALL", "15M", "1H", "4H", "1D"]} onChange={value => setTimeframe(value as TimeframeFilter)} /></div><p className="mt-3 text-[11px] text-slate-500">Showing {filtered.length} of {totalEvaluated ?? "—"} server-returned opportunities. Filters do not recalculate scores or change eligibility.</p></section>
    <section className="mt-5 space-y-3">{publicLoading ? <EmptyBlock text="Loading current server-validated opportunities…" /> : publicError ? <EmptyBlock text={`DATA UNAVAILABLE · ${publicError}`} /> : filtered.length ? filtered.slice(0, 24).map(item => <OpportunityIntelligenceRow key={`${item.strategy}-${item.assetId}`} item={item} />) : <EmptyBlock text={totalEvaluated == null ? "DATA UNAVAILABLE · No validated opportunity response is available." : "NO MATCHES · The selected presentation filters do not match the current server response."} />}</section>
    <section className="mt-6 rounded-2xl border border-emerald-300/15 bg-emerald-300/[.025] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-emerald-300">Auto Paper experiment ledger</p><h2 className="mt-1 text-sm font-semibold text-slate-100">Measure the strategy without touching real markets</h2><p className="mt-2 max-w-3xl text-xs leading-5 text-slate-400">Comparisons below use the private Auto Paper history and the existing server performance summary. No trial is created when this workspace opens. Auto Paper stays OFF until explicitly enabled in its own workspace.</p></div><Button size="sm" variant="outline" onClick={onOpenAutoPaper} className="border-emerald-300/25 bg-emerald-300/[.05] text-emerald-100"><Sparkles className="mr-1.5 h-3.5 w-3.5" />Open Auto Paper Lab</Button></div>{!isAuthenticated ? <div className="mt-4 flex gap-3 rounded-lg border border-amber-300/20 bg-amber-300/[.05] p-3 text-xs text-amber-100"><LockKeyhole className="h-4 w-4 shrink-0" /><p>Owner authentication is required for private trials, accounting, comparisons, and journal rows. Public opportunity states remain read-only.</p></div> : <><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5"><Metric label="Sample" value={performanceQuery.data?.sampleLabel ?? "LIMITED SAMPLE"} /><Metric label="Trials" value={performanceQuery.data?.totalTrials ?? "—"} /><Metric label="Completed" value={performanceQuery.data?.completed ?? "—"} /><Metric label="Net P/L" value={performanceQuery.data?.netPnl == null ? "—" : money.format(performanceQuery.data.netPnl)} /><Metric label="Current equity" value={performanceQuery.data?.currentEquity == null ? "—" : money.format(performanceQuery.data.currentEquity)} /></div><div className="mt-4 grid gap-3 xl:grid-cols-4"><Comparison title="Scalp vs Swing" rows={autoPaperRows.strategy} /><Comparison title="Qualified vs Potential" rows={autoPaperRows.qualification} /><Comparison title="Long vs Short" rows={autoPaperRows.direction} /><Comparison title="By Market Regime" rows={autoPaperRows.regime} /></div></>}</section>
    <section className="mt-6 rounded-2xl border border-white/[.07] bg-white/[.018] p-4"><div className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-cyan-300" /><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-cyan-300">Trading Journal</p><h2 className="mt-1 text-sm font-semibold text-slate-100">Chronological simulation record</h2></div></div>{!isAuthenticated ? <EmptyBlock text="OWNER AUTHENTICATION REQUIRED · Private Auto Paper journal is not public." /> : journal.length ? <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="text-[9px] uppercase tracking-[.14em] text-slate-500"><tr><th className="px-3 py-2">Time</th><th className="px-3 py-2">Asset / strategy</th><th className="px-3 py-2">Direction</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">P/L</th><th className="px-3 py-2">Qualification / regime</th></tr></thead><tbody>{journal.map(trial => <tr key={trial.id} className="border-t border-white/[.06]"><td className="px-3 py-3 text-slate-500">{date(trial.completedAt ?? trial.createdAt)}</td><td className="px-3 py-3"><strong className="text-slate-200">{trial.assetId}</strong><span className="ml-2 text-slate-500">{trial.strategy === "SCALP" ? "FAST SCALP" : trial.strategy} · {trial.timeframe}</span></td><td className="px-3 py-3 text-slate-300">{trial.direction.toUpperCase()}</td><td className="px-3 py-3"><Badge variant="outline" className={trial.status === "COMPLETED" || trial.status.includes("TARGET") ? "border-emerald-300/25 text-emerald-200" : trial.status === "STOPPED" || trial.status === "INVALIDATED" ? "border-rose-300/25 text-rose-200" : "border-amber-300/25 text-amber-200"}>{trial.status.replaceAll("_", " ")}</Badge></td><td className={trialPnl(trial) >= 0 ? "px-3 py-3 font-mono text-emerald-200" : "px-3 py-3 font-mono text-rose-200"}>{money.format(trialPnl(trial))}</td><td className="px-3 py-3 text-slate-500">{qualificationFor(trial)} · {regimeFor(trial)}</td></tr>)}</tbody></table></div> : <EmptyBlock text={historyQuery.isLoading ? "Loading private Auto Paper history…" : "NO PERSISTED TRIALS · The journal is empty until the owner enables simulation and a validated trial is recorded."} />}</section>
    <div className="mt-5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500"><BarChart3 className="h-4 w-4 text-cyan-300" />All prices, plans, lifecycle states, and P/L values remain server-derived. This workspace never sends exchange orders and never mixes Manual Paper accounting with Auto Paper.</div>
  </section>;
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="flex min-w-0 flex-col gap-1 text-[10px] font-semibold uppercase tracking-[.12em] text-slate-500"><span>{label}</span><select value={value} onChange={event => onChange(event.target.value)} className="h-9 w-full rounded-lg border border-white/[.08] bg-[#0b1321] px-2 text-[11px] font-normal tracking-normal text-slate-200 outline-none focus:border-cyan-300/40">{options.map(option => <option key={option} value={option}>{option === "ALL" ? "All" : option}</option>)}</select></label>;
}

function OpportunityIntelligenceRow({ item }: { item: WorkspaceItem }) {
  const plan = item.sourcePlan;
  const hasPlan = Boolean(plan?.entryZone && plan.stop && plan.targets?.length);
  const statusTone = item.status === "QUALIFIED" ? "border-emerald-300/25 bg-emerald-300/[.07] text-emerald-200" : item.status === "POTENTIAL" ? "border-amber-300/25 bg-amber-300/[.07] text-amber-200" : item.status === "WATCH" ? "border-cyan-300/25 bg-cyan-300/[.07] text-cyan-200" : item.status === "NO TRADE" ? "border-rose-300/25 bg-rose-300/[.07] text-rose-200" : "border-slate-300/20 bg-slate-300/[.05] text-slate-300";
  return <article className="rounded-xl border border-white/[.07] bg-white/[.02] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-800 font-mono text-xs font-bold text-cyan-200">{item.symbol.slice(0, 2)}</span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-slate-100">{item.symbol}</h3><Badge variant="outline" className={statusTone}>{item.status}</Badge><Badge variant="outline" className="border-white/[.08] text-slate-400">{item.strategy === "SCALP" ? "15M FAST SCALP" : "SWING"}</Badge><Badge variant="outline" className="border-white/[.08] text-slate-400">{item.direction}</Badge>{item.regime?.restricted ? <Badge variant="outline" className="border-rose-300/25 text-rose-200">RISK OFF</Badge> : null}</div><p className="mt-1 text-[11px] text-slate-500">Opportunity {item.opportunityScore ?? "UNAVAILABLE"}/100 · Quality {item.adaptive?.quality?.score ?? "UNAVAILABLE"} · Confidence {item.adaptive?.quality?.confidence ?? "UNAVAILABLE"} · {item.provider ?? "UNAVAILABLE"} · {date(item.dataTimestamp)}</p></div></div><div className="text-right"><p className="text-[9px] font-semibold uppercase tracking-[.14em] text-slate-500">Readiness</p><p className="mt-1 font-mono text-lg text-cyan-200">{item.setupReadiness?.score ?? "—"}</p></div></div><div className="mt-3 grid gap-3 border-t border-white/[.06] pt-3 md:grid-cols-[1.2fr_.8fr] md:items-start"><div><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-cyan-300">WHY / STATUS</p><p className="mt-1 text-xs leading-5 text-slate-300">{item.exactReason ?? "Server explanation unavailable."}</p>{item.regime?.restricted ? <p className="mt-2 flex items-center gap-1.5 text-[11px] text-rose-200"><CircleAlert className="h-3.5 w-3.5" />Setup exists, but market regime is unfavorable. Qualification remains restricted.</p> : null}<p className="mt-2 text-[11px] text-slate-500">Health: {healthFor(item)} · Trade readiness: {item.tradeReadiness ?? "UNAVAILABLE"} · Timeframe: {timeframeFor(item)}</p></div><div className="rounded-lg border border-white/[.06] bg-black/10 p-3 text-[11px] text-slate-400">{hasPlan ? <><p className="font-semibold uppercase tracking-[.12em] text-slate-500">Validated plan levels</p><div className="mt-2 grid grid-cols-2 gap-2"><span>Entry <strong className="font-mono text-slate-200">{number(plan?.entryZone?.preferred)}</strong></span><span>Stop <strong className="font-mono text-rose-200">{number(plan?.stop?.price)}</strong></span>{plan?.targets.slice(0, 3).map(target => <span key={target.label}>{target.label} <strong className="font-mono text-emerald-200">{number(target.price)}</strong></span>)}<span>R:R <strong className="font-mono text-cyan-200">{number(plan?.rewardRisk)}</strong></span></div></> : <><p className="font-semibold uppercase tracking-[.12em] text-amber-200">TRADE PLAN UNAVAILABLE</p><p className="mt-1 leading-4">No complete server-derived Entry / Stop / Target path is available for this status.</p></>}</div></div></article>;
}

function Comparison({ title, rows }: { title: string; rows: CompareRow[] }) {
  return <section className="rounded-xl border border-white/[.07] bg-white/[.02] p-3"><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-cyan-300">{title}</p>{rows.length ? <div className="mt-3 space-y-3">{rows.map(row => <div key={row.label}><div className="flex items-center justify-between gap-2 text-xs"><strong className="truncate text-slate-200">{row.label}</strong><span className="font-mono text-slate-500">{row.trials}</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-emerald-300" style={{ width: `${row.trials ? Math.min(100, row.completed / row.trials * 100) : 0}%` }} /></div><p className="mt-1 text-[10px] text-slate-500">Completed {row.completed} · Wins {row.wins} · {row.completed < 5 ? "Insufficient sample" : `${(row.wins / row.completed * 100).toFixed(1)}% win rate`} · P/L {money.format(row.pnl)}</p></div>)}</div> : <p className="mt-3 text-[11px] leading-4 text-slate-500">No persisted Auto Paper observations in this comparison yet.</p>}</section>;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg border border-white/[.07] bg-white/[.025] p-3"><p className="text-[9px] font-semibold uppercase tracking-[.13em] text-slate-500">{label}</p><p className="mt-1 truncate font-mono text-sm text-slate-100">{value}</p></div>;
}

function EmptyBlock({ text }: { text: string }) {
  return <div className="grid place-items-center rounded-xl border border-dashed border-white/[.09] bg-white/[.015] p-8 text-center text-xs text-slate-500"><CircleAlert className="h-5 w-5 text-slate-600" /><p className="mt-2">{text}</p></div>;
}
