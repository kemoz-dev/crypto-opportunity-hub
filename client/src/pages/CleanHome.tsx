import { useMemo } from "react";
import { useLocation } from "wouter";
import { Activity, ChevronRight, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { usePwaStatus } from "@/pwa/PwaStatus";
import type { ScannerResponse } from "@shared/crypto";

const money = (value: number | null | undefined) => value == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: value >= 100 ? 2 : value >= 1 ? 3 : 5 }).format(value);
const pct = (value: number | null | undefined) => value == null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
const ago = (value: number | null | undefined) => { if (!value) return "—"; const m = Math.max(0, Math.round((Date.now() - value) / 60000)); return m < 1 ? "just now" : m < 60 ? `${m}m ago` : `${Math.round(m / 60)}h ago`; };
const scoreTone = (value: number | null | undefined) => value == null ? "text-slate-500" : value >= 75 ? "text-emerald-300" : value >= 60 ? "text-cyan-300" : value >= 45 ? "text-amber-300" : "text-slate-300";
const statusTone = (value: string) => value === "QUALIFIED" ? "text-emerald-300 bg-emerald-300/[.07] border-emerald-300/20" : value === "POTENTIAL" ? "text-amber-300 bg-amber-300/[.07] border-amber-300/20" : value === "WATCH" ? "text-cyan-300 bg-cyan-300/[.07] border-cyan-300/20" : "text-slate-400 bg-white/[.03] border-white/[.08]";

type DiscoveryItem = any;
type DiscoveryResponse = { generatedAt?: number; marketRegime?: { classification?: string | null; score?: number | null } | null; discovery?: { items?: DiscoveryItem[] } };

