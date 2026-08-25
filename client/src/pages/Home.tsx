import { Button } from "@/components/ui/button";
import { SettingsPanel } from "@/components/crypto/SettingsPanel";
import { PaperTradingWorkspace } from "@/components/crypto/PaperTradingWorkspace";
import { BacktestingPanel } from "@/components/crypto/BacktestingPanel";
import { AlertsPanel } from "@/components/crypto/AlertsPanel";
import { ResearchSummaryPanel } from "@/components/crypto/ResearchSummaryPanel";
import { OpportunityResearchLab } from "@/components/crypto/OpportunityResearchLab";
import { HistoricalDataFoundation } from "@/components/crypto/HistoricalDataFoundation";
import { ExecutionCostLab } from "@/components/crypto/ExecutionCostLab";
import { BackupRecoveryPanel } from "@/components/crypto/BackupRecoveryPanel";
import { AssetIntelligencePanel } from "@/components/crypto/AssetIntelligencePanel";
import { TradeSetupWorkspace } from "@/components/crypto/TradeSetupWorkspace";
import { OpportunityDiscoveryWorkspace } from "@/components/crypto/OpportunityDiscoveryWorkspace";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import type { ScannerResponse, ScannerRow } from "@shared/crypto";
import { cn } from "@/lib/utils";
import { OnlineStatusLabel, usePwaStatus } from "@/pwa/PwaStatus";
import {
  Activity, AlertTriangle, ArchiveRestore, ArrowDownRight, ArrowUpRight, BarChart3, BellRing, BookOpen, Calculator, ChevronDown,
  ChevronRight, Clock3, Database, FlaskConical, Gauge, Layers3, LineChart, Loader2, PanelLeft,
  RefreshCw, ScanSearch, Settings2, ShieldCheck, SlidersHorizontal, Sparkles, Target, TrendingUp,
  WalletCards, X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type NavItem = { label: string; icon: typeof Gauge; phase: "live" | "planned" };

const navigation: NavItem[] = [
  { label: "Dashboard", icon: Gauge, phase: "live" },
  { label: "Market Scanner", icon: ScanSearch, phase: "live" },
  { label: "Opportunity Discovery", icon: Sparkles, phase: "live" },
  { label: "Scalping", icon: Target, phase: "live" },
  { label: "Swing", icon: TrendingUp, phase: "live" },
  { label: "Research Summary", icon: FlaskConical, phase: "live" },
  { label: "Research Lab", icon: FlaskConical, phase: "live" },
  { label: "Historical Data", icon: Database, phase: "live" },
  { label: "Execution Cost Lab", icon: Calculator, phase: "live" },
  { label: "Backup & Recovery", icon: ArchiveRestore, phase: "live" },
  { label: "Sectors", icon: Layers3, phase: "planned" },
  { label: "Backtesting", icon: BarChart3, phase: "live" },
  { label: "Paper Trading", icon: WalletCards, phase: "live" },
  { label: "Alerts", icon: BellRing, phase: "live" },
  { label: "Settings", icon: Settings2, phase: "live" },
];

const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

function formatPrice(value: number | null) {
  if (value === null) return "Unavailable";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: value >= 100 ? 2 : value >= 1 ? 3 : 5 }).format(value);
}

