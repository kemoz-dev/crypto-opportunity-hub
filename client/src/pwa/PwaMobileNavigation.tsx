import { BellRing, FlaskConical, Gauge, ScanSearch, WalletCards } from "lucide-react";

type PwaNavTarget = "dashboard" | "scanner" | "paper" | "alerts" | "research";

function navigate(target: PwaNavTarget) {
  window.dispatchEvent(new CustomEvent<PwaNavTarget>("crypto-hub:navigate", { detail: target }));
}

export function PwaMobileNavigation() {
  const items = [
    { label: "Home", target: "dashboard" as const, icon: Gauge },
    { label: "Scanner", target: "scanner" as const, icon: ScanSearch },
    { label: "Paper", target: "paper" as const, icon: WalletCards },
    { label: "Alerts", target: "alerts" as const, icon: BellRing },
    { label: "Research", target: "research" as const, icon: FlaskConical },
  ];
  return <nav aria-label="Mobile workspace navigation" className="pwa-mobile-nav fixed inset-x-0 bottom-0 z-[80] flex border-t border-white/[.08] bg-[#080d17]/95 px-1 pt-1 backdrop-blur-xl lg:hidden">{items.map(item => { const Icon = item.icon; return <button key={item.target} onClick={() => navigate(item.target)} className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-1 py-2 text-[10px] font-medium text-slate-400 hover:bg-white/[.05] hover:text-cyan-100"><Icon className="h-4 w-4" /><span className="truncate">{item.label}</span></button>; })}</nav>;
}
