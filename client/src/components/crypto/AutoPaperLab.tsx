import { useEffect, useMemo, useState } from "react";
import { Activity, FlaskConical, LockKeyhole, RefreshCw, ShieldCheck, ToggleRight } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

const modes = [
  { key: "CONSERVATIVE" as const, label: "Conservative", note: "Higher quality and reward/risk gates." },
  { key: "BALANCED" as const, label: "Balanced", note: "Default balanced confirmation policy." },
  { key: "OPPORTUNITY" as const, label: "Aggressive", note: "Broader opportunity mode; gates remain server-side." },
  { key: "CUSTOM" as const, label: "Discovery", note: "Explore potential setups without weakening data validity." },
];

function statusTone(status: string) {
  if (status.includes("TARGET")) return "border-emerald-300/20 bg-emerald-300/[.07] text-emerald-200";
  if (status === "INVALIDATED" || status === "DATA_UNAVAILABLE") return "border-rose-300/20 bg-rose-300/[.07] text-rose-200";
  if (status === "WARNING" || status === "REVERSAL_RISK") return "border-amber-300/20 bg-amber-300/[.07] text-amber-200";
  return "border-cyan-300/20 bg-cyan-300/[.07] text-cyan-200";
}

export function AutoPaperLab({ onBack }: { onBack: () => void }) {
  const utils = trpc.useUtils();
  const settingsQuery = trpc.crypto.autoPaperSettings.useQuery(undefined, { staleTime: 20_000 });
  const performanceQuery = trpc.crypto.autoPaperPerformance.useQuery(undefined, { staleTime: 20_000 });
  const historyQuery = trpc.crypto.autoPaperHistory.useQuery(undefined, { staleTime: 20_000 });
  const saveSettings = trpc.crypto.saveAutoPaperSettings.useMutation({
    onSuccess: () => { void utils.crypto.autoPaperSettings.invalidate(); toast.success("Auto Paper settings saved."); },
    onError: error => toast.error(error.message),
  });
  const refresh = trpc.crypto.refreshAutoPaperActive.useMutation({
    onSuccess: result => { void utils.crypto.autoPaperHistory.invalidate(); void utils.crypto.autoPaperPerformance.invalidate(); toast.message(`Refreshed ${result.length} active simulation${result.length === 1 ? "" : "s"}.`); },
    onError: error => toast.error(error.message),
  });
  const settings = settingsQuery.data;
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<"CONSERVATIVE" | "BALANCED" | "OPPORTUNITY" | "CUSTOM">("BALANCED");
  useEffect(() => { if (settings) { setEnabled(settings.enabled); setMode(settings.mode); } }, [settings]);
  const modeNote = useMemo(() => modes.find(item => item.key === mode)?.note ?? "", [mode]);

  const save = (next: Partial<{ enabled: boolean; mode: typeof mode }>) => {
    if (!settings) return;
    const nextSettings = { ...settings, ...next };
    setEnabled(nextSettings.enabled);
    setMode(nextSettings.mode);
    saveSettings.mutate(nextSettings);
  };

  return <section className="min-h-screen rounded-2xl border border-white/[.08] bg-[#080e19]/95 p-4 shadow-2xl sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[.07] pb-5">
      <div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-cyan-300">Auto Paper Lab</p><h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-100">Adaptive simulation trials</h1><p className="mt-2 max-w-2xl text-xs leading-5 text-slate-400">Server-authoritative paper simulations only. Auto Paper never connects to a broker, exchange, or real-money account, and it remains OFF until you explicitly enable it.</p></div>
      <Button variant="outline" onClick={onBack} className="border-white/[.1] bg-white/[.025] text-slate-200">Back to dashboard</Button>
    </div>
    <div className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
      <div className="rounded-xl border border-cyan-300/15 bg-cyan-300/[.03] p-4">
        <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><ToggleRight className="h-4 w-4 text-cyan-300" /><div><p className="text-xs font-semibold text-slate-100">AUTO PAPER TRIAL</p><p className="text-[11px] text-slate-500">Default OFF · authenticated · owner-scoped</p></div></div><Switch checked={enabled} disabled={!settings || saveSettings.isPending} onCheckedChange={value => save({ enabled: value })} aria-label="Enable Auto Paper simulation" /></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">{modes.map(item => <button type="button" key={item.key} onClick={() => save({ mode: item.key })} className={`rounded-lg border p-3 text-left transition-colors ${mode === item.key ? "border-cyan-300/40 bg-cyan-300/[.09]" : "border-white/[.07] bg-white/[.02] hover:bg-white/[.05]"}`}><p className="text-xs font-semibold text-slate-100">{item.label}</p><p className="mt-1 text-[11px] leading-4 text-slate-500">{item.note}</p></button>)}</div>
        <p className="mt-3 text-[11px] text-cyan-100/70">Selected mode: <strong>{modes.find(item => item.key === mode)?.label}</strong> · {modeNote}</p>
      </div>
      <div className="rounded-xl border border-emerald-300/15 bg-emerald-300/[.03] p-4"><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-300" /><p className="text-xs font-semibold text-emerald-100">Safety boundary</p></div><ul className="mt-3 space-y-2 text-[11px] leading-4 text-slate-400"><li className="flex gap-2"><LockKeyhole className="h-3.5 w-3.5 shrink-0 text-emerald-300" />No real trading or exchange orders.</li><li className="flex gap-2"><LockKeyhole className="h-3.5 w-3.5 shrink-0 text-emerald-300" />No frontend-supplied prices, stops, targets, or scores.</li><li className="flex gap-2"><LockKeyhole className="h-3.5 w-3.5 shrink-0 text-emerald-300" />Manual Paper and Auto Paper remain separate by source.</li></ul></div>
    </div>
    <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">{[
      ["Trials", performanceQuery.data?.totalTrials ?? "—"], ["Open", performanceQuery.data?.open ?? "—"], ["Wins", performanceQuery.data?.wins ?? "—"], ["Losses", performanceQuery.data?.losses ?? "—"], ["Target 1", performanceQuery.data?.t1Hit ?? "—"], ["Target 2", performanceQuery.data?.t2Hit ?? "—"], ["Win rate", performanceQuery.data?.winRate == null ? "—" : `${performanceQuery.data.winRate.toFixed(1)}%`], ["Avg R", performanceQuery.data?.averageR == null ? "—" : performanceQuery.data.averageR.toFixed(2)],
    ].map(([label, value]) => <div key={label} className="rounded-lg border border-white/[.07] bg-white/[.025] p-3"><p className="text-[9px] font-semibold uppercase tracking-[.13em] text-slate-500">{label}</p><p className="mt-1 font-mono text-lg text-slate-100">{value}</p></div>)}</div>
    <div className="mt-5 rounded-xl border border-white/[.07] bg-white/[.018] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-cyan-300">Active trials</p><p className="mt-1 text-xs text-slate-500">Refresh is online-only and revalidates current provider evidence server-side.</p></div><Button size="sm" variant="outline" disabled={!enabled || refresh.isPending} onClick={() => refresh.mutate()} className="border-white/[.1] bg-white/[.025] text-slate-200"><RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refresh.isPending ? "animate-spin" : ""}`} />Refresh active</Button></div><div className="mt-4 space-y-2">{(historyQuery.data ?? []).slice(0, 8).map(trial => <div key={trial.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/[.06] bg-white/[.02] px-3 py-3"><div className="flex min-w-0 items-center gap-3"><Activity className="h-4 w-4 shrink-0 text-cyan-300" /><div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-200">{trial.assetId} · {trial.strategy} · {trial.timeframe}</p><p className="mt-1 text-[11px] text-slate-500">Entry {trial.entryPrice} · Stop {trial.stopPrice} · R:R {trial.rewardRisk}</p></div></div><Badge variant="outline" className={statusTone(trial.status)}>{trial.status.replaceAll("_", " ")}</Badge></div>)}{!historyQuery.isLoading && !(historyQuery.data?.length) ? <div className="grid place-items-center py-8 text-center"><FlaskConical className="h-6 w-6 text-slate-600" /><p className="mt-2 text-xs text-slate-500">No Auto Paper trials yet. Enable the lab only when you want server-side simulation.</p></div> : null}</div></div>
  </section>;
}
