import { ArrowLeft, ArrowRight, Bookmark, BookmarkCheck, CheckCircle2, CircleAlert, Database, Eye, Filter, RefreshCw, ShieldAlert, SlidersHorizontal, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { usePwaStatus } from "@/pwa/PwaStatus";
import { toast } from "sonner";
import { OpportunityCard, type OpportunityCardData } from "./OpportunityCard";

type Status = "QUALIFIED" | "POTENTIAL" | "WATCH" | "NO TRADE" | "DATA UNAVAILABLE";
type Strategy = "SCALP" | "SWING";
type FilterValue = "ALL" | Status | Strategy | "LONG" | "SHORT" | "HEALTHY" | "WARNING" | "DATA LIMITED" | "RISK OFF" | "WATCHLIST ONLY";
type FeedFilters = { status: "ALL" | Status; strategy: "ALL" | Strategy; direction: "ALL" | "LONG" | "SHORT"; health: "ALL" | "HEALTHY" | "WARNING"; regime: "ALL" | "RISK OFF"; dataLimited: boolean; watchlistOnly: boolean };
type EventFilter = "ALL" | "SETUP_DETECTED" | "ENTRY_SIMULATED" | "HEALTH_CHANGED" | "TARGET_1_REACHED" | "TARGET_2_REACHED" | "TARGET_3_REACHED" | "STOP_LOSS" | "INVALIDATED" | "DATA_UNAVAILABLE" | "RESUMED" | "COMPLETED";
type FeedItem = {
  assetId: string;
  symbol: string;
  status: Status;
  direction: "LONG" | "SHORT" | "NO TRADE";
  opportunityScore: number | null;
  adaptive?: { status?: string; quality?: { score: number | null; confidence: string }; warnings?: string[]; eligibleForAutoPaper?: boolean };
  setupReadiness?: { score: number | null };
  tradeReadiness?: string;
  provider?: string | null;
  dataTimestamp?: number | null;
  freshness?: string | null;
  validationStatus?: string | null;
  regime?: { classification: string | null; restricted?: boolean };
  timeframes?: { execution?: string; confirmation?: string; context?: string };
  exactReason?: string;
  whyInteresting?: string[];
  missingEvidence?: string[];
  confirmationRequirements?: string[];
  invalidationExplanation?: string;
  readinessPlan?: { availability?: string; entryZone?: { low: number; high: number; preferred: number } | null; invalidation?: { price: number } | null; targets?: Array<{ label: string; price: number; status?: string }>; rewardRisk?: number | null };
  sourcePlan?: { entryZone?: { preferred: number } | null; stop?: { price: number } | null; targets?: Array<{ label: string; price: number }> ; rewardRisk?: number | null };
  strategy: Strategy;
  sector: string;
};
type DiscoveryResponse = { generatedAt?: number; marketRegime?: { classification?: string | null; score?: number | null } | null; discovery?: { items?: FeedItem[] } };
type EligibilityRow = { assetId?: string; symbol?: string; strategy?: string; timeframe?: string; direction?: string; state?: string; reason?: string; warning?: string | null; provider?: string | null; freshness?: string | null; dataQuality?: string | null };
type EligibilityResponse = { enabled?: boolean; rows?: EligibilityRow[] };
type PerformanceResponse = { active?: number; completed?: number; totalTrials?: number; wins?: number; losses?: number; winRate?: number | null; averageR?: number | null; simulatedPnl?: number | null; netPnl?: number | null; sampleLabel?: string | null; insufficientSample?: boolean; t1Hit?: number; t2Hit?: number; t3Hit?: number; stopRate?: number; reversalRate?: number; stops?: number; stopCount?: number; targetsReached?: number; maximumDrawdown?: number | null; todayEntries?: number };
type Trial = { id: number; assetId?: string; strategy?: string; timeframe?: string; direction?: string; status?: string; createdAt?: Date | string | number; completedAt?: Date | string | number | null; currentPnl?: number | null; realizedPnl?: number | null };
type EventRow = { id?: number; eventType?: string; type?: string; status?: string; message?: string | null; createdAt?: Date | string | number };

const STATUS_ORDER: Status[] = ["QUALIFIED", "POTENTIAL", "WATCH", "NO TRADE", "DATA UNAVAILABLE"];
const STATUS_FILTERS: Status[] = ["QUALIFIED", "POTENTIAL", "WATCH", "NO TRADE", "DATA UNAVAILABLE"];
const DEFAULT_FEED_FILTERS: FeedFilters = { status: "ALL", strategy: "ALL", direction: "ALL", health: "ALL", regime: "ALL", dataLimited: false, watchlistOnly: false };
const readFeedFilters = (): FeedFilters => {
  if (typeof window === "undefined") return DEFAULT_FEED_FILTERS;
  const query = new URLSearchParams(window.location.search);
  const status = query.get("status")?.toUpperCase().replaceAll("-", " ") as Status | undefined;
  const strategy = query.get("strategy")?.toUpperCase() as Strategy | undefined;
  const direction = query.get("direction")?.toUpperCase() as "LONG" | "SHORT" | undefined;
  const health = query.get("health")?.toUpperCase() as "HEALTHY" | "WARNING" | undefined;
  const regime = query.get("regime")?.toUpperCase().replaceAll("-", " ") as "RISK OFF" | undefined;
  return {
    status: status && STATUS_FILTERS.includes(status) ? status : "ALL",
    strategy: strategy === "SCALP" || strategy === "SWING" ? strategy : "ALL",
    direction: direction === "LONG" || direction === "SHORT" ? direction : "ALL",
    health: health === "HEALTHY" || health === "WARNING" ? health : "ALL",
    regime: regime === "RISK OFF" ? regime : "ALL",
    dataLimited: query.get("data") === "limited",
    watchlistOnly: query.get("watchlist") === "only",
  };
};
const hasActiveFeedFilters = (filters: FeedFilters) => filters.status !== "ALL" || filters.strategy !== "ALL" || filters.direction !== "ALL" || filters.health !== "ALL" || filters.regime !== "ALL" || filters.dataLimited || filters.watchlistOnly;
const feedFiltersUrl = (filters: FeedFilters) => {
  if (typeof window === "undefined") return "/opportunities";
  const url = new URL(window.location.href);
  url.pathname = "/opportunities";
  ["status", "strategy", "direction", "health", "regime", "data", "watchlist", "workspace"].forEach(key => url.searchParams.delete(key));
  if (filters.status !== "ALL") url.searchParams.set("status", filters.status.toLowerCase().replaceAll(" ", "-"));
  if (filters.strategy !== "ALL") url.searchParams.set("strategy", filters.strategy.toLowerCase());
  if (filters.direction !== "ALL") url.searchParams.set("direction", filters.direction.toLowerCase());
  if (filters.health !== "ALL") url.searchParams.set("health", filters.health.toLowerCase());
  if (filters.regime !== "ALL") url.searchParams.set("regime", filters.regime.toLowerCase().replaceAll(" ", "-"));
  if (filters.dataLimited) url.searchParams.set("data", "limited");
  if (filters.watchlistOnly) url.searchParams.set("watchlist", "only");
  return `${url.pathname}${url.search}`;
};
const EVENT_FILTERS: EventFilter[] = ["ALL", "SETUP_DETECTED", "ENTRY_SIMULATED", "HEALTH_CHANGED", "TARGET_1_REACHED", "TARGET_2_REACHED", "TARGET_3_REACHED", "STOP_LOSS", "INVALIDATED", "DATA_UNAVAILABLE", "RESUMED", "COMPLETED"];
const displayDate = (value: Date | string | number | null | undefined) => value ? new Date(value).toLocaleString() : "UNAVAILABLE";
const money = (value: number | null | undefined) => value == null ? "UNAVAILABLE" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: value >= 100 ? 2 : value >= 1 ? 3 : 5 }).format(value);
const statusTone: Record<string, string> = { QUALIFIED: "border-emerald-300/25 bg-emerald-300/[.08] text-emerald-100", POTENTIAL: "border-amber-300/25 bg-amber-300/[.08] text-amber-100", WATCH: "border-cyan-300/25 bg-cyan-300/[.08] text-cyan-100", "NO TRADE": "border-rose-300/25 bg-rose-300/[.08] text-rose-100", "DATA UNAVAILABLE": "border-slate-400/25 bg-slate-400/[.07] text-slate-200" };
const terminalStatuses = new Set(["STOPPED", "CLOSED", "COMPLETED", "EXPIRED", "INVALIDATED"]);

