import { useMemo, useRef, useState } from "react";
import type { PointerEvent, WheelEvent } from "react";
import type { TechnicalChartPoint } from "../../../../server/crypto/technical";
import { cn } from "@/lib/utils";

export type ChartPlanOverlay = {
  entry?: number | null;
  stop?: number | null;
  targets?: Array<{ label?: string | null; price?: number | null; status?: string | null }>;
};

type Props = {
  points: TechnicalChartPoint[];
  overlay?: ChartPlanOverlay | null;
  symbol?: string | null;
  timeframe?: string | null;
  className?: string;
};

const format = (value: number | null | undefined, digits = 2) =>
  value == null
    ? "UNAVAILABLE"
    : new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(value);

const priceFormat = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 2 : value >= 1 ? 3 : 6,
  }).format(value);

export function clampWindow(start: number, end: number, length: number) {
  const minimum = Math.min(18, length);
  const safeEnd = Math.max(minimum, Math.min(length, end));
  const safeStart = Math.max(0, Math.min(Math.max(0, safeEnd - minimum), start));
  return [safeStart, safeEnd] as const;
}

export function InteractiveCandlestickChart({ points, overlay, symbol, timeframe, className }: Props) {
  const [windowState, setWindowState] = useState(() => ({ start: Math.max(0, points.length - 90), end: points.length }));
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const dragRef = useRef<{ clientX: number; start: number; end: number } | null>(null);
  const width = 1000;
  const height = 460;
  const chart = { left: 68, right: 26, top: 30, height: 292 };
  const volume = { top: 356, height: 66 };

  const [start, end] = clampWindow(windowState.start, windowState.end, points.length);
  const visible = useMemo(() => points.slice(start, end), [points, start, end]);
  const values = visible.flatMap(point => [point.low, point.high, point.ema20, point.ema50, point.ema200].filter((value): value is number => value != null));
  const planValues = [overlay?.entry, overlay?.stop, ...(overlay?.targets ?? []).map(target => target.price)].filter((value): value is number => value != null);
  const min = Math.min(...values, ...planValues);
  const max = Math.max(...values, ...planValues);
  const range = Math.max(max - min, Math.abs(max) * 0.00001, Number.EPSILON);
  const y = (value: number) => chart.top + ((max - value) / range) * chart.height;
  const x = (index: number) => chart.left + (index / Math.max(visible.length - 1, 1)) * (width - chart.left - chart.right);
  const latest = visible.at(-1);
  const hovered = hoverIndex == null ? null : visible[hoverIndex];
  const maxVolume = Math.max(...visible.map(point => point.volume), 1);
  const candleWidth = Math.max(3, Math.min(14, (width - chart.left - chart.right) / Math.max(visible.length, 1) * 0.62));

  if (!points.length) {
    return (
      <div className={cn("grid min-h-72 place-items-center rounded-xl border border-dashed border-white/[.1] bg-white/[.015] px-5 text-center", className)}>
        <div>
          <p className="text-sm font-medium text-slate-300">Chart data unavailable</p>
          <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">No validated current candle window is available for the selected timeframe. No historical data was requested to fill the display.</p>
        </div>
      </div>
    );
  }

  const moveWindow = (delta: number) => {
    setWindowState(current => {
      const size = Math.max(18, current.end - current.start);
      const [nextStart, nextEnd] = clampWindow(current.start + delta, current.end + delta, points.length);
      return { start: nextEnd - size, end: nextEnd };
    });
  };

  const zoom = (factor: number) => {
    setWindowState(current => {
      const center = (current.start + current.end) / 2;
      const size = Math.max(18, Math.min(points.length, Math.round((current.end - current.start) * factor)));
      const [nextStart, nextEnd] = clampWindow(Math.round(center - size / 2), Math.round(center + size / 2), points.length);
      return { start: nextStart, end: nextEnd };
    });
  };

  const relativeIndex = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const plotX = ((event.clientX - rect.left) / rect.width) * width;
    const ratio = (plotX - chart.left) / (width - chart.left - chart.right);
    return Math.max(0, Math.min(visible.length - 1, Math.round(ratio * Math.max(visible.length - 1, 1))));
  };

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (dragRef.current) {
      const rect = event.currentTarget.getBoundingClientRect();
      const bars = Math.round(((event.clientX - dragRef.current.clientX) / rect.width) * visible.length);
      const [nextStart, nextEnd] = clampWindow(dragRef.current.start - bars, dragRef.current.end - bars, points.length);
      setWindowState({ start: nextStart, end: nextEnd });
      return;
    }
    setHoverIndex(relativeIndex(event));
  };

  const onWheel = (event: WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    zoom(event.deltaY > 0 ? 1.18 : 0.84);
  };

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { clientX: event.clientX, start, end };
  };

  const onPointerUp = (event: PointerEvent<SVGSVGElement>) => {
    if (dragRef.current && Math.abs(event.clientX - dragRef.current.clientX) < 4) setHoverIndex(relativeIndex(event));
    dragRef.current = null;
  };

  const line = (key: "ema20" | "ema50" | "ema200") => visible.map((point, index) => point[key] == null ? null : `${x(index)},${y(point[key]!)}`).filter(Boolean).join(" ");
  const planLines = [
    { label: "ENTRY", price: overlay?.entry, stroke: "#67e8f9", dash: "5 4" },
    { label: "SL", price: overlay?.stop, stroke: "#fb7185", dash: "5 4" },
    ...(overlay?.targets ?? []).slice(0, 3).map((target, index) => ({ label: target.label ?? `TP${index + 1}`, price: target.price, stroke: "#34d399", dash: "3 5" })),
  ].filter(item => item.price != null) as Array<{ label: string; price: number; stroke: string; dash: string }>;

  return (
    <div className={cn("overflow-hidden rounded-xl border border-white/[.07] bg-[#070d18]", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[.06] px-4 py-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-cyan-200">Interactive validated chart</p>
            {symbol ? <span className="font-mono text-[10px] text-slate-500">{symbol} · {(timeframe ?? "4h").toUpperCase()}</span> : null}
          </div>
          <p className="mt-1 text-xs text-slate-500">Scroll to zoom · drag to pan · move over candles for completed-bar values.</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[.12em]">
          <span className="text-cyan-200">EMA20</span><span className="text-amber-200">EMA50</span><span className="text-fuchsia-200">EMA200</span>
          {planLines.length ? <><span className="ml-1 text-slate-600">|</span><span className="text-cyan-200">PLAN</span></> : null}
          <button type="button" onClick={() => zoom(0.78)} className="ml-2 rounded border border-white/[.1] px-2 py-1 text-slate-300 hover:bg-white/[.06]" aria-label="Zoom in">+</button>
          <button type="button" onClick={() => zoom(1.28)} className="rounded border border-white/[.1] px-2 py-1 text-slate-300 hover:bg-white/[.06]" aria-label="Zoom out">−</button>
          <button type="button" onClick={() => setWindowState({ start: Math.max(0, points.length - 90), end: points.length })} className="rounded border border-white/[.1] px-2 py-1 text-slate-400 hover:bg-white/[.06]">Reset</button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="min-w-[760px] w-full select-none touch-none"
          role="img"
          aria-label={`Interactive validated candlestick chart for ${symbol ?? "asset"}`}
          onPointerMove={onPointerMove}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerLeave={() => { dragRef.current = null; setHoverIndex(null); }}
          onWheel={onWheel}
        >
          <rect width={width} height={height} fill="#070d18" />
          {[0, .25, .5, .75, 1].map(ratio => <g key={ratio}><line x1={chart.left} x2={width - chart.right} y1={chart.top + ratio * chart.height} y2={chart.top + ratio * chart.height} stroke="rgba(148,163,184,.12)" /><text x={8} y={chart.top + ratio * chart.height + 4} fill="#64748b" fontSize="10">{format(max - ratio * range, 5)}</text></g>)}
          <line x1={chart.left} x2={width - chart.right} y1={volume.top - 12} y2={volume.top - 12} stroke="rgba(148,163,184,.15)" />
          <text x={chart.left} y={volume.top + 8} fill="#64748b" fontSize="9">VOLUME</text>
          {planLines.map(item => <g key={`${item.label}-${item.price}`}><line x1={chart.left} x2={width - chart.right} y1={y(item.price)} y2={y(item.price)} stroke={item.stroke} strokeDasharray={item.dash} strokeWidth="1.3" opacity=".9" /><rect x={width - chart.right - 48} y={y(item.price) - 10} width="46" height="16" rx="3" fill="#0b1423" stroke={item.stroke} strokeOpacity=".35" /><text x={width - chart.right - 25} y={y(item.price) + 2} textAnchor="middle" fill={item.stroke} fontSize="9" fontWeight="600">{item.label}</text></g>)}
          {visible.map((point, index) => { const bullish = point.close >= point.open; const candleX = x(index); const top = y(Math.max(point.open, point.close)); const bottom = y(Math.min(point.open, point.close)); return <g key={point.openTime}><line x1={candleX} x2={candleX} y1={y(point.high)} y2={y(point.low)} stroke={bullish ? "#34d399" : "#fb7185"} strokeWidth="1.15" /><rect x={candleX - candleWidth / 2} y={top} width={candleWidth} height={Math.max(1.5, bottom - top)} fill={bullish ? "#34d399" : "#fb7185"} opacity=".86" rx=".8" /><rect x={candleX - candleWidth / 2} y={volume.top + volume.height - (point.volume / maxVolume) * volume.height} width={candleWidth} height={Math.max(1, (point.volume / maxVolume) * volume.height)} fill={bullish ? "#34d399" : "#fb7185"} opacity=".23" /></g>; })}
          <polyline points={line("ema20")} fill="none" stroke="#67e8f9" strokeWidth="1.6" /><polyline points={line("ema50")} fill="none" stroke="#fbbf24" strokeWidth="1.4" /><polyline points={line("ema200")} fill="none" stroke="#e879f9" strokeWidth="1.35" />
          {hovered ? <g><line x1={x(hoverIndex!)} x2={x(hoverIndex!)} y1={chart.top} y2={volume.top + volume.height} stroke="#e2e8f0" strokeDasharray="3 4" opacity=".55" /><line x1={chart.left} x2={width - chart.right} y1={y(hovered.close)} y2={y(hovered.close)} stroke="#e2e8f0" strokeDasharray="3 4" opacity=".35" /><rect x={Math.min(width - 206, Math.max(chart.left + 4, x(hoverIndex!) + 8))} y={chart.top + 8} width="194" height="76" rx="5" fill="#0b1423" stroke="rgba(148,163,184,.22)" /><text x={Math.min(width - 196, Math.max(chart.left + 14, x(hoverIndex!) + 18))} y={chart.top + 25} fill="#cbd5e1" fontSize="10" fontWeight="600">{new Date(hovered.openTime).toLocaleString()}</text><text x={Math.min(width - 196, Math.max(chart.left + 14, x(hoverIndex!) + 18))} y={chart.top + 43} fill="#94a3b8" fontSize="10">O {priceFormat(hovered.open)} · H {priceFormat(hovered.high)}</text><text x={Math.min(width - 196, Math.max(chart.left + 14, x(hoverIndex!) + 18))} y={chart.top + 59} fill="#94a3b8" fontSize="10">L {priceFormat(hovered.low)} · C {priceFormat(hovered.close)}</text><text x={Math.min(width - 196, Math.max(chart.left + 14, x(hoverIndex!) + 18))} y={chart.top + 75} fill="#64748b" fontSize="10">Vol {format(hovered.volume, 0)} · RSI {format(hovered.rsi)}</text></g> : null}
          {[0, Math.floor((visible.length - 1) / 2), visible.length - 1].filter((value, index, array) => value >= 0 && array.indexOf(value) === index).map(index => <text key={index} x={x(index)} y={height - 9} textAnchor="middle" fill="#64748b" fontSize="9">{new Date(visible[index].openTime).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</text>)}
        </svg>
      </div>
      <div className="flex items-center justify-between border-t border-white/[.06] px-4 py-2 text-[10px] text-slate-500"><span>{start + 1}–{end} of {points.length} validated candles</span><span>Last close <strong className="font-mono text-slate-200">{latest ? priceFormat(latest.close) : "UNAVAILABLE"}</strong></span></div>
      <div className="grid grid-cols-2 gap-px border-t border-white/[.06] bg-white/[.06] sm:grid-cols-4"><Stat label="Close" value={latest ? format(latest.close, 6) : "UNAVAILABLE"} /><Stat label="Volume" value={latest ? format(latest.volume, 2) : "UNAVAILABLE"} /><Stat label="RSI 14" value={latest ? format(latest.rsi) : "UNAVAILABLE"} /><Stat label="MACD histogram" value={latest ? format(latest.macdHistogram, 4) : "UNAVAILABLE"} /></div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="bg-[#070d18] px-3 py-2.5"><span className="block text-[9px] font-semibold uppercase tracking-[.13em] text-slate-500">{label}</span><span className="mt-1 block truncate font-mono text-xs text-slate-200">{value}</span></div>;
}
