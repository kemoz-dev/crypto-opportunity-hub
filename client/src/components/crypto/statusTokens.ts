export type OpportunityStatus = "QUALIFIED" | "POTENTIAL" | "WATCH" | "NO TRADE" | "DATA UNAVAILABLE";
export type HealthStatus = "HEALTHY" | "CAUTION" | "REVERSAL RISK" | "INVALIDATED" | "DATA UNAVAILABLE" | "HEALTH UNKNOWN";

export const statusLabel = (value: string | null | undefined) => value ?? "DATA UNAVAILABLE";

export const statusTone = (value: string | null | undefined) => {
  switch (value) {
    case "QUALIFIED":
    case "HEALTHY":
      return "border-emerald-300/25 bg-emerald-300/[.08] text-emerald-100";
    case "POTENTIAL":
    case "CAUTION":
      return "border-amber-300/25 bg-amber-300/[.08] text-amber-100";
    case "WATCH":
      return "border-orange-300/25 bg-orange-300/[.07] text-orange-100";
    case "NO TRADE":
    case "INVALIDATED":
    case "REVERSAL RISK":
      return "border-rose-300/25 bg-rose-300/[.07] text-rose-100";
    default:
      return "border-slate-400/20 bg-slate-400/[.07] text-slate-200";
  }
};

export const directionTone = (value: string | null | undefined) => value === "LONG" || value === "BULLISH"
  ? "text-emerald-200 border-emerald-300/25 bg-emerald-300/[.07]"
  : value === "SHORT" || value === "BEARISH"
    ? "text-rose-200 border-rose-300/25 bg-rose-300/[.07]"
    : "text-slate-300 border-slate-500/25 bg-slate-500/[.07]";