function normalizeSampleLabel(value: string | null | undefined, completed: number) {
  const label = String(value ?? "").toUpperCase();
  if (label.includes("VERY SMALL")) return "VERY SMALL SAMPLE";
  if (label.includes("DEVELOPING")) return "DEVELOPING SAMPLE";
  if (label.includes("MEANINGFUL")) return "MEANINGFUL SAMPLE";
  if (completed > 0) return completed < 5 ? "VERY SMALL SAMPLE" : "DEVELOPING SAMPLE";
  return "NO DATA";
}
function healthFor(item: FeedItem) { return item.status === "QUALIFIED" ? "HEALTHY" : item.status === "DATA UNAVAILABLE" ? "UNAVAILABLE" : "WARNING"; }
function warningFor(item: FeedItem) { return [item.regime?.restricted ? "RISK OFF" : null, ...(item.adaptive?.warnings ?? []), ...(item.confirmationRequirements ?? [])].filter(Boolean).join(" · ") || null; }
function dataQualityFor(item: FeedItem, eligibility?: EligibilityRow) { return eligibility?.dataQuality ?? item.validationStatus ?? (item.status === "DATA UNAVAILABLE" ? "UNAVAILABLE" : "SERVER VALIDATED"); }
function eligibilityFor(item: FeedItem, eligibility: EligibilityResponse | undefined) { const timeframe = String(item.timeframes?.execution ?? "").toUpperCase(); return eligibility?.rows?.find(row => row.assetId === item.assetId && String(row.strategy).toUpperCase() === item.strategy && String(row.timeframe).toUpperCase() === timeframe && String(row.direction).toUpperCase() === item.direction); }
function toCard(item: FeedItem, eligibilityResponse: EligibilityResponse | undefined, autoPaperEnabled: boolean | undefined): OpportunityCardData {
  const eligibility = eligibilityFor(item, eligibilityResponse);
  const plan = item.readinessPlan;
  const entry = plan?.entryZone ?? null;
  const targets = plan?.targets ?? item.sourcePlan?.targets ?? [];
  return {
    assetId: item.assetId,
    symbol: item.symbol,
    setupType: item.strategy === "SCALP" ? "15M FAST SCALP" : "SWING",
    timeframe: String(item.timeframes?.execution ?? "UNAVAILABLE").toUpperCase(),
    status: item.status,
    score: item.opportunityScore,
    direction: item.direction,
    entryZone: entry,
    stop: plan?.invalidation ? { price: plan.invalidation.price } : item.sourcePlan?.stop ? { price: item.sourcePlan.stop.price } : null,
    targets,
    readiness: item.setupReadiness?.score ?? null,
    health: healthFor(item),
    why: item.exactReason ?? item.whyInteresting?.[0] ?? "Server-derived opportunity state.",
    reasons: item.whyInteresting,
    confirmationGaps: item.missingEvidence,
    provider: eligibility?.provider ?? item.provider,
    dataTimestamp: item.dataTimestamp,
    freshness: eligibility?.freshness ?? item.freshness,
    dataQuality: dataQualityFor(item, eligibility),
    rewardRisk: plan?.rewardRisk ?? item.sourcePlan?.rewardRisk ?? null,
    warning: warningFor(item),
    autoPaperState: autoPaperEnabled == null ? "AUTHENTICATION REQUIRED" : autoPaperEnabled ? eligibility?.state ?? "NOT EVALUATED" : "AUTO PAPER OFF",
    autoPaperReason: autoPaperEnabled ? eligibility?.reason ?? eligibility?.warning ?? null : "Simulation remains disabled until explicitly enabled by the owner.",
    canMonitor: item.status === "QUALIFIED" || item.status === "POTENTIAL" || item.status === "WATCH",
  };
}