function formatCompact(value: number | null) {
  if (value === null) return "Unavailable";
  return new Intl.NumberFormat("en-US", { notation: "compact", style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

function formatPct(value: number | null) {
  if (value === null) return "Unavailable";
  return `${value >= 0 ? "+" : ""}${decimal.format(value)}%`;
}

function timeAgo(timestamp: number | null | undefined) {
  if (!timestamp) return "Unavailable";
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1_000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

function scoreClass(value: number | null | undefined) {
  if (value === null || value === undefined) return "text-slate-500";
  if (value >= 72) return "text-emerald-300";
  if (value >= 55) return "text-cyan-300";
  if (value >= 40) return "text-amber-300";
  return "text-rose-300";
}

function changeClass(value: number | null | undefined) {
  if (value === null || value === undefined) return "text-slate-500";
  return value >= 0 ? "text-emerald-300" : "text-rose-300";
}

function StatusDot({ status }: { status: "live" | "stale" | "unavailable" }) {
  const { connectionState } = usePwaStatus();
  const effectiveStatus = connectionState === "ONLINE" ? status : "stale";
  return <span className={cn("inline-flex h-1.5 w-1.5 rounded-full", effectiveStatus === "live" ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.8)]" : effectiveStatus === "stale" ? "bg-amber-400" : "bg-rose-400")} />;
}

function EmptyRow() {
  return <div className="grid min-h-48 place-items-center px-6 text-center text-sm text-slate-400"><div><Database className="mx-auto mb-3 h-5 w-5 text-slate-500" /><p className="font-medium text-slate-300">No live score is available</p><p className="mt-1 max-w-sm text-xs leading-5">The system will show “Unavailable” rather than construct an opportunity when the required source data is missing.</p></div></div>;
}

function OpportunityRow({ row, rank, onSelect, selected }: { row: ScannerRow; rank: number; onSelect: () => void; selected: boolean }) {
  const score = row.score;
  return <button onClick={onSelect} className={cn("grid w-full grid-cols-[36px_minmax(150px,1.4fr)_minmax(88px,.8fr)_minmax(86px,.7fr)_minmax(116px,.9fr)_minmax(106px,.8fr)_32px] items-center gap-3 border-b border-white/[.055] px-5 py-3.5 text-left transition-colors hover:bg-cyan-300/[.045] focus:outline-none focus-visible:bg-cyan-300/[.08]", selected && "bg-cyan-300/[.07] shadow-[inset_2px_0_0_#22d3ee]", !score && "opacity-70")}>
    <span className="font-mono text-xs text-slate-500">{String(rank).padStart(2, "0")}</span>
    <span className="min-w-0"><span className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-md bg-slate-800 text-[10px] font-bold text-cyan-200">{row.asset.symbol.slice(0, 2)}</span><span className="min-w-0"><span className="block truncate font-semibold text-slate-100">{row.asset.symbol}<span className="ml-1.5 hidden text-xs font-normal text-slate-500 lg:inline">{row.asset.name}</span></span><span className="block truncate text-[10px] uppercase tracking-[.16em] text-slate-500">{row.asset.sector}</span></span></span></span>
    <span><span className="font-mono text-sm text-slate-100">{formatPrice(row.asset.price)}</span><span className={cn("mt-1 block font-mono text-[11px]", changeClass(row.asset.change24h))}>{formatPct(row.asset.change24h)}</span></span>
    <span><span className={cn("font-mono text-2xl font-semibold tracking-tight", scoreClass(score?.score))}>{score?.score ?? "—"}</span><span className="ml-1 text-[10px] uppercase tracking-wider text-slate-500">/100</span></span>
    <span><span className={cn("inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[.08em]", score?.direction === "bullish" ? "border-emerald-300/20 bg-emerald-300/[.07] text-emerald-200" : score?.direction === "bearish" ? "border-rose-300/20 bg-rose-300/[.07] text-rose-200" : "border-slate-500/25 bg-slate-500/[.07] text-slate-300")}>{score?.setupType ?? "Insufficient data"}</span></span>
    <span><span className={cn("font-mono text-sm", scoreClass(score?.confidence))}>{score?.confidence ?? "—"}</span><span className="ml-1 text-[10px] uppercase tracking-wider text-slate-500">conf.</span></span>
    <ChevronRight className="h-4 w-4 text-slate-600" />
  </button>;
}

function DetailPanel({ row, onClose, onPaperTrade }: { row: ScannerRow | null; onClose: () => void; onPaperTrade: (row: ScannerRow) => void }) {
  const { online, liveDataAvailable } = usePwaStatus();
  if (!row) return <aside className="hidden min-h-[620px] w-[390px] shrink-0 border-l border-white/[.07] bg-slate-950/45 2xl:block"><EmptyRow /></aside>;
  const score = row.score;
  return <aside className="hidden min-h-[620px] w-[390px] shrink-0 border-l border-white/[.07] bg-[#090f1b]/80 2xl:block">
    <div className="flex items-center justify-between border-b border-white/[.07] px-5 py-4"><div><div className="flex items-center gap-2"><span className="text-sm font-bold text-slate-100">{row.asset.symbol} Research Card</span><Badge variant="outline" className="border-cyan-300/20 bg-cyan-300/[.06] text-[9px] uppercase tracking-[.14em] text-cyan-200">{online ? "Live basis" : "Last known data"}</Badge></div><p className="mt-1 text-[11px] text-slate-500">{row.asset.name} · {row.asset.sector}</p></div><button onClick={onClose} className="rounded-md p-1.5 text-slate-500 hover:bg-white/5 hover:text-slate-200" aria-label="Close detail"><X className="h-4 w-4" /></button></div>
    {!score ? <EmptyRow /> : <div className="space-y-5 p-5">
      <div className="grid grid-cols-3 gap-2"><MetricSmall label="Opportunity" value={score.score} tone="cyan" /><MetricSmall label="Confidence" value={score.confidence} tone="emerald" /><MetricSmall label="Risk safety" value={score.riskScore} tone={score.riskScore >= 65 ? "emerald" : "amber"} /></div>
      <section className="rounded-xl border border-white/[.07] bg-white/[.025] p-3.5"><span className="text-[10px] font-semibold uppercase tracking-[.17em] text-cyan-200">Why ranked highly</span><p className="mt-2 text-sm leading-6 text-slate-300">{score.explanation}</p><button onClick={() => onPaperTrade(row)} disabled={!online} className="mt-3 flex items-center gap-2 rounded-md border border-emerald-300/20 bg-emerald-300/[.06] px-3 py-2 text-[11px] font-medium text-emerald-100 hover:bg-emerald-300/[.1] disabled:cursor-not-allowed disabled:opacity-45"><WalletCards className="h-3.5 w-3.5" />{online ? "Paper trade this live signal" : "Paper Trading requires connection"}</button></section>
      <section><div className="mb-2 flex items-center justify-between"><h3 className="text-[10px] font-semibold uppercase tracking-[.17em] text-slate-500">Score components</h3><span className="text-[10px] text-slate-600">Inspectable inputs</span></div><div className="space-y-2">{score.reasons.slice(0, 6).map(reason => <div key={reason.key} className="rounded-lg border border-white/[.06] bg-white/[.02] px-3 py-2.5"><div className="flex items-center justify-between gap-3"><span className="text-xs font-medium text-slate-200">{reason.label}</span><span className={cn("font-mono text-xs", reason.direction === "positive" ? "text-emerald-300" : reason.direction === "negative" ? "text-rose-300" : "text-slate-400")}>{decimal.format(reason.score)}/{reason.maxScore}</span></div><p className="mt-1 text-[11px] leading-4 text-slate-500">{reason.detail}</p></div>)}</div></section>
      <section><h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[.17em] text-slate-500">Multi-timeframe contribution</h3><div className="grid grid-cols-2 gap-2">{score.technicalByTimeframe.map(analysis => <div key={analysis.timeframe} className="rounded-lg border border-white/[.06] bg-white/[.02] px-3 py-2.5"><div className="flex items-center justify-between"><span className="font-mono text-xs text-slate-300">{analysis.timeframe.toUpperCase()}</span><span className={cn("text-[10px] font-semibold uppercase", analysis.bias === "bullish" ? "text-emerald-300" : analysis.bias === "bearish" ? "text-rose-300" : "text-slate-400")}>{analysis.bias}</span></div><div className="mt-2 flex items-end justify-between"><span className="font-mono text-lg text-slate-100">{analysis.score}<span className="text-[10px] text-slate-500">/10</span></span><span className="text-[10px] text-slate-500">RSI {analysis.rsi ?? "—"}</span></div></div>)}</div></section>
      {score.missingConditions.length > 0 && <section className="rounded-xl border border-amber-300/10 bg-amber-300/[.035] p-3.5"><span className="text-[10px] font-semibold uppercase tracking-[.17em] text-amber-200">What is missing</span><ul className="mt-2 space-y-1.5">{score.missingConditions.map(item => <li key={item} className="flex gap-2 text-xs leading-5 text-amber-100/75"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300/75" />{item}</li>)}</ul></section>}
    </div>}
  </aside>;
}

function MetricSmall({ label, value, tone }: { label: string; value: number | null; tone: "cyan" | "emerald" | "amber" }) {
  const tones = { cyan: "text-cyan-200", emerald: "text-emerald-200", amber: "text-amber-200" };
  return <div className="rounded-lg border border-white/[.06] bg-white/[.02] px-3 py-2.5"><span className="block text-[9px] font-semibold uppercase tracking-[.14em] text-slate-500">{label}</span><span className={cn("mt-1 block font-mono text-xl font-semibold", tones[tone])}>{value ?? "—"}<span className="text-[10px] text-slate-500">/100</span></span></div>;
}

function RegimeBanner({ scan }: { scan: ScannerResponse | undefined }) {
  const regime = scan?.marketRegime;
  const tone = regime?.classification === "RISK ON" ? "emerald" : regime?.classification === "RISK OFF" ? "rose" : "amber";
  const styles = { emerald: "border-emerald-300/20 bg-emerald-300/[.06] text-emerald-100", amber: "border-amber-300/20 bg-amber-300/[.06] text-amber-100", rose: "border-rose-300/20 bg-rose-300/[.06] text-rose-100" };
  const providerHealth = useMemo(() => {
    const grouped = new Map<string, { provider: string; status: "live" | "stale" | "unavailable"; lastSuccess: number | null; lastError: string | null; errorClass: string | null; affected: Set<string> }>();
    for (const status of scan?.rows.flatMap(row => row.dataStatus).filter(status => status.capability === "OHLCV") ?? []) {
      const provider = status.provider ?? status.source;
      const item = grouped.get(provider) ?? { provider, status: "live" as const, lastSuccess: null, lastError: null, errorClass: null, affected: new Set<string>() };
      item.affected.add(status.timeframe ?? "OHLCV");
      if (status.status === "live") item.lastSuccess = Math.max(item.lastSuccess ?? 0, status.fetchedAt);
      if (status.status === "unavailable") { item.status = "unavailable"; item.lastError = status.message ?? "Provider unavailable."; item.errorClass = status.errorClass ?? "PROVIDER_REQUEST_FAILED"; }
      grouped.set(provider, item);
    }
    return Array.from(grouped.values());
  }, [scan]);
  const { data: monitorSummary } = trpc.crypto.providerMonitorSummary.useQuery(undefined, { staleTime: 60_000, refetchOnWindowFocus: false });
  const monitorChecks = monitorSummary?.checks ?? [];
  const primaryMonitor = monitorChecks.find(check => check.provider === "Binance Futures" && !check.fallbackUsed) ?? null;
  const fallbackUsedCheck = monitorChecks.find(check => check.provider === "Kraken Spot" && check.fallbackUsed && check.status === "live") ?? null;
  const lastFailure = monitorChecks.find(check => check.status === "unavailable" && (check.details as Record<string, unknown>)?.expectedUnavailable !== true) ?? null;
  return <div className={cn("relative overflow-hidden rounded-xl border px-4 py-3", styles[tone])}>
    <div className="absolute inset-y-0 left-0 w-1 bg-current opacity-70" />
    <div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-black/15"><Activity className="h-4 w-4" /></div><div><div className="flex items-center gap-2"><span className="text-[10px] font-semibold uppercase tracking-[.18em] opacity-65">Market regime</span><span className="h-1 w-1 rounded-full bg-current opacity-80" /><span className="font-mono text-sm font-bold">{regime?.classification ?? "UNAVAILABLE"}</span></div><p className="mt-0.5 text-xs opacity-75">{regime ? `Regime score ${regime.score}/100 · BTC dominance ${regime.btcDominance === null ? "Unavailable" : `${decimal.format(regime.btcDominance)}%`} · Breadth ${regime.breadth === null ? "Unavailable" : `${decimal.format(regime.breadth)}%`}` : "The source data needed to classify the market environment is unavailable."}</p></div></div>
    {providerHealth.length ? <div className="mt-3 grid gap-2 border-t border-current/10 pt-3 sm:grid-cols-2"><span className="col-span-full text-[9px] font-semibold uppercase tracking-[.14em] opacity-65">Live OHLCV provider health</span>{providerHealth.map(item => <div key={item.provider} className="rounded-md bg-black/10 px-2.5 py-2 text-[10px]"><div className="flex items-center justify-between gap-2"><span className="font-medium">SOURCE: {item.provider}</span><span className={item.status === "live" ? "text-emerald-200" : "text-rose-200"}>DATA QUALITY: {item.status === "live" ? "VALID" : "UNAVAILABLE"}</span></div><p className="mt-1 opacity-75">OHLCV · {Array.from(item.affected).join(", ")} · {item.lastSuccess ? `last success ${timeAgo(item.lastSuccess)}` : `last error ${item.errorClass ?? "UNAVAILABLE"}`}</p>{item.lastError ? <p className="mt-1 truncate text-rose-100/80">{item.lastError}</p> : null}</div>)}</div> : null}
    <div className="mt-3 rounded-md border border-current/10 bg-black/10 px-2.5 py-2 text-[10px]"><div className="flex items-center justify-between"><span className="font-medium">Scheduled Provider Monitor</span><span>{monitorSummary?.monitor?.lastStatus ?? "PENDING"}</span></div><p className="mt-1 opacity-75">Primary Provider: {primaryMonitor?.provider ?? "Pending"} · Fallback Provider: Kraken Spot · Fallback Usage: {fallbackUsedCheck ? "USED IN CONTROLLED 451 CHECK" : "AVAILABLE / NOT USED"}</p><p className="mt-1 opacity-75">Last Successful Request: {primaryMonitor?.status === "live" ? timeAgo(primaryMonitor.createdAt.getTime()) : "Unavailable"} · Last Failure: {lastFailure?.classification ?? "None recorded"} · Last Monitoring Run: {monitorSummary?.execution?.completedAt ? timeAgo(monitorSummary.execution.completedAt.getTime()) : "Pending"}</p></div>
  </div>;
}

export default function Home() {
  const { online, connectionState, liveDataAvailable, updateReady, markReadSnapshot, markLiveDataUnavailable } = usePwaStatus();
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [activeNav, setActiveNav] = useState("Dashboard");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paperOpen, setPaperOpen] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("workspace") === "paper-trading");
  const [paperAsset, setPaperAsset] = useState<ScannerRow | null>(null);
  const [paperSetupMode, setPaperSetupMode] = useState<"SCALP" | "SWING" | "LOW_TIMEFRAME_SCALPING" | undefined>();
  const [setupMode, setSetupMode] = useState<"SCALP" | "SWING" | null>(null);
  const [discoveryOpen, setDiscoveryOpen] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("workspace") === "opportunity-discovery");
  const [backtestingOpen, setBacktestingOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [researchSummaryOpen, setResearchSummaryOpen] = useState(false);
  const [researchLabOpen, setResearchLabOpen] = useState(false);
  const [historicalDataOpen, setHistoricalDataOpen] = useState(false);
  const [executionCostLabOpen, setExecutionCostLabOpen] = useState(false);
  const [backupRecoveryOpen, setBackupRecoveryOpen] = useState(false);
  const [assetIntelligenceOpen, setAssetIntelligenceOpen] = useState(false);
  const [minScore, setMinScore] = useState(0);
  const [sector, setSector] = useState("All sectors");
  const { data: scan, isLoading, isFetching, error } = trpc.crypto.scanner.useQuery({ forceRefresh: refreshNonce > 0 }, { refetchOnWindowFocus: false, staleTime: 45_000, retry: 1 });
  const rows = scan?.rows ?? [];
  const sectors = useMemo(() => ["All sectors", ...Array.from(new Set(rows.map(row => row.asset.sector))).sort()], [rows]);
  const filteredRows = useMemo(() => rows.filter(row => (row.score?.score ?? -1) >= minScore && (sector === "All sectors" || row.asset.sector === sector)), [rows, minScore, sector]);
  const selected = rows.find(row => row.asset.id === selectedId) ?? filteredRows[0] ?? null;
  const topRows = rows.filter(row => row.score).slice(0, 3);
  const sectorRotation = useMemo(() => Object.entries(rows.filter(row => row.score).reduce<Record<string, number[]>>((map, row) => { (map[row.asset.sector] ??= []).push(row.score!.score); return map; }, {})).map(([name, values]) => ({ name, score: values.reduce((sum, value) => sum + value, 0) / values.length })).sort((a, b) => b.score - a.score).slice(0, 4), [rows]);
  useEffect(() => { if (online) markReadSnapshot(scan?.generatedAt, Boolean(scan?.dataStatus.some(status => status.status === "live"))); }, [online, scan?.generatedAt, scan?.dataStatus, markReadSnapshot]);
  useEffect(() => { if (online && error) markLiveDataUnavailable(); }, [online, error, markLiveDataUnavailable]);
  useEffect(() => { if (selectedId) setAssetIntelligenceOpen(true); }, [selectedId]);
  const scrollToScanner = () => { requestAnimationFrame(() => document.getElementById("market-scanner")?.scrollIntoView({ behavior: "smooth", block: "start" })); };
  const openPaperWorkspace = (asset: ScannerRow | null, mode?: "SCALP" | "SWING" | "LOW_TIMEFRAME_SCALPING") => { setPaperAsset(asset); setPaperSetupMode(mode); setSetupMode(null); setDiscoveryOpen(false); setActiveNav("Paper Trading"); setPaperOpen(true); if (typeof window !== "undefined") window.history.replaceState(null, "", `${window.location.pathname}?workspace=paper-trading`); };
  const closePaperWorkspace = () => { setPaperOpen(false); setPaperSetupMode(undefined); setActiveNav("Dashboard"); if (typeof window !== "undefined") window.history.replaceState(null, "", window.location.pathname); };
  const openSetupWorkspace = (mode: "SCALP" | "SWING") => { setPaperOpen(false); setDiscoveryOpen(false); setSetupMode(mode); setActiveNav(mode === "SCALP" ? "Scalping" : "Swing"); };
  const openDiscoveryWorkspace = () => { setPaperOpen(false); setSetupMode(null); setDiscoveryOpen(true); setActiveNav("Opportunity Discovery"); if (typeof window !== "undefined") window.history.replaceState(null, "", `${window.location.pathname}?workspace=opportunity-discovery`); };
  const handleNav = (item: NavItem) => { if (item.label === "Settings") { setSettingsOpen(true); return; } if (item.label === "Paper Trading") { openPaperWorkspace(selected); return; } if (item.label === "Scalping") { openSetupWorkspace("SCALP"); return; } if (item.label === "Swing") { openSetupWorkspace("SWING"); return; } if (item.label === "Opportunity Discovery") { openDiscoveryWorkspace(); return; } if (item.label === "Market Scanner") { setActiveNav(item.label); scrollToScanner(); return; } if (item.label === "Backtesting") { setBacktestingOpen(true); return; } if (item.label === "Alerts") { setAlertsOpen(true); return; } if (item.label === "Research Summary") { setResearchSummaryOpen(true); return; } if (item.label === "Research Lab") { setResearchLabOpen(true); return; } if (item.label === "Historical Data") { setHistoricalDataOpen(true); return; } if (item.label === "Execution Cost Lab") { setExecutionCostLabOpen(true); return; } if (item.label === "Backup & Recovery") { setBackupRecoveryOpen(true); return; } if (item.phase === "planned") { toast.message(`${item.label} is planned after the verified Phase 1 scanner milestone.`, { description: "No placeholder data has been added for this feature." }); return; } setActiveNav(item.label); };
  useEffect(() => {
    const onMobileNavigate = (event: Event) => {
      const target = (event as CustomEvent<"dashboard" | "scanner" | "discovery" | "scalping" | "swing" | "paper" | "alerts" | "research">).detail;
      if (target === "paper") openPaperWorkspace(selected);
      else if (target === "scalping") openSetupWorkspace("SCALP");
      else if (target === "swing") openSetupWorkspace("SWING");
      else if (target === "discovery") openDiscoveryWorkspace();
      else {
        closePaperWorkspace();
        if (target === "alerts") { setActiveNav("Alerts"); setAlertsOpen(true); }
        else if (target === "research") { setActiveNav("Research Lab"); setResearchLabOpen(true); }
        else { setActiveNav(target === "scanner" ? "Market Scanner" : "Dashboard"); if (target === "scanner") scrollToScanner(); }
      }
    };
    window.addEventListener("crypto-hub:navigate", onMobileNavigate);
    return () => window.removeEventListener("crypto-hub:navigate", onMobileNavigate);
  }, [selected]);
  const refresh = () => { if (!online) { toast.message("Offline read-only mode", { description: "Live data is unavailable until Crypto Hub reconnects." }); return; } setRefreshNonce(value => value + 1); toast.message("Refreshing public market sources", { description: "The scanner will display unavailable states if a source does not respond." }); };
  const pwaBannerVisible = connectionState !== "ONLINE" || updateReady;
  return <div className={cn("min-h-screen bg-[#060a12] text-slate-100 selection:bg-cyan-300/30", pwaBannerVisible && "pt-16")}>
    <AssetIntelligencePanel row={selected} open={assetIntelligenceOpen} onOpenChange={setAssetIntelligenceOpen} onPaperTrade={(row, mode) => { setAssetIntelligenceOpen(false); openPaperWorkspace(row, mode); }} />
    <div className="terminal-grid fixed inset-0 pointer-events-none opacity-40" />
    <div className="relative mx-auto flex min-h-screen max-w-[1800px]">
      <aside className="hidden w-[234px] shrink-0 border-r border-white/[.07] bg-[#070c16]/80 px-3 py-5 lg:flex lg:flex-col"><div className="flex items-center gap-3 px-2 pb-7"><div className="relative grid h-8 w-8 place-items-center rounded-lg bg-cyan-300 text-slate-950 shadow-[0_0_24px_rgba(34,211,238,.32)]"><TrendingUp className="h-4 w-4 stroke-[2.7]" /><span className={cn("absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-[#070c16]", connectionState === "ONLINE" ? "bg-emerald-400" : "bg-amber-400")} /></div><div><h1 className="text-sm font-bold tracking-tight">Crypto Opportunity</h1><p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[.21em] text-cyan-300">Research terminal</p></div></div><nav className="space-y-1">{navigation.map(item => { const Icon = item.icon; const active = activeNav === item.label; return <button key={item.label} onClick={() => handleNav(item)} className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs transition-colors", active ? "bg-cyan-300/[.08] text-cyan-100 shadow-[inset_2px_0_0_#22d3ee]" : "text-slate-400 hover:bg-white/[.035] hover:text-slate-200")}><Icon className={cn("h-4 w-4", active ? "text-cyan-300" : "text-slate-500")} /><span className="flex-1">{item.label}</span>{item.phase === "planned" && <span className="text-[8px] uppercase tracking-wide text-slate-600">Soon</span>}</button> })}</nav><div className="mt-auto rounded-xl border border-white/[.07] bg-white/[.025] p-3"><div className="flex items-center justify-between"><span className="text-[9px] font-semibold uppercase tracking-[.15em] text-slate-500">System status</span><span className={cn("flex items-center gap-1.5 text-[10px]", liveDataAvailable ? "text-emerald-300" : "text-amber-200")}><StatusDot status={liveDataAvailable ? "live" : "stale"} />{connectionState}</span></div><p className="mt-2 text-[11px] leading-4 text-slate-500">Live inputs are timestamped. Scores are explainable research signals, not trade instructions.</p></div></aside>
      <div className="min-w-0 flex-1"><main className="min-w-0"><header className="flex h-[70px] items-center justify-between border-b border-white/[.07] bg-[#080d17]/65 px-4 backdrop-blur-xl sm:px-6"><div className="flex items-center gap-3"><button className="rounded-md p-2 text-slate-400 hover:bg-white/[.05] lg:hidden"><PanelLeft className="h-4 w-4" /></button><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-slate-500">{activeNav} <span className="text-slate-700">/</span> Live scanner</p><div className="mt-1 flex items-center gap-2"><h2 className="text-base font-semibold tracking-tight text-slate-100">Opportunity intelligence</h2><span className="hidden items-center gap-1 text-[10px] text-slate-500 sm:flex"><Clock3 className="h-3 w-3" />{scan ? `Updated ${timeAgo(scan.generatedAt)}` : "Initializing sources"}</span><OnlineStatusLabel /></div></div></div><div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={refresh} disabled={isFetching || !online} className="h-8 border-white/[.09] bg-white/[.025] px-3 text-xs text-slate-300 hover:bg-white/[.07] hover:text-white"><RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", isFetching && "animate-spin")} />Refresh</Button><button onClick={() => toast.message("Search will be introduced with the extended scanner universe.")} className="hidden rounded-md border border-white/[.09] bg-white/[.025] p-2 text-slate-400 hover:bg-white/[.07] sm:block"><ScanSearch className="h-3.5 w-3.5" /></button></div></header>
        <div className="p-4 sm:p-6"><div className="mb-5 grid gap-4 xl:grid-cols-[1.45fr_.9fr]"><RegimeBanner scan={scan} /><div className="flex items-center justify-between rounded-xl border border-white/[.07] bg-white/[.025] px-4 py-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-slate-500">Data quality</p><p className="mt-1 text-xs text-slate-300">{scan?.dataStatus.filter(status => status.status === "live").length ?? 0} live provider feeds · {scan?.dataStatus.filter(status => status.status !== "live").length ?? 0} unavailable</p></div><ShieldCheck className="h-5 w-5 text-cyan-300" /></div></div>
          {error ? <div className="mb-5 rounded-xl border border-rose-300/20 bg-rose-300/[.05] p-4 text-sm text-rose-100"><div className="flex gap-2"><AlertTriangle className="h-4 w-4 shrink-0" /><div><p className="font-semibold">Live scanner unavailable</p><p className="mt-1 text-xs text-rose-100/70">{error.message}. No market or score values have been generated.</p></div></div></div> : null}
          <section className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-cyan-300/15 bg-cyan-300/[.03] p-4"><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-cyan-200">Opportunity Discovery</p><p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">Inspect validated Swing evidence as Qualified, Potential, Watch, No Trade, or Data Unavailable without changing Opportunity Score or creating an automatic trade.</p></div><Button size="sm" variant="outline" onClick={openDiscoveryWorkspace} className="border-cyan-300/20 bg-cyan-300/[.05] text-cyan-100"><Sparkles className="mr-1.5 h-3.5 w-3.5" />Open Discovery</Button></section>
          <section className="mb-5"><div className="mb-3 flex items-end justify-between"><div><span className="text-[10px] font-semibold uppercase tracking-[.18em] text-cyan-300">Live overview</span><h3 className="mt-1 text-lg font-semibold tracking-tight">Highest current research signals</h3></div><span className="hidden text-[11px] text-slate-500 md:block">Ranked from active configuration, timestamped market inputs</span></div><div className="grid gap-3 md:grid-cols-3">{isLoading ? [0, 1, 2].map(key => <Skeleton key={key} className="h-[146px] bg-white/[.04]" />) : topRows.length ? topRows.map((row, index) => <button key={row.asset.id} onClick={() => setSelectedId(row.asset.id)} className={cn("group rounded-xl border p-4 text-left transition-all hover:-translate-y-0.5", index === 0 ? "border-cyan-300/25 bg-cyan-300/[.055] shadow-[0_10px_40px_rgba(8,145,178,.09)]" : "border-white/[.07] bg-white/[.025] hover:border-white/[.14]")}><div className="flex items-start justify-between"><span className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-800 font-mono text-xs font-bold text-cyan-200">{row.asset.symbol.slice(0, 2)}</span><span><span className="block text-sm font-semibold">{row.asset.symbol}</span><span className="block text-[10px] uppercase tracking-[.15em] text-slate-500">Rank {String(index + 1).padStart(2, "0")}</span></span></span><span className={cn("font-mono text-3xl font-semibold", scoreClass(row.score?.score))}>{row.score?.score ?? "—"}</span></div><div className="mt-4 flex items-end justify-between"><div><span className="font-mono text-sm text-slate-200">{formatPrice(row.asset.price)}</span><span className={cn("mt-1 block text-[11px]", changeClass(row.asset.change24h))}>{formatPct(row.asset.change24h)} <span className="text-slate-600">24H</span></span></div><span className="rounded-md border border-white/[.07] bg-black/15 px-2 py-1 text-[10px] text-slate-400">{row.score?.setupType}</span></div></button>) : <div className="col-span-3 rounded-xl border border-white/[.07] bg-white/[.025]"><EmptyRow /></div>}</div></section>
          <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_290px]"><section id="market-scanner" className="scroll-mt-24 overflow-hidden rounded-xl border border-white/[.07] bg-[#090f1b]/70"><div className="flex flex-col gap-3 border-b border-white/[.07] p-4 xl:flex-row xl:items-center xl:justify-between"><div><span className="text-[10px] font-semibold uppercase tracking-[.17em] text-cyan-300">Scanner</span><h3 className="mt-0.5 text-base font-semibold">Ranked opportunity universe</h3></div><div className="flex flex-wrap items-center gap-2"><label className="flex h-8 items-center gap-2 rounded-md border border-white/[.08] bg-white/[.025] px-2.5 text-[11px] text-slate-400">Min score <select value={minScore} onChange={event => setMinScore(Number(event.target.value))} className="bg-transparent text-slate-200 outline-none"><option value={0}>All</option><option value={50}>50+</option><option value={65}>65+</option><option value={75}>75+</option></select><ChevronDown className="h-3 w-3" /></label><label className="flex h-8 items-center gap-2 rounded-md border border-white/[.08] bg-white/[.025] px-2.5 text-[11px] text-slate-400">Sector <select value={sector} onChange={event => setSector(event.target.value)} className="max-w-24 bg-transparent text-slate-200 outline-none"><option>All sectors</option>{sectors.slice(1).map(item => <option key={item}>{item}</option>)}</select><ChevronDown className="h-3 w-3" /></label><Button variant="ghost" size="sm" onClick={() => toast.message("All active scanner inputs are currently visible in the detail card.")} className="h-8 px-2.5 text-xs text-cyan-200 hover:bg-cyan-300/[.08] hover:text-cyan-100"><SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />Filters</Button></div></div><div className="scanner-head grid grid-cols-[36px_minmax(150px,1.4fr)_minmax(88px,.8fr)_minmax(86px,.7fr)_minmax(116px,.9fr)_minmax(106px,.8fr)_32px] gap-3 border-b border-white/[.055] px-5 py-2 text-[9px] font-semibold uppercase tracking-[.14em] text-slate-600"><span>#</span><span>Asset / sector</span><span>Price / 24h</span><span>Score</span><span>Setup</span><span>Confidence</span><span /></div>{isLoading ? <div className="space-y-0 p-5">{[0, 1, 2, 3, 4].map(key => <Skeleton key={key} className="mb-3 h-12 bg-white/[.035]" />)}</div> : filteredRows.length ? filteredRows.map((row, index) => <OpportunityRow key={row.asset.id} row={row} rank={index + 1} selected={selected?.asset.id === row.asset.id} onSelect={() => setSelectedId(row.asset.id)} />) : <EmptyRow />}<div className="flex items-center justify-between bg-white/[.015] px-5 py-3 text-[10px] text-slate-500"><span>{filteredRows.length} of {rows.length} tracked assets shown</span><span>CoinGecko + Binance public data</span></div></section>
            <section className="space-y-5"><div className="rounded-xl border border-white/[.07] bg-[#090f1b]/70 p-4"><div className="flex items-center justify-between"><div><span className="text-[10px] font-semibold uppercase tracking-[.17em] text-cyan-300">Rotation</span><h3 className="mt-0.5 text-sm font-semibold">Sector relative strength</h3></div><Layers3 className="h-4 w-4 text-slate-500" /></div><div className="mt-4 space-y-3">{sectorRotation.length ? sectorRotation.map((item, index) => <div key={item.name}><div className="mb-1.5 flex justify-between text-xs"><span className="text-slate-300">{item.name}</span><span className={scoreClass(item.score)}>{decimal.format(item.score)}</span></div><Progress value={item.score} className="h-1.5 bg-slate-800 [&>div]:bg-cyan-300" /></div>) : <p className="text-xs text-slate-500">Unavailable until live asset scores are calculated.</p>}</div></div><div className="rounded-xl border border-white/[.07] bg-[#090f1b]/70 p-4"><div className="flex items-center justify-between"><div><span className="text-[10px] font-semibold uppercase tracking-[.17em] text-cyan-300">Configuration</span><h3 className="mt-0.5 text-sm font-semibold">Scoring controls</h3></div><Settings2 className="h-4 w-4 text-slate-500" /></div><div className="mt-4 space-y-3 text-xs"><ControlRow label="Technical weight" value="40%" /><ControlRow label="Market momentum" value="20%" /><ControlRow label="Liquidity / risk" value="15%" /><ControlRow label="Enabled timeframes" value="4" /></div><button onClick={() => toast.message("Editable scoring settings are part of the next authenticated milestone.", { description: "The current default configuration is documented and persisted with every scan." })} className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/[.06] py-2 text-[11px] font-medium text-cyan-100 transition-colors hover:bg-cyan-300/[.1]"><Settings2 className="h-3.5 w-3.5" />View configuration</button></div><div className="rounded-xl border border-white/[.07] bg-white/[.018] p-4"><div className="flex gap-3"><BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" /><p className="text-[11px] leading-5 text-slate-500">The scanner reports inputs, data freshness, scoring components, and missing conditions. It does not claim a score predicts price movement.</p></div></div></section></div>
        </div>
      </main></div><DetailPanel row={selected} onClose={() => setSelectedId(null)} onPaperTrade={openPaperWorkspace} /><SettingsPanel open={settingsOpen} onOpenChange={setSettingsOpen} />{discoveryOpen ? <section className="fixed inset-0 z-[69] overflow-y-auto bg-[#060a12] text-slate-100"><div className="terminal-grid fixed inset-0 pointer-events-none opacity-35" /><div className="relative mx-auto min-h-screen max-w-[1800px] px-4 py-5 sm:px-6 lg:px-10"><OpportunityDiscoveryWorkspace onBack={() => { setDiscoveryOpen(false); setActiveNav("Dashboard"); if (typeof window !== "undefined") window.history.replaceState(null, "", window.location.pathname); }} onInspectAsset={assetId => { setSelectedId(assetId); setAssetIntelligenceOpen(true); }} onPaperTrade={assetId => openPaperWorkspace(rows.find(row => row.asset.id === assetId) ?? null, "SWING")} /></div></section> : null}{setupMode ? <section className="fixed inset-0 z-[69] overflow-y-auto bg-[#060a12] text-slate-100"><div className="terminal-grid fixed inset-0 pointer-events-none opacity-35" /><div className="relative mx-auto min-h-screen max-w-[1800px] px-4 py-5 sm:px-6 lg:px-10"><TradeSetupWorkspace mode={setupMode} onBack={() => { setSetupMode(null); setActiveNav("Dashboard"); }} onInspectAsset={assetId => { setSelectedId(assetId); setAssetIntelligenceOpen(true); }} onPaperTrade={(assetId, mode) => openPaperWorkspace(rows.find(row => row.asset.id === assetId) ?? null, mode)} /></div></section> : null}{paperOpen ? <section className="fixed inset-0 z-[70] overflow-y-auto bg-[#060a12] text-slate-100"><div className="terminal-grid fixed inset-0 pointer-events-none opacity-35" /><div className="relative mx-auto min-h-screen max-w-[1800px] px-4 py-5 sm:px-6 lg:px-10"><PaperTradingWorkspace asset={paperAsset} setupMode={paperSetupMode} onBack={closePaperWorkspace} /></div></section> : null}<BacktestingPanel open={backtestingOpen} onOpenChange={setBacktestingOpen} selectedAsset={selected} /><AlertsPanel open={alertsOpen} onOpenChange={setAlertsOpen} onInspectAsset={assetId => { setSelectedId(assetId); setAlertsOpen(false); setAssetIntelligenceOpen(true); }} /><ResearchSummaryPanel open={researchSummaryOpen} onOpenChange={setResearchSummaryOpen} /><OpportunityResearchLab open={researchLabOpen} onOpenChange={setResearchLabOpen} /><HistoricalDataFoundation open={historicalDataOpen} onOpenChange={setHistoricalDataOpen} /><ExecutionCostLab open={executionCostLabOpen} onOpenChange={setExecutionCostLabOpen} /><BackupRecoveryPanel open={backupRecoveryOpen} onOpenChange={setBackupRecoveryOpen} />
    </div>
  </div>;
}

function ControlRow({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between border-b border-white/[.055] pb-2.5 last:border-0 last:pb-0"><span className="text-slate-500">{label}</span><span className="font-mono text-slate-200">{value}</span></div>; }

function MobileNavigation({ activeNav, onDashboard, onPaper, onAlerts, onResearch }: { activeNav: string; onDashboard: () => void; onPaper: () => void; onAlerts: () => void; onResearch: () => void }) {
  const items = [
    { label: "Home", active: activeNav === "Dashboard", icon: Gauge, onClick: onDashboard },
    { label: "Scanner", active: activeNav === "Market Scanner", icon: ScanSearch, onClick: onDashboard },
    { label: "Paper", active: activeNav === "Paper Trading", icon: WalletCards, onClick: onPaper },
    { label: "Alerts", active: activeNav === "Alerts", icon: BellRing, onClick: onAlerts },
    { label: "Research", active: activeNav === "Research Lab", icon: FlaskConical, onClick: onResearch },
  ];
  return <nav aria-label="Mobile workspace navigation" className="pwa-mobile-nav fixed inset-x-0 bottom-0 z-[60] flex border-t border-white/[.08] bg-[#080d17]/95 px-1 pt-1 backdrop-blur-xl lg:hidden">{items.map(item => { const Icon = item.icon; return <button key={item.label} onClick={item.onClick} aria-current={item.active ? "page" : undefined} className={cn("flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-1 py-2 text-[10px] font-medium", item.active ? "text-cyan-200" : "text-slate-500")}><Icon className="h-4 w-4" /><span className="truncate">{item.label}</span></button>; })}</nav>;
}
