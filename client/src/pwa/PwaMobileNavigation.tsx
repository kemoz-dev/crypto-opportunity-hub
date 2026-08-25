import { BellRing, FlaskConical, Gauge, Menu, ScanSearch, Target, TrendingUp, WalletCards } from "lucide-react";
import { useState } from "react";

type PwaNavTarget = "dashboard" | "scanner" | "discovery" | "scalping" | "swing" | "paper" | "alerts" | "research";

function navigate(target: PwaNavTarget) {
  window.dispatchEvent(new CustomEvent<PwaNavTarget>("crypto-hub:navigate", { detail: target }));
}

export function PwaMobileNavigation() {
  const [moreOpen, setMoreOpen] = useState(false);
  const primaryItems = [
    { label: "Home", target: "dashboard" as const, icon: Gauge },
    { label: "Scanner", target: "scanner" as const, icon: ScanSearch },
    { label: "Scalp", target: "scalping" as const, icon: Target },
    { label: "Swing", target: "swing" as const, icon: TrendingUp },
    { label: "Paper", target: "paper" as const, icon: WalletCards },
  ];
  const moreItems = [
    { label: "Discovery", target: "discovery" as const, icon: ScanSearch },
    { label: "Alerts", target: "alerts" as const, icon: BellRing },
    { label: "Research", target: "research" as const, icon: FlaskConical },
  ];
  const choose = (target: PwaNavTarget) => { setMoreOpen(false); navigate(target); };
  return <nav aria-label="Mobile workspace navigation" className="pwa-mobile-nav fixed inset-x-0 bottom-0 z-[80] flex border-t border-white/[.08] bg-[#080d17]/95 px-1 pt-1 backdrop-blur-xl lg:hidden">{moreOpen ? <div id="pwa-mobile-more" className="pwa-mobile-more absolute inset-x-2 bottom-full mb-2 rounded-xl border border-white/[.1] bg-[#0b1321]/98 p-2 shadow-2xl"><p className="px-2 py-1 text-[9px] font-semibold uppercase tracking-[.16em] text-slate-500">More workspaces</p>{moreItems.map(item => { const Icon = item.icon; return <button key={item.target} onClick={() => choose(item.target)} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-xs text-slate-200 hover:bg-white/[.06]"><Icon className="h-4 w-4 text-cyan-200" />{item.label}</button>; })}</div> : null}{primaryItems.map(item => { const Icon = item.icon; return <button key={item.target} onClick={() => choose(item.target)} className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-1 py-2 text-[10px] font-medium text-slate-400 hover:bg-white/[.05] hover:text-cyan-100"><Icon className="h-4 w-4" /><span className="truncate">{item.label}</span></button>; })}<button aria-expanded={moreOpen} aria-controls="pwa-mobile-more" onClick={() => setMoreOpen(value => !value)} className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-1 py-2 text-[10px] font-medium text-slate-400 hover:bg-white/[.05] hover:text-cyan-100"><Menu className="h-4 w-4" /><span className="truncate">More</span></button></nav>;
}