export default function CleanHome() {
  const [, setLocation] = useLocation();
  const { online } = usePwaStatus();
  const scanner = trpc.crypto.scanner.useQuery({ forceRefresh: false }, { enabled: online, staleTime: 45_000, refetchOnWindowFocus: false, retry: 1 });
  const swing = trpc.crypto.tradeSetups.useQuery({ mode: "SWING" }, { enabled: online, staleTime: 45_000, refetchOnWindowFocus: false, retry: 1 });
  const scalp = trpc.crypto.tradeSetups.useQuery({ mode: "SCALP" }, { enabled: online, staleTime: 45_000, refetchOnWindowFocus: false, retry: 1 });

  const scan = scanner.data as ScannerResponse | undefined;
  const rows = scan?.rows ?? [];
  const scoreByAsset = useMemo(() => new Map(rows.map(row => [row.asset.id, row.score])), [rows]);
  const opportunities = useMemo(() => {
    const all = [swing.data as DiscoveryResponse | undefined, scalp.data as DiscoveryResponse | undefined].flatMap(response => response?.discovery?.items ?? []);
    const unique = new Map<string, DiscoveryItem>();
    for (const item of all) {
      if (!["QUALIFIED", "POTENTIAL", "WATCH"].includes(item.status)) continue;
      // One canonical card per asset. Prefer the stronger lifecycle state, then score.
      const current = unique.get(item.assetId);
      if (!current || lifecycleRank(item.status) > lifecycleRank(current.status) || (lifecycleRank(item.status) === lifecycleRank(current.status) && (item.opportunityScore ?? -1) > (current.opportunityScore ?? -1))) unique.set(item.assetId, item);
    }
    return Array.from(unique.values()).sort((a, b) => (b.opportunityScore ?? -1) - (a.opportunityScore ?? -1)).slice(0, 8);
  }, [swing.data, scalp.data]);
  const regime = scan?.marketRegime;
  const btc = rows.find(row => row.asset.symbol === "BTC");
  const totalLive = scan?.dataStatus.filter(item => item.status === "live").length ?? 0;
  const refresh = () => void scanner.refetch().then(() => { void swing.refetch(); void scalp.refetch(); });

  return <main className="min-h-screen bg-[#060a12] px-4 pb-24 text-slate-100 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-[1500px]">
      <header className="flex items-center justify-between py-5">
        <div><p className="text-[10px] font-semibold uppercase tracking-[.22em] text-cyan-300">Crypto Opportunity Hub</p><h1 className="mt-1 text-xl font-semibold tracking-tight">Market & Opportunities</h1></div>
        <button onClick={refresh} disabled={!online || scanner.isFetching} className="grid h-10 w-10 place-items-center rounded-xl border border-white/[.08] bg-white/[.025] text-slate-400 hover:text-slate-100 disabled:opacity-40" aria-label="Refresh"><RefreshCw className={`h-4 w-4 ${scanner.isFetching ? "animate-spin" : ""}`} /></button>
      </header>

      <section className={`rounded-2xl border p-4 sm:p-5 ${regime?.classification === "RISK OFF" ? "border-rose-300/20 bg-rose-300/[.045]" : regime?.classification === "RISK ON" ? "border-emerald-300/20 bg-emerald-300/[.045]" : "border-white/[.08] bg-white/[.025]"}`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-white/[.05]"><Activity className="h-5 w-5 text-cyan-300" /></div><div><p className="text-[9px] font-semibold uppercase tracking-[.18em] text-slate-500">Market regime</p><p className="mt-0.5 text-lg font-semibold">{regime?.classification ?? "UNAVAILABLE"}</p></div></div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4"><MarketMetric label="BTC" value={btc?.asset.price == null ? "—" : money(btc.asset.price)} sub={pct(btc?.asset.change24h)} /><MarketMetric label="BTC.D" value={regime?.btcDominance == null ? "—" : `${regime.btcDominance.toFixed(2)}%`} sub="dominance" /><MarketMetric label="Breadth" value={regime?.breadth == null ? "—" : `${regime.breadth.toFixed(0)}%`} sub="market" /><MarketMetric label="Data" value={totalLive ? `${totalLive} live` : "—"} sub={scan ? ago(scan.generatedAt) : "waiting"} /></div>
        </div>
      </section>

      <div className="mt-8 flex items-end justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-cyan-300">Opportunities</p><h2 className="mt-1 text-lg font-semibold">What matters now</h2></div><span className="text-[10px] text-slate-600">One card per asset</span></div>
      <section className="mt-3 grid gap-3 lg:grid-cols-2">
        {opportunities.length ? opportunities.map((item, index) => <Opportunity key={item.assetId} item={item} scannerScore={scoreByAsset.get(item.assetId)} rank={index + 1} onOpen={() => setLocation(`/asset/${encodeURIComponent(item.assetId)}`)} />) : <Empty loading={swing.isLoading || scalp.isLoading} />}
      </section>

      <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/[.06] pt-4 text-[10px] text-slate-600"><span>Scores remain the core research signals. Full evidence is available inside each asset.</span><span>{scan ? `Scanner ${ago(scan.generatedAt)}` : "Scanner unavailable"}</span></footer>
    </div>
  </main>;
}

function lifecycleRank(status: string) { return status === "QUALIFIED" ? 3 : status === "POTENTIAL" ? 2 : status === "WATCH" ? 1 : 0; }
function MarketMetric({ label, value, sub }: { label: string; value: string; sub: string }) { return <div><p className="text-[8px] font-semibold uppercase tracking-[.14em] text-slate-600">{label}</p><p className="font-mono text-sm text-slate-200">{value}</p><p className="text-[9px] text-slate-600">{sub}</p></div>; }

function Opportunity({ item, scannerScore, rank, onOpen }: { item: DiscoveryItem; scannerScore: any; rank: number; onOpen: () => void }) {
  const plan = item.readinessPlan ?? item.sourcePlan ?? {};
  const entry = plan.entryZone;
  const stop = plan.invalidation ?? plan.stop;
  const targets = plan.targets ?? [];
  const technical = item.opportunityScore?.technicalScore ?? scannerScore?.technicalScore ?? null;
  const current = item.readinessPlan?.currentPrice ?? item.currentPrice ?? null;
  return <button onClick={onOpen} className="group w-full rounded-2xl border border-white/[.07] bg-[#09111b]/90 p-4 text-left transition-all hover:border-cyan-300/20 hover:bg-[#0b1422] sm:p-5">
    <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="font-mono text-[10px] text-slate-600">{String(rank).padStart(2, "0")}</span><div><div className="flex items-center gap-2"><h3 className="text-base font-semibold">{item.symbol}</h3><span className={`rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-[.08em] ${statusTone(item.status)}`}>{item.status}</span></div><p className="mt-1 text-[10px] uppercase tracking-[.12em] text-slate-600">{item.strategy ?? "SWING"} · {String(item.timeframes?.execution ?? "—").toUpperCase()} · {item.direction}</p></div></div><ChevronRight className="h-4 w-4 text-slate-600 transition-transform group-hover:translate-x-1" /></div>
    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5"><Value label="Price" value={money(current)} /><Value label="Entry" value={entry?.low != null && entry?.high != null ? `${money(entry.low)} – ${money(entry.high)}` : "—"} /><Value label="Target" value={targets[0]?.price != null ? money(targets[0].price) : "—"} /><Value label="Stop" value={stop?.price != null ? money(stop.price) : "—"} /><Value label="R:R" value={plan.rewardRisk != null ? `${Number(plan.rewardRisk).toFixed(2)}×` : "—"} /></div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[.05] pt-3"><div className="flex items-center gap-4"><Score label="Score" value={item.opportunityScore?.score ?? (typeof item.opportunityScore === "number" ? item.opportunityScore : scannerScore?.score) ?? null} /><Score label="Technical" value={technical} /></div><div className="text-right text-[9px] text-slate-600">{item.dataTimestamp ? `Data ${new Date(item.dataTimestamp).toLocaleString()}` : "Data time unavailable"}</div></div>
  </button>;
}

function Value({ label, value }: { label: string; value: string }) { return <div className="min-w-0"><p className="text-[8px] font-semibold uppercase tracking-[.14em] text-slate-600">{label}</p><p className="mt-1 truncate font-mono text-xs text-slate-200">{value}</p></div>; }
function Score({ label, value }: { label: string; value: number | null | undefined }) { return <div><p className="text-[8px] font-semibold uppercase tracking-[.14em] text-slate-600">{label}</p><p className={`font-mono text-lg font-semibold ${scoreTone(value)}`}>{value ?? "—"}<span className="ml-0.5 text-[9px] text-slate-600">/100</span></p></div>; }
function Empty({ loading }: { loading: boolean }) { return <div className="lg:col-span-2 rounded-2xl border border-white/[.07] bg-white/[.02] p-10 text-center text-sm text-slate-500">{loading ? "Scanning validated market data…" : "No current Potential or Qualified opportunity."}</div>; }
