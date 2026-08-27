import { ArrowRight, RefreshCw, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { cn } from "@/lib/utils";
import { usePwaStatus } from "@/pwa/PwaStatus";

const money = (value: number | null | undefined) => value == null ? "Unavailable" : `${value >= 0 ? "+" : ""}${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)}`;
const count = (value: number | null | undefined) => value == null ? "Unavailable" : String(value);

export function PaperTradingSummaryCard({ onOpen }: { onOpen: () => void }) {
  const { isAuthenticated } = useAuth();
  const { online } = usePwaStatus();
  const query = trpc.crypto.paperTradingSummary.useQuery(undefined, { enabled: online && isAuthenticated, refetchOnWindowFocus: false, staleTime: 30_000, retry: 1 });
  if (!isAuthenticated) return <section className="rounded-2xl border border-white/[.08] bg-[#0a111e]/90 p-4 sm:p-5"><div className="flex items-start gap-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-cyan-300/[.1] text-cyan-200"><WalletCards className="h-4 w-4" /></div><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-cyan-300">Paper Trading</p><h3 className="mt-1 text-lg font-semibold">Sign in to view your simulated portfolio.</h3><Button onClick={() => window.location.href = "/api/oauth/login"} className="mt-4 min-h-11 bg-cyan-300 text-slate-950 hover:bg-cyan-200">Sign in</Button></div></div></section>;
  const metrics = query.data?.metrics;
  const pnl = metrics?.totalPnl;
  return <section aria-labelledby="paper-summary-title" className="rounded-2xl border border-white/[.08] bg-[#0a111e]/90 p-4 shadow-[0_14px_50px_rgba(2,8,23,.14)] sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-cyan-300">Paper Trading</p><h3 id="paper-summary-title" className="mt-1 text-lg font-semibold">Simulated portfolio snapshot</h3><p className="mt-1 text-xs text-slate-500">Read-only server-authoritative summary. No trade or portfolio mutation occurs here.</p></div><Button onClick={onOpen} variant="outline" className="min-h-11 border-cyan-300/20 text-cyan-100">Open Paper Trading<ArrowRight className="ml-2 h-4 w-4" /></Button></div>{query.isLoading ? <div className="mt-5 h-20 animate-pulse rounded-xl bg-white/[.04]" /> : query.error ? <div className="mt-5 rounded-xl border border-rose-300/20 bg-rose-300/[.04] p-4"><p className="font-semibold text-rose-100">Paper Trading unavailable</p><p className="mt-1 text-xs text-rose-100/70">Unable to load your simulated portfolio.</p><Button variant="outline" onClick={() => query.refetch()} className="mt-3 min-h-11 border-rose-300/20"><RefreshCw className="mr-2 h-4 w-4" />Retry</Button></div> : !metrics ? <div className="mt-5 rounded-xl border border-dashed border-white/[.12] p-5"><p className="font-semibold text-slate-100">No simulated positions yet.</p><p className="mt-1 text-xs leading-5 text-slate-500">Your Paper Trading activity will appear here once you create an eligible simulated trade.</p></div> : <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-5"><Metric label="Portfolio value" value={metrics.currentEquity == null ? "Unavailable" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(metrics.currentEquity)} /><Metric label="Total P&L" value={money(pnl)} tone={pnl == null ? "neutral" : pnl > 0 ? "positive" : pnl < 0 ? "negative" : "neutral"} /><Metric label="Open positions" value={count(metrics.openPositions)} /><Metric label="Win rate" value={metrics.winRate == null ? "Unavailable" : `${metrics.winRate}%`} /><Metric label="Completed trades" value={count(metrics.closedPositions)} /></div>}</section>;
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "positive" | "negative" | "neutral" }) {
  return <div className="rounded-xl border border-white/[.06] bg-white/[.025] p-3"><p className="text-[9px] font-semibold uppercase tracking-[.13em] text-slate-500">{label}</p><p className={cn("mt-1 truncate font-mono text-base", tone === "positive" ? "text-emerald-200" : tone === "negative" ? "text-rose-200" : "text-slate-100")}>{value}</p></div>;
}
