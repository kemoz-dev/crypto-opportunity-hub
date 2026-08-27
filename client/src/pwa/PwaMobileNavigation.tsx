import { useEffect, useState } from "react";
import { Activity, BarChart3, BellRing, BookOpen, FlaskConical, Gauge, Layers3, Menu, Moon, ScanSearch, Settings2, Sparkles, Sun, Target, TrendingUp, WalletCards, X } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

type PwaNavTarget = "dashboard" | "scanner" | "discovery" | "opportunity-feed" | "decision-center" | "asset-intelligence" | "setup-monitor" | "watchlist" | "scalping" | "swing" | "paper" | "auto-paper" | "alerts" | "research" | "trading-intelligence" | "settings";

function navigate(target: PwaNavTarget) {
  window.dispatchEvent(new CustomEvent<PwaNavTarget>("crypto-hub:navigate", { detail: target }));
}

export function PwaMobileNavigation() {
  const [moreOpen, setMoreOpen] = useState(false);
  const { theme, themeMode, setTheme } = useTheme();
  const primaryItems = [
    { label: "Home", target: "dashboard" as const, icon: Gauge },
    { label: "Opportunities", target: "opportunity-feed" as const, icon: Sparkles },
    { label: "Watchlist", target: "watchlist" as const, icon: BookOpen },
    { label: "Auto Paper", target: "auto-paper" as const, icon: FlaskConical },
  ];
  const moreItems = [
    { label: "Decision Center", target: "decision-center" as const, icon: Sparkles },
    { label: "Asset Intelligence", target: "asset-intelligence" as const, icon: Activity },
    { label: "Markets", target: "scanner" as const, icon: ScanSearch },
    { label: "Monitor", target: "setup-monitor" as const, icon: Activity },
    { label: "Paper", target: "paper" as const, icon: WalletCards },
    { label: "Scalp", target: "scalping" as const, icon: Target },
    { label: "Swing", target: "swing" as const, icon: TrendingUp },
    { label: "Auto Paper Lab", target: "auto-paper" as const, icon: FlaskConical },
    { label: "Trading Intelligence", target: "trading-intelligence" as const, icon: BarChart3 },
    { label: "Intelligence", target: "trading-intelligence" as const, icon: BarChart3 },
    { label: "Research", target: "research" as const, icon: Layers3 },
    { label: "Settings", target: "settings" as const, icon: Settings2 },
  ];

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const choose = (target: PwaNavTarget) => {
    setMoreOpen(false);
    navigate(target);
  };

  return (
    <nav aria-label="Mobile workspace navigation" className="pwa-mobile-nav fixed inset-x-0 bottom-0 z-[80] flex overflow-x-auto border-t border-white/[.08] bg-[#080d17]/95 px-1 pt-1 backdrop-blur-xl lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {moreOpen ? (
        <div id="pwa-mobile-more" role="dialog" aria-label="More workspaces" className="pwa-mobile-more absolute inset-x-2 bottom-full mb-2 rounded-xl border border-white/[.1] bg-[#0b1321]/98 p-2 shadow-2xl">
          <div className="flex items-center justify-between px-2 py-1">
            <p className="text-[9px] font-semibold uppercase tracking-[.16em] text-slate-500">More workspaces</p>
            <button type="button" aria-label="Close more workspaces" onClick={() => setMoreOpen(false)} className="rounded p-1 text-slate-400 hover:bg-white/[.06] hover:text-slate-100"><X className="h-3.5 w-3.5" /></button>
          </div>
          {moreItems.map(item => {
            const Icon = item.icon;
            return <button type="button" key={item.target} onClick={() => choose(item.target)} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-xs text-slate-200 hover:bg-white/[.06]"><Icon className="h-4 w-4 text-cyan-200" />{item.label}</button>;
          })}
          <div className="mt-1 border-t border-white/[.07] pt-2"><p className="px-3 pb-1 text-[9px] font-semibold uppercase tracking-[.14em] text-slate-500">Theme · {theme.toUpperCase()}</p><div className="grid grid-cols-3 gap-1"><button type="button" onClick={() => { setTheme("light"); setMoreOpen(false); }} className={themeMode === "light" ? "rounded-md bg-cyan-300 px-2 py-2 text-[10px] font-semibold text-slate-950" : "rounded-md px-2 py-2 text-[10px] text-slate-400 hover:bg-white/[.06]"}><Sun className="mx-auto mb-1 h-3.5 w-3.5" />Light</button><button type="button" onClick={() => { setTheme("dark"); setMoreOpen(false); }} className={themeMode === "dark" ? "rounded-md bg-cyan-300 px-2 py-2 text-[10px] font-semibold text-slate-950" : "rounded-md px-2 py-2 text-[10px] text-slate-400 hover:bg-white/[.06]"}><Moon className="mx-auto mb-1 h-3.5 w-3.5" />Dark</button><button type="button" onClick={() => { setTheme("system"); setMoreOpen(false); }} className={themeMode === "system" ? "rounded-md bg-cyan-300 px-2 py-2 text-[10px] font-semibold text-slate-950" : "rounded-md px-2 py-2 text-[10px] text-slate-400 hover:bg-white/[.06]"}>System</button></div></div>
        </div>
      ) : null}
      {primaryItems.map(item => {
        const Icon = item.icon;
        return <button type="button" key={item.target} onClick={() => choose(item.target)} className="flex min-h-14 w-[78px] shrink-0 flex-none flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-[10px] font-medium text-slate-400 hover:bg-white/[.05] hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"><Icon className="h-4 w-4" /><span className="whitespace-nowrap text-[9px]">{item.label}</span></button>;
      })}
      <button type="button" aria-expanded={moreOpen} aria-controls="pwa-mobile-more" onClick={() => setMoreOpen(value => !value)} className="flex min-h-14 w-[72px] shrink-0 flex-none flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-[10px] font-medium text-slate-400 hover:bg-white/[.05] hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70">
        {moreOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        <span className="whitespace-nowrap">More</span>
      </button>
    </nav>
  );
}