export function OpportunityFeedWorkspace({ onBack, onInspectAsset, onOpenDecision }: { onBack: () => void; onInspectAsset: (assetId: string, returnTo?: string) => void; onOpenDecision: (assetId?: string, returnTo?: string) => void }) {
  const { online } = usePwaStatus();
  const { isAuthenticated } = useAuth();
  const privateEnabled = online && isAuthenticated;
  const [feedFilters, setFeedFilters] = useState<FeedFilters>(() => readFeedFilters());
  const [draftFilters, setDraftFilters] = useState<FeedFilters>(() => readFeedFilters());
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [eventFilter, setEventFilter] = useState<EventFilter>("ALL");
  const [selectedTrialId, setSelectedTrialId] = useState<number | null>(null);
  const scalpQuery = trpc.crypto.tradeSetups.useQuery({ mode: "SCALP" }, { enabled: online, staleTime: 30_000, refetchOnWindowFocus: false });
  const swingQuery = trpc.crypto.tradeSetups.useQuery({ mode: "SWING" }, { enabled: online, staleTime: 30_000, refetchOnWindowFocus: false });
  const scannerQuery = trpc.crypto.scanner.useQuery(undefined, { enabled: online, staleTime: 45_000, refetchOnWindowFocus: false });
  const settingsQuery = trpc.crypto.autoPaperSettings.useQuery(undefined, { enabled: privateEnabled, staleTime: 30_000, refetchOnWindowFocus: false });
  const eligibilityQuery = trpc.crypto.autoPaperEligibilitySummary.useQuery(undefined, { enabled: privateEnabled, staleTime: 30_000, refetchOnWindowFocus: false });
  const watchlistQuery = trpc.crypto.watchlist.useQuery(undefined, { enabled: privateEnabled, staleTime: 30_000, refetchOnWindowFocus: false });
  const utils = trpc.useUtils();
  const addWatch = trpc.crypto.addWatchlistAsset.useMutation({ onSuccess: async () => { await utils.crypto.watchlist.invalidate(); toast.success("ADDED TO WATCHLIST"); }, onError: error => toast.error(error.message) });
  const removeWatch = trpc.crypto.removeWatchlistAsset.useMutation({ onSuccess: async () => { await utils.crypto.watchlist.invalidate(); toast.success("REMOVED FROM WATCHLIST"); }, onError: error => toast.error(error.message) });
  const performanceQuery = trpc.crypto.autoPaperPerformance.useQuery(undefined, { enabled: privateEnabled, staleTime: 30_000, refetchOnWindowFocus: false });
  const historyQuery = trpc.crypto.autoPaperHistory.useQuery(undefined, { enabled: privateEnabled, staleTime: 30_000, refetchOnWindowFocus: false });
  const eventsQuery = trpc.crypto.autoPaperEvents.useQuery({ trialId: selectedTrialId ?? 0 }, { enabled: privateEnabled && selectedTrialId !== null, staleTime: 30_000, refetchOnWindowFocus: false });

  const scalp = scalpQuery.data as DiscoveryResponse | undefined;
  const swing = swingQuery.data as DiscoveryResponse | undefined;
  const scanner = scannerQuery.data as { generatedAt?: number; dataStatus?: Array<{ status?: string; fetchedAt?: number; message?: string }> } | undefined;
  const currentRegime = swing?.marketRegime ?? scalp?.marketRegime ?? null;
  const watchedAssetIds = useMemo(() => new Set((watchlistQuery.data ?? []) as string[]), [watchlistQuery.data]);
  const items = useMemo(() => [
    ...(scalp?.discovery?.items ?? []).map(item => ({ ...item, strategy: "SCALP" as const, sector: "UNKNOWN / UNCLASSIFIED" })),
    ...(swing?.discovery?.items ?? []).map(item => ({ ...item, strategy: "SWING" as const, sector: "UNKNOWN / UNCLASSIFIED" })),
  ], [scalp?.discovery?.items, swing?.discovery?.items]);
  const filteredItems = useMemo(() => items.filter(item => {
    const health = healthFor(item);
    const isRiskOff = item.regime?.restricted || String(item.regime?.classification ?? currentRegime?.classification ?? "").toUpperCase() === "RISK OFF";
    if (feedFilters.status !== "ALL" && item.status !== feedFilters.status) return false;
    if (feedFilters.strategy !== "ALL" && item.strategy !== feedFilters.strategy) return false;
    if (feedFilters.direction !== "ALL" && item.direction !== feedFilters.direction) return false;
    if (feedFilters.health !== "ALL" && health !== feedFilters.health) return false;
    if (feedFilters.regime === "RISK OFF" && !isRiskOff) return false;
    if (feedFilters.dataLimited && !(item.status === "DATA UNAVAILABLE" || item.freshness === "STALE" || item.freshness === "UNAVAILABLE")) return false;
    if (feedFilters.watchlistOnly && !watchedAssetIds.has(item.assetId)) return false;
    return true;
  }).toSorted((left, right) => ((right.opportunityScore ?? -1) - (left.opportunityScore ?? -1)) || ((right.setupReadiness?.score ?? -1) - (left.setupReadiness?.score ?? -1)) || (STATUS_ORDER.indexOf(left.status) - STATUS_ORDER.indexOf(right.status)) || left.symbol.localeCompare(right.symbol)), [items, feedFilters, currentRegime?.classification, watchedAssetIds]);
  const topOpportunities = filteredItems.filter(item => ["QUALIFIED", "POTENTIAL"].includes(item.status)).slice(0, 6);
  const dataLimited = filteredItems.filter(item => item.status === "DATA UNAVAILABLE" || item.freshness === "STALE" || item.freshness === "UNAVAILABLE");
  const eligibility = eligibilityQuery.data as EligibilityResponse | undefined;
  const performance = performanceQuery.data as PerformanceResponse | undefined;
  const trials = useMemo(() => ((historyQuery.data ?? []) as unknown as Trial[]).toSorted((left, right) => new Date(right.createdAt ?? 0).getTime() - new Date(left.createdAt ?? 0).getTime()), [historyQuery.data]);
  const activeTrials = trials.filter(trial => !terminalStatuses.has(String(trial.status ?? "").toUpperCase()));
  const completedTrials = trials.filter(trial => terminalStatuses.has(String(trial.status ?? "").toUpperCase()));
  const todaysEntries = performance?.todayEntries ?? "UNAVAILABLE";
  const sampleLabel = normalizeSampleLabel(performance?.sampleLabel, performance?.completed ?? completedTrials.length);
  const eventRows = ((eventsQuery.data ?? []) as unknown as EventRow[]).filter(event => eventFilter === "ALL" || String(event.eventType ?? event.type ?? event.status ?? "").toUpperCase() === eventFilter);
  const liveCount = scanner?.dataStatus?.filter(status => status.status === "live").length ?? 0;
  const statusValues = scanner?.dataStatus?.map(status => String(status.status ?? "").toLowerCase()) ?? [];
  const dataStatusLabel = statusValues.length === 0 ? "UNAVAILABLE" : statusValues.every(status => status === "live") ? "FRESH" : statusValues.some(status => status === "stale") ? "STALE" : liveCount > 0 ? "LIMITED" : "UNAVAILABLE";
  const lastValidated = scanner?.generatedAt ?? swing?.generatedAt ?? scalp?.generatedAt ?? null;
  useEffect(() => {
    const onPopState = () => setFeedFilters(readFeedFilters());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  const updateFeedFilters = (patch: Partial<FeedFilters>) => {
    const next = { ...feedFilters, ...patch };
    setFeedFilters(next);
    if (typeof window !== "undefined") window.history.pushState(null, "", feedFiltersUrl(next));
  };
  const resetFeedFilters = () => {
    setFeedFilters(DEFAULT_FEED_FILTERS);
    setDraftFilters(DEFAULT_FEED_FILTERS);
    if (typeof window !== "undefined") window.history.pushState(null, "", feedFiltersUrl(DEFAULT_FEED_FILTERS));
  };
  const openMobileFilters = () => { setDraftFilters(feedFilters); setMobileFilterOpen(true); };
  const applyMobileFilters = () => { setFeedFilters(draftFilters); if (typeof window !== "undefined") window.history.pushState(null, "", feedFiltersUrl(draftFilters)); setMobileFilterOpen(false); };
  const refresh = async () => { if (!online) return; await Promise.all([scalpQuery.refetch(), swingQuery.refetch(), scannerQuery.refetch(), privateEnabled ? eligibilityQuery.refetch() : Promise.resolve(), privateEnabled ? watchlistQuery.refetch() : Promise.resolve(), privateEnabled ? performanceQuery.refetch() : Promise.resolve(), privateEnabled ? historyQuery.refetch() : Promise.resolve()]); };
  const toggleWatchlist = (assetId: string) => {
    if (!isAuthenticated || !online) { toast.message(isAuthenticated ? "Watchlist requires a connection" : "Sign in to use Watchlist"); return; }
    if (watchedAssetIds.has(assetId)) removeWatch.mutate({ assetId }); else addWatch.mutate({ assetId });
  };
  const applyChipFilter = (value: FilterValue) => {
    if (value === "ALL") return resetFeedFilters();
    if (STATUS_FILTERS.includes(value as Status)) return updateFeedFilters({ status: value as Status });
    if (value === "SCALP" || value === "SWING") return updateFeedFilters({ strategy: value });
    if (value === "LONG" || value === "SHORT") return updateFeedFilters({ direction: value });
    if (value === "HEALTHY" || value === "WARNING") return updateFeedFilters({ health: value });
    if (value === "DATA LIMITED") return updateFeedFilters({ dataLimited: !feedFilters.dataLimited });
    if (value === "RISK OFF") return updateFeedFilters({ regime: feedFilters.regime === "RISK OFF" ? "ALL" : "RISK OFF" });
    return updateFeedFilters({ watchlistOnly: !feedFilters.watchlistOnly });
  };
  const chipActive = (value: FilterValue) => value === "ALL" ? !hasActiveFeedFilters(feedFilters) : value === "WATCHLIST ONLY" ? feedFilters.watchlistOnly : STATUS_FILTERS.includes(value as Status) ? feedFilters.status === value : value === "SCALP" || value === "SWING" ? feedFilters.strategy === value : value === "LONG" || value === "SHORT" ? feedFilters.direction === value : value === "HEALTHY" || value === "WARNING" ? feedFilters.health === value : value === "DATA LIMITED" ? feedFilters.dataLimited : feedFilters.regime === "RISK OFF";
  const returnContext = typeof window === "undefined" ? "/opportunities" : `${window.location.pathname}${window.location.search}`;

  return <section className="min-h-screen pb-24 rounded-2xl border border-white/[.08] bg-[#080e19]/95 p-4 text-slate-100 shadow-2xl sm:p-6 lg:pb-6">
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[.07] pb-5"><div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-300/[.12] text-cyan-200"><Sparkles className="h-5 w-5" /></span><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-cyan-300">Live Opportunity Feed · read only</p><h1 className="mt-1 text-xl font-semibold tracking-tight">What is happening now?</h1><p className="mt-2 max-w-3xl text-xs leading-5 text-slate-400">Current Scalp and Swing opportunity states, warnings, plans, freshness, and private Auto Paper observations. This feed never creates a Trial, changes a score, or sends an order.</p></div></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={refresh} disabled={!online || scalpQuery.isFetching || swingQuery.isFetching} className="min-h-11 border-white/[.1] bg-white/[.025] text-slate-200"><RefreshCw className="mr-2 h-4 w-4" />REFRESH</Button><Button variant="outline" onClick={onBack} className="min-h-11 border-white/[.1] bg-white/[.025] text-slate-200"><ArrowLeft className="mr-2 h-4 w-4" />Back</Button></div></header>
    {!online ? <div role="status" className="mt-5 rounded-xl border border-amber-300/25 bg-amber-300/[.06] p-4 text-xs text-amber-100"><strong>OFFLINE · READ ONLY.</strong> The feed requires a current server response. No mutation is available offline.</div> : null}
    <section className={`mt-5 rounded-2xl border p-4 ${currentRegime?.classification === "RISK OFF" ? "border-rose-300/25 bg-rose-300/[.06]" : "border-cyan-300/15 bg-cyan-300/[.025]"}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] opacity-70">MARKET STATE</p><h2 className="mt-1 text-lg font-semibold">{currentRegime?.classification ?? "UNAVAILABLE"}</h2><p className="mt-1 text-xs text-slate-300">Data Status: {dataStatusLabel} · Last validated: {displayDate(lastValidated)}</p><p className="mt-1 text-[11px] text-slate-500">Market health: {liveCount > 0 ? "VALIDATED INPUTS PRESENT" : "UNAVAILABLE"} · Live OHLCV statuses: {liveCount || "UNAVAILABLE"}</p></div><span className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold tracking-[.12em] ${currentRegime?.classification === "RISK OFF" ? "border-rose-300/30 bg-rose-300/[.1] text-rose-100" : "border-cyan-300/20 bg-cyan-300/[.08] text-cyan-100"}`}>{currentRegime?.classification ?? "UNAVAILABLE"}</span></div>{currentRegime?.classification === "RISK OFF" ? <div className="mt-3 flex gap-2 rounded-lg border border-rose-300/20 bg-rose-300/[.08] p-3 text-xs text-rose-100"><ShieldAlert className="h-4 w-4 shrink-0" /><span><strong>RISK OFF:</strong> potential and watch setups remain visible with warnings. Existing eligibility and Paper rules are unchanged.</span></div> : null}</section>
    {!scalpQuery.isLoading && !swingQuery.isLoading && !scalpQuery.error && !swingQuery.error && (!hasActiveFeedFilters(feedFilters) || filteredItems.length > 0) ? <FeedSection title="TOP OPPORTUNITIES" subtitle="Highest current server-ranked Qualified and Potential states; display filters never re-score." items={topOpportunities} empty="NO CURRENT OPPORTUNITIES" onInspectAsset={onInspectAsset} onOpenDecision={onOpenDecision} onToggleWatchlist={toggleWatchlist} watchedAssetIds={watchedAssetIds} watchlistPending={addWatch.isPending || removeWatch.isPending} returnTo={returnContext} eligibility={eligibility} autoPaperEnabled={isAuthenticated ? settingsQuery.data?.enabled : undefined} /> : null}
    <section className="mt-5 rounded-2xl border border-white/[.08] bg-white/[.018] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><Filter className="h-4 w-4 text-cyan-300" /><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-cyan-300">DISPLAY FILTERS</p><p className="text-[11px] text-slate-500">Presentation only · server qualification and ranking are unchanged.</p></div></div><Button type="button" variant="outline" onClick={openMobileFilters} className="min-h-11 border-cyan-300/20 bg-cyan-300/[.05] text-[10px] text-cyan-100 lg:hidden"><SlidersHorizontal className="mr-2 h-4 w-4" />FILTERS{hasActiveFeedFilters(feedFilters) ? " · ACTIVE" : ""}</Button></div><div className="mt-3 hidden flex-wrap gap-2 lg:flex" aria-label="Opportunity Feed display filters">{(["ALL", "QUALIFIED", "POTENTIAL", "WATCH", "NO TRADE", "DATA UNAVAILABLE", "SCALP", "SWING", "LONG", "SHORT", "HEALTHY", "WARNING", "DATA LIMITED", "RISK OFF", "WATCHLIST ONLY"] as FilterValue[]).map(value => <Button key={value} type="button" variant="outline" aria-pressed={chipActive(value)} onClick={() => applyChipFilter(value)} className={`min-h-11 border-white/[.1] px-3 text-[10px] ${chipActive(value) ? "bg-cyan-300/[.12] text-cyan-100" : "bg-white/[.02] text-slate-400"}`}>{value}</Button>)}</div><p className="mt-3 text-[11px] text-slate-500" role="status" aria-live="polite">Showing {filteredItems.length} opportunities. {hasActiveFeedFilters(feedFilters) ? "Filters are display-only." : "Server ranking is unchanged."}</p></section>
    <Sheet open={mobileFilterOpen} onOpenChange={setMobileFilterOpen}><SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto border-white/[.1] bg-[#0b1321] pb-4 text-slate-100"><SheetHeader><SheetTitle className="text-slate-100">Opportunity filters</SheetTitle><SheetDescription className="text-slate-400">Display-only controls. Apply updates the URL; server scoring and ranking remain unchanged.</SheetDescription></SheetHeader><div className="space-y-5 px-4"><FilterGroup label="Status" value={draftFilters.status} options={["ALL", ...STATUS_FILTERS]} onChange={value => setDraftFilters(current => ({ ...current, status: value as FeedFilters["status"] }))} /><FilterGroup label="Strategy" value={draftFilters.strategy} options={["ALL", "SCALP", "SWING"]} onChange={value => setDraftFilters(current => ({ ...current, strategy: value as FeedFilters["strategy"] }))} /><FilterGroup label="Direction" value={draftFilters.direction} options={["ALL", "LONG", "SHORT"]} onChange={value => setDraftFilters(current => ({ ...current, direction: value as FeedFilters["direction"] }))} /><FilterGroup label="Health" value={draftFilters.health} options={["ALL", "HEALTHY", "WARNING"]} onChange={value => setDraftFilters(current => ({ ...current, health: value as FeedFilters["health"] }))} /><FilterGroup label="Market regime" value={draftFilters.regime} options={["ALL", "RISK OFF"]} onChange={value => setDraftFilters(current => ({ ...current, regime: value as FeedFilters["regime"] }))} /><div className="rounded-xl border border-white/[.08] bg-white/[.025] p-3"><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-500">Additional scope</p><div className="mt-2 grid gap-2 sm:grid-cols-2"><Button type="button" variant="outline" aria-pressed={draftFilters.dataLimited} onClick={() => setDraftFilters(current => ({ ...current, dataLimited: !current.dataLimited }))} className={`min-h-11 justify-start ${draftFilters.dataLimited ? "bg-cyan-300/[.12] text-cyan-100" : "text-slate-400"}`}>DATA LIMITED</Button><Button type="button" variant="outline" aria-pressed={draftFilters.watchlistOnly} onClick={() => setDraftFilters(current => ({ ...current, watchlistOnly: !current.watchlistOnly }))} className={`min-h-11 justify-start ${draftFilters.watchlistOnly ? "bg-cyan-300/[.12] text-cyan-100" : "text-slate-400"}`}>WATCHLIST ONLY</Button></div></div></div><SheetFooter className="grid grid-cols-3 gap-2"><Button type="button" variant="outline" onClick={() => setDraftFilters(DEFAULT_FEED_FILTERS)} className="min-h-11 text-slate-300">RESET</Button><Button type="button" variant="outline" onClick={() => setMobileFilterOpen(false)} className="min-h-11 text-slate-300">CLOSE</Button><Button type="button" onClick={applyMobileFilters} className="min-h-11 bg-cyan-300 text-slate-950 hover:bg-cyan-200">APPLY</Button></SheetFooter></SheetContent></Sheet>
    {scalpQuery.isLoading || swingQuery.isLoading ? <Loading /> : null}
    {scalpQuery.error || swingQuery.error ? <ErrorState detail={scalpQuery.error?.message ?? swingQuery.error?.message ?? "Server response unavailable."} /> : null}
    {!scalpQuery.isLoading && !swingQuery.isLoading && !scalpQuery.error && !swingQuery.error && filteredItems.length === 0 && hasActiveFeedFilters(feedFilters) ? <NoMatchState marketState={currentRegime?.classification ?? "UNAVAILABLE"} dataStatus={dataStatusLabel} onClear={resetFeedFilters} /> : null}
    {!scalpQuery.isLoading && !swingQuery.isLoading && !scalpQuery.error && !swingQuery.error && (!hasActiveFeedFilters(feedFilters) || filteredItems.length > 0) ? <>
      <FeedSection title="SCALP · 15M FAST SCALP" subtitle="Native lower-timeframe evidence only; no unsupported 1M / 3M / 5M substitution." items={filteredItems.filter(item => item.strategy === "SCALP")} empty="NO CURRENT SCALP OPPORTUNITIES" onInspectAsset={onInspectAsset} onOpenDecision={onOpenDecision} onToggleWatchlist={toggleWatchlist} watchedAssetIds={watchedAssetIds} watchlistPending={addWatch.isPending || removeWatch.isPending} returnTo={returnContext} eligibility={eligibility} autoPaperEnabled={isAuthenticated ? settingsQuery.data?.enabled : undefined} />
      <FeedSection title="SWING" subtitle="Existing 1H / 4H / 1D server-derived interpretation." items={filteredItems.filter(item => item.strategy === "SWING")} empty="NO CURRENT SWING OPPORTUNITIES" onInspectAsset={onInspectAsset} onOpenDecision={onOpenDecision} onToggleWatchlist={toggleWatchlist} watchedAssetIds={watchedAssetIds} watchlistPending={addWatch.isPending || removeWatch.isPending} returnTo={returnContext} eligibility={eligibility} autoPaperEnabled={isAuthenticated ? settingsQuery.data?.enabled : undefined} />
      <FeedSection title="WATCH" subtitle="Visible monitoring context, including Risk Off and confirmation gaps." items={filteredItems.filter(item => item.status === "WATCH")} empty="NO WATCH STATES" onInspectAsset={onInspectAsset} onOpenDecision={onOpenDecision} onToggleWatchlist={toggleWatchlist} watchedAssetIds={watchedAssetIds} watchlistPending={addWatch.isPending || removeWatch.isPending} returnTo={returnContext} eligibility={eligibility} autoPaperEnabled={isAuthenticated ? settingsQuery.data?.enabled : undefined} />
      <FeedSection title="DATA LIMITED" subtitle="No trade levels are shown unless the current validated plan provides them." items={dataLimited} empty="NO DATA-LIMITED STATES" onInspectAsset={onInspectAsset} onOpenDecision={onOpenDecision} onToggleWatchlist={toggleWatchlist} watchedAssetIds={watchedAssetIds} watchlistPending={addWatch.isPending || removeWatch.isPending} returnTo={returnContext} eligibility={eligibility} autoPaperEnabled={isAuthenticated ? settingsQuery.data?.enabled : undefined} />
    </> : null}
    <ObservationCenter privateEnabled={privateEnabled} settingsEnabled={settingsQuery.data?.enabled} performance={performance} trials={trials} activeTrials={activeTrials} completedTrials={completedTrials} todaysEntries={todaysEntries} sampleLabel={sampleLabel} selectedTrialId={selectedTrialId} setSelectedTrialId={setSelectedTrialId} eventFilter={eventFilter} setEventFilter={setEventFilter} eventRows={eventRows} eventsLoading={eventsQuery.isLoading} />
  </section>;
}

function FilterGroup({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <div><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-400">{label}</p><div className="mt-2 grid gap-2 sm:grid-cols-3">{options.map(option => <Button key={option} type="button" variant="outline" aria-pressed={value === option} onClick={() => onChange(option)} className={`min-h-11 justify-start ${value === option ? "border-cyan-300/35 bg-cyan-300/[.12] text-cyan-100" : "border-white/[.1] text-slate-400"}`}>{option}</Button>)}</div></div>;
}

function NoMatchState({ marketState, dataStatus, onClear }: { marketState: string; dataStatus: string; onClear: () => void }) {
  return <section role="status" className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/[.045] p-6 text-center"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-amber-200">NO MATCHING OPPORTUNITIES</p><p className="mt-2 text-sm text-slate-300">The current display filters do not match a server-returned opportunity.</p><div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-[11px] text-slate-500"><span>Market State: {marketState}</span><span>Data Status: {dataStatus}</span></div><Button type="button" onClick={onClear} className="mt-4 min-h-11 bg-cyan-300 text-slate-950 hover:bg-cyan-200">CLEAR FILTERS</Button></section>;
}

function FeedSection({ title, subtitle, items, empty, onInspectAsset, onOpenDecision, onToggleWatchlist, watchedAssetIds, watchlistPending, returnTo, eligibility, autoPaperEnabled }: { title: string; subtitle: string; items: FeedItem[]; empty: string; onInspectAsset: (assetId: string, returnTo?: string) => void; onOpenDecision: (assetId?: string, returnTo?: string) => void; onToggleWatchlist: (assetId: string) => void; watchedAssetIds: Set<string>; watchlistPending: boolean; returnTo: string; eligibility?: EligibilityResponse; autoPaperEnabled?: boolean }) {
  return <section className="mt-5"><div className="mb-3 flex flex-wrap items-end justify-between gap-2"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-cyan-300">{title}</p><p className="mt-1 text-xs text-slate-500">{subtitle}</p></div><span className="font-mono text-[11px] text-slate-500">{items.length} shown</span></div>{items.length ? <div className="grid gap-4 xl:grid-cols-2">{items.map(item => <FeedCard key={`${item.strategy}-${item.assetId}`} item={item} eligibility={eligibility} autoPaperEnabled={autoPaperEnabled} onInspect={() => onInspectAsset(item.assetId, returnTo)} onOpenDecision={() => onOpenDecision(item.assetId, returnTo)} onToggleWatchlist={() => onToggleWatchlist(item.assetId)} isWatched={watchedAssetIds.has(item.assetId)} watchlistPending={watchlistPending} />)}</div> : <div className="rounded-2xl border border-dashed border-white/[.12] bg-white/[.015] p-8 text-center text-sm text-slate-400"><Database className="mx-auto h-5 w-5 text-slate-600" /><p className="mt-3 font-medium text-slate-300">{empty}</p><p className="mt-1 text-xs">The feed will not manufacture an opportunity when validated evidence is absent.</p></div>}</section>;
}

function FeedCard({ item, eligibility, autoPaperEnabled, onInspect, onOpenDecision, onToggleWatchlist, isWatched, watchlistPending }: { item: FeedItem; eligibility?: EligibilityResponse; autoPaperEnabled?: boolean; onInspect: () => void; onOpenDecision: () => void; onToggleWatchlist: () => void; isWatched: boolean; watchlistPending: boolean }) {
  const card = toCard(item, eligibility, autoPaperEnabled);
  const planUnavailable = item.status === "DATA UNAVAILABLE" || item.readinessPlan?.availability === "UNAVAILABLE" || !item.readinessPlan;
  const warning = card.warning ?? "No additional warning returned by the server.";
  return <div className="space-y-2"><OpportunityCard data={card} onView={onInspect} /><div className="grid gap-2 rounded-xl border border-white/[.07] bg-white/[.018] p-3 text-[10px] sm:grid-cols-2"><span><strong className="mr-1 uppercase tracking-[.1em] text-slate-500">Freshness</strong>{card.freshness ?? "UNAVAILABLE"}</span><span><strong className="mr-1 uppercase tracking-[.1em] text-slate-500">Data quality</strong>{card.dataQuality ?? "UNAVAILABLE"}</span><span className={warning === "No additional warning returned by the server." ? "text-slate-500" : "text-amber-200"}><strong className="mr-1 uppercase tracking-[.1em]">WARNING</strong>{warning}</span><span className={planUnavailable ? "text-slate-400" : "text-emerald-200"}><strong className="mr-1 uppercase tracking-[.1em]">{planUnavailable ? "PLAN UNAVAILABLE" : "PLAN AVAILABLE"}</strong>{planUnavailable ? "Entry, SL, and targets are not shown without a valid server-derived plan." : "Validated entry, stop, and target levels are available above."}</span><span className="text-slate-500 sm:col-span-2"><strong className="mr-1 uppercase tracking-[.1em]">Last validated</strong>{displayDate(card.dataTimestamp)}</span></div><div className="flex flex-wrap items-center justify-end gap-2"><Button type="button" variant="ghost" onClick={onOpenDecision} className="min-h-11 px-2 text-[10px] font-semibold uppercase tracking-[.14em] text-cyan-200"><Eye className="mr-1.5 h-3.5 w-3.5" />VIEW DECISION <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button><Button type="button" variant="ghost" onClick={onInspect} className="min-h-11 px-2 text-[10px] font-semibold uppercase tracking-[.14em] text-cyan-200"><ArrowRight className="mr-1.5 h-3.5 w-3.5" />VIEW FULL ANALYSIS</Button><Button type="button" variant="outline" onClick={onToggleWatchlist} disabled={watchlistPending} className="min-h-11 px-2 text-[10px] font-semibold uppercase tracking-[.12em] text-slate-300" aria-label={isWatched ? `Remove ${item.symbol} from Watchlist` : `Add ${item.symbol} to Watchlist`}>{isWatched ? <BookmarkCheck className="mr-1.5 h-3.5 w-3.5 text-cyan-200" /> : <Bookmark className="mr-1.5 h-3.5 w-3.5" />}{isWatched ? "IN WATCHLIST" : "ADD TO WATCHLIST"}</Button></div></div>;
}

function ObservationCenter({ privateEnabled, settingsEnabled, performance, trials, activeTrials, completedTrials, todaysEntries, sampleLabel, selectedTrialId, setSelectedTrialId, eventFilter, setEventFilter, eventRows, eventsLoading }: { privateEnabled: boolean; settingsEnabled?: boolean; performance?: PerformanceResponse; trials: Trial[]; activeTrials: Trial[]; completedTrials: Trial[]; todaysEntries: number | string; sampleLabel: string; selectedTrialId: number | null; setSelectedTrialId: (id: number | null) => void; eventFilter: EventFilter; setEventFilter: (value: EventFilter) => void; eventRows: EventRow[]; eventsLoading: boolean }) {
  const metric = (label: string, value: string | number, note?: string) => <div className="rounded-xl border border-white/[.07] bg-white/[.025] p-3"><p className="text-[9px] font-semibold uppercase tracking-[.13em] text-slate-500">{label}</p><p className="mt-1 font-mono text-base text-slate-100">{value}</p>{note ? <p className="mt-1 text-[10px] text-slate-600">{note}</p> : null}</div>;
  const stops = performance?.stops ?? performance?.stopCount;
  const targetSummary = performance && [performance.t1Hit, performance.t2Hit, performance.t3Hit].some(value => value != null) ? `TP1 ${performance.t1Hit ?? "—"} · TP2 ${performance.t2Hit ?? "—"} · TP3 ${performance.t3Hit ?? "—"}` : "UNAVAILABLE";
  const maximumDrawdown = performance?.maximumDrawdown ?? null;
  return <section className="mt-6 rounded-2xl border border-violet-300/15 bg-violet-300/[.025] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.17em] text-violet-200">LIVE OBSERVATION</p><h2 className="mt-1 text-lg font-semibold">Auto Paper observation center</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">Private, owner-scoped evidence only. Opening this feed never enables Auto Paper, creates a Trial, or changes accounting.</p></div><span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${!privateEnabled ? "border-slate-400/20 bg-slate-400/[.06] text-slate-300" : settingsEnabled ? "border-emerald-300/20 bg-emerald-300/[.08] text-emerald-100" : "border-amber-300/20 bg-amber-300/[.08] text-amber-100"}`}>{!privateEnabled ? "OWNER AUTH REQUIRED" : settingsEnabled ? "AUTO PAPER ON" : "AUTO PAPER OFF"}</span></div>{!privateEnabled ? <div className="mt-4 rounded-xl border border-slate-400/15 bg-slate-400/[.045] p-4 text-xs text-slate-300">Sign in to view your private Auto Paper trials, journal, eligibility, and performance. Public opportunity cards remain available above.</div> : <><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-8">{metric("Active Trials", (performance?.active ?? activeTrials.length) || "UNAVAILABLE")}{metric("Today's simulated entries", todaysEntries)}{metric("Completed trials", (performance?.completed ?? completedTrials.length) || "UNAVAILABLE")}{metric("Targets reached", targetSummary)}{metric("Stops", stops ?? "UNAVAILABLE")}{metric("Invalidated", trials.filter(trial => String(trial.status).toUpperCase() === "INVALIDATED").length)}{metric("Data unavailable", trials.filter(trial => String(trial.status).toUpperCase() === "DATA_UNAVAILABLE").length)}{metric("Resumed", "See journal")}</div><div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">{metric("Win Rate", performance?.winRate == null ? "UNAVAILABLE" : `${performance.winRate.toFixed(1)}%`)}{metric("Average R", performance?.averageR == null ? "UNAVAILABLE" : performance.averageR.toFixed(2))}{metric("P&L", performance?.simulatedPnl ?? performance?.netPnl ?? "UNAVAILABLE")}{metric("Drawdown", maximumDrawdown == null ? "UNAVAILABLE" : money(-maximumDrawdown), "Server-derived maximum drawdown")}{metric("Sample Quality", sampleLabel, "Never labelled proven")}{metric("Journal rows", trials.length)}</div><div className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_.95fr]"><section className="rounded-xl border border-white/[.07] bg-white/[.018] p-3"><div className="flex items-center justify-between gap-2"><div><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-violet-200">JOURNAL</p><p className="mt-1 text-[11px] text-slate-500">Chronological persisted trials; select one to inspect its server event timeline.</p></div><span className="text-[10px] text-slate-500">{trials.length} rows</span></div><div className="mt-3 space-y-2">{trials.length ? trials.slice(0, 8).map(trial => <button type="button" key={trial.id} onClick={() => setSelectedTrialId(selectedTrialId === trial.id ? null : trial.id)} className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left ${selectedTrialId === trial.id ? "border-violet-300/35 bg-violet-300/[.08]" : "border-white/[.07] bg-white/[.02]"}`}><span className="min-w-0"><strong className="block truncate text-xs text-slate-200">{trial.assetId ?? "UNAVAILABLE"} · {trial.strategy ?? "UNAVAILABLE"}</strong><span className="block truncate text-[10px] text-slate-500">{displayDate(trial.createdAt)} · {trial.status ?? "UNAVAILABLE"}</span></span><ArrowRight className="h-3.5 w-3.5 shrink-0 text-violet-200" /></button>) : <p className="rounded-lg border border-dashed border-white/[.08] p-5 text-center text-xs text-slate-500">NO PERSISTED AUTO PAPER TRIALS</p>}</div></section><section className="rounded-xl border border-white/[.07] bg-white/[.018] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-violet-200">EVENT TIMELINE</p><p className="mt-1 text-[11px] text-slate-500">Server-returned events only.</p></div><span className="text-[10px] text-slate-500">{selectedTrialId == null ? "Select a trial" : `${eventRows.length} shown`}</span></div>{selectedTrialId !== null ? <><div className="mt-3 flex flex-wrap gap-1.5">{EVENT_FILTERS.map(value => <Button type="button" key={value} size="sm" variant="outline" onClick={() => setEventFilter(value)} className={`min-h-11 border-white/[.1] px-2 text-[9px] ${eventFilter === value ? "bg-violet-300/[.1] text-violet-100" : "text-slate-500"}`}>{value.replaceAll("_", " ")}</Button>)}</div>{eventsLoading ? <p className="mt-3 text-xs text-slate-500">Loading persisted events…</p> : eventRows.length ? <div className="mt-3 space-y-2">{eventRows.map((event, index) => <div key={`${event.id ?? index}-${event.eventType ?? event.type}`} className="rounded-lg border border-white/[.07] bg-white/[.02] p-3"><div className="flex items-center justify-between gap-2"><strong className="text-[10px] uppercase tracking-[.12em] text-violet-100">{event.eventType ?? event.type ?? event.status ?? "UNAVAILABLE"}</strong><span className="text-[10px] text-slate-600">{displayDate(event.createdAt)}</span></div>{event.message ? <p className="mt-1 text-xs text-slate-400">{event.message}</p> : null}</div>)}</div> : <p className="mt-3 rounded-lg border border-dashed border-white/[.08] p-5 text-center text-xs text-slate-500">NO EVENTS FOR SELECTED TRIAL</p>}</> : <p className="mt-4 rounded-lg border border-dashed border-white/[.08] p-6 text-center text-xs text-slate-500">Select an existing trial to view SETUP DETECTED, ENTRY SIMULATED, TARGET, STOP, INVALIDATION, DATA UNAVAILABLE, RESUMED, and COMPLETED events.</p>}</section></div></>}</section>;
}

function Loading() { return <div className="mt-5 grid min-h-40 place-items-center rounded-xl border border-white/[.07] bg-white/[.02] text-sm text-slate-400"><RefreshCw className="mr-2 h-4 w-4 animate-spin text-cyan-200" />Loading validated opportunity states…</div>; }
function ErrorState({ detail }: { detail: string }) { return <div role="alert" className="mt-5 flex gap-3 rounded-xl border border-rose-300/20 bg-rose-300/[.06] p-4 text-xs text-rose-100"><CircleAlert className="h-4 w-4 shrink-0" /><span><strong>OPPORTUNITY FEED UNAVAILABLE.</strong><br />{detail}</span></div>; }
