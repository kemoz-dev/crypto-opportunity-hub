import { cn } from "@/lib/utils";
import type { TechnicalChartPoint } from "../../../../server/crypto/technical";

type Props = { points: TechnicalChartPoint[]; className?: string };

const format = (value: number | null | undefined, digits = 2) => value === null || value === undefined ? "UNAVAILABLE" : new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(value);

export function TechnicalChart({ points, className }: Props) {
  if (!points.length) return <div className={cn("grid min-h-64 place-items-center rounded-xl border border-dashed border-white/[.1] bg-white/[.015] px-5 text-center", className)}><div><p className="text-sm font-medium text-slate-300">Chart data unavailable</p><p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">No validated current candle window is available for the selected timeframe. No historical data was requested to fill the display.</p></div></div>;
  const width = 920;
  const height = 290;
  const padding = { top: 20, right: 16, bottom: 26, left: 50 };
  const values = points.flatMap(point => [point.low, point.high, point.ema20, point.ema50, point.ema200].filter((value): value is number => value !== null));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, Number.EPSILON);
  const x = (index: number) => padding.left + index / Math.max(points.length - 1, 1) * (width - padding.left - padding.right);
  const y = (value: number) => padding.top + (max - value) / range * (height - padding.top - padding.bottom);
  const line = (key: "ema20" | "ema50" | "ema200") => points.flatMap((point, index) => point[key] === null ? [] : [`${x(index)},${y(point[key]!)}`]).join(" ");
  const latest = points.at(-1)!;
  return <div className={cn("overflow-hidden rounded-xl border border-white/[.07] bg-[#070d18]", className)}><div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[.06] px-4 py-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-cyan-200">Validated candle chart</p><p className="mt-1 text-xs text-slate-500">Candles with the same EMA and completed-bar inputs used by the technical engine.</p></div><div className="flex flex-wrap gap-2 text-[9px] font-semibold uppercase tracking-[.12em]"><span className="text-cyan-200">EMA20</span><span className="text-amber-200">EMA50</span><span className="text-fuchsia-200">EMA200</span></div></div><div className="overflow-x-auto"><svg viewBox={`0 0 ${width} ${height}`} className="min-w-[680px] w-full" role="img" aria-label="Validated candle chart with EMA overlays"><rect width={width} height={height} fill="#070d18" />{[0, 0.25, 0.5, 0.75, 1].map(ratio => <g key={ratio}><line x1={padding.left} x2={width - padding.right} y1={padding.top + ratio * (height - padding.top - padding.bottom)} y2={padding.top + ratio * (height - padding.top - padding.bottom)} stroke="rgba(148,163,184,.12)" /><text x={6} y={padding.top + ratio * (height - padding.top - padding.bottom) + 4} fill="#64748b" fontSize="10">{format(max - ratio * range, 4)}</text></g>)}{points.map((point, index) => { const bullish = point.close >= point.open; const candleWidth = Math.max(2, (width - padding.left - padding.right) / points.length * 0.56); return <g key={point.openTime}><line x1={x(index)} x2={x(index)} y1={y(point.high)} y2={y(point.low)} stroke={bullish ? "#34d399" : "#fb7185"} strokeWidth="1" /><rect x={x(index) - candleWidth / 2} y={y(Math.max(point.open, point.close))} width={candleWidth} height={Math.max(1, Math.abs(y(point.open) - y(point.close)))} fill={bullish ? "#34d399" : "#fb7185"} opacity=".82" /></g> })}<polyline points={line("ema20")} fill="none" stroke="#67e8f9" strokeWidth="1.6" /><polyline points={line("ema50")} fill="none" stroke="#fbbf24" strokeWidth="1.4" /><polyline points={line("ema200")} fill="none" stroke="#e879f9" strokeWidth="1.35" /></svg></div><div className="grid grid-cols-2 gap-px border-t border-white/[.06] bg-white/[.06] sm:grid-cols-4"><Stat label="Close" value={format(latest.close, 5)} /><Stat label="Volume" value={format(latest.volume, 2)} /><Stat label="RSI 14" value={format(latest.rsi)} /><Stat label="MACD histogram" value={format(latest.macdHistogram, 4)} /></div></div>;
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="bg-[#070d18] px-3 py-2.5"><span className="block text-[9px] font-semibold uppercase tracking-[.13em] text-slate-500">{label}</span><span className="mt-1 block truncate font-mono text-xs text-slate-200">{value}</span></div>; }
