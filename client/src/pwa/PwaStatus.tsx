import { Button } from "@/components/ui/button";
import { RefreshCw, Wifi, WifiOff } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export const PWA_BUILD_ID = "crypto-hub-pwa-r3-20260825";

type PwaStatusValue = {
  online: boolean;
  connectionState: "ONLINE" | "RECONNECTING" | "DATA UNAVAILABLE" | "OFFLINE · READ ONLY";
  liveDataAvailable: boolean;
  lastOnlineAt: number | null;
  updateReady: boolean;
  activateUpdate: () => void;
  markReadSnapshot: (timestamp: number | null | undefined, hasLiveData?: boolean) => void;
  markLiveDataUnavailable: () => void;
};

const PwaStatusContext = createContext<PwaStatusValue | null>(null);

function getInitialLastOnlineAt() {
  try {
    const raw = sessionStorage.getItem("crypto-hub-last-online-at");
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

export function PwaStatusProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [lastOnlineAt, setLastOnlineAt] = useState<number | null>(getInitialLastOnlineAt);
  const [connectionState, setConnectionState] = useState<"ONLINE" | "RECONNECTING" | "DATA UNAVAILABLE" | "OFFLINE · READ ONLY">(() => typeof navigator === "undefined" || navigator.onLine ? "DATA UNAVAILABLE" : "OFFLINE · READ ONLY");
  const [liveDataAvailable, setLiveDataAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    const markOnline = () => {
      const now = Date.now();
      setOnline(true);
      setConnectionState("RECONNECTING");
      setLiveDataAvailable(false);
      setLastOnlineAt(now);
      try { sessionStorage.setItem("crypto-hub-last-online-at", String(now)); } catch { /* storage unavailable */ }
    };
    const markOffline = () => { setOnline(false); setConnectionState("OFFLINE · READ ONLY"); setLiveDataAvailable(false); };
    window.addEventListener("online", markOnline);
    window.addEventListener("offline", markOffline);
    if (navigator.onLine) markOnline();
    return () => { window.removeEventListener("online", markOnline); window.removeEventListener("offline", markOffline); };
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let disposed = false;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then(nextRegistration => {
      if (disposed) return;
      setRegistration(nextRegistration);
      if (nextRegistration.waiting) setUpdateReady(true);
      nextRegistration.addEventListener("updatefound", () => {
        const worker = nextRegistration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) setUpdateReady(true);
        });
      });
      void nextRegistration.update();
    }).catch(() => { /* PWA remains a normal browser application if registration is unavailable. */ });
    return () => { disposed = true; };
  }, []);

  const activateUpdate = useCallback(() => {
    if (!registration?.waiting) return;
    registration.waiting.postMessage({ type: "ACTIVATE_UPDATE" });
    navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), { once: true });
  }, [registration]);

  const markReadSnapshot = useCallback((timestamp: number | null | undefined, hasLiveData = false) => {
    if (!timestamp || !navigator.onLine) return;
    setLastOnlineAt(timestamp);
    setLiveDataAvailable(hasLiveData);
    setConnectionState(hasLiveData ? "ONLINE" : "DATA UNAVAILABLE");
    try { sessionStorage.setItem("crypto-hub-last-online-at", String(timestamp)); } catch { /* storage unavailable */ }
  }, []);

  const markLiveDataUnavailable = useCallback(() => {
    if (!navigator.onLine) return;
    setLiveDataAvailable(false);
    setConnectionState("DATA UNAVAILABLE");
  }, []);

  const value = useMemo(() => ({ online, connectionState, liveDataAvailable, lastOnlineAt, updateReady, activateUpdate, markReadSnapshot, markLiveDataUnavailable }), [online, connectionState, liveDataAvailable, lastOnlineAt, updateReady, activateUpdate, markReadSnapshot, markLiveDataUnavailable]);
  return <PwaStatusContext.Provider value={value}>{children}</PwaStatusContext.Provider>;
}

export function usePwaStatus() {
  const value = useContext(PwaStatusContext);
  if (!value) throw new Error("usePwaStatus must be used inside PwaStatusProvider.");
  return value;
}

export function PwaStatusBanner() {
  const { online, connectionState, lastOnlineAt, updateReady, activateUpdate } = usePwaStatus();
  const lastUpdated = lastOnlineAt ? new Date(lastOnlineAt).toLocaleString() : "UNAVAILABLE";
  if (connectionState === "ONLINE" && !updateReady) return null;
  const offline = connectionState === "OFFLINE · READ ONLY";
  const reconnecting = connectionState === "RECONNECTING";
  return <div role="status" aria-live="polite" className={`fixed inset-x-0 top-0 z-[100] border-b px-4 py-2 text-xs shadow-lg backdrop-blur ${offline ? "border-amber-300/25 bg-[#241c08]/95 text-amber-50" : "border-cyan-300/25 bg-[#071b27]/95 text-cyan-50"}`}>
    <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-2">
      {offline ? <span className="flex items-center gap-2"><WifiOff className="h-3.5 w-3.5" /><strong>OFFLINE · READ ONLY</strong><span className="text-amber-100/75">LAST UPDATED: {lastUpdated} · LIVE DATA UNAVAILABLE · Paper Trading requires a live connection to Crypto Hub.</span></span> : reconnecting ? <span className="flex items-center gap-2"><RefreshCw className="h-3.5 w-3.5 animate-spin" /><strong>RECONNECTING</strong><span className="text-cyan-100/75">Network access returned; waiting for a server-validated live-data response.</span></span> : connectionState === "DATA UNAVAILABLE" ? <span className="flex items-center gap-2"><Wifi className="h-3.5 w-3.5" /><strong>DATA UNAVAILABLE</strong><span className="text-cyan-100/75">Network is available, but current server-validated live market data is unavailable.</span></span> : <span className="flex items-center gap-2"><RefreshCw className="h-3.5 w-3.5" /><strong>UPDATE READY</strong><span className="text-cyan-100/75">A newer app shell is available. Reload only when you are not confirming a Paper Trade or Research action.</span></span>}
      {online && updateReady ? <Button size="sm" onClick={activateUpdate} className="h-7 bg-cyan-300 px-2.5 text-[11px] text-slate-950 hover:bg-cyan-200">Reload to update</Button> : null}
    </div>
  </div>;
}

export function OnlineStatusLabel() {
  const { connectionState } = usePwaStatus();
  const online = connectionState === "ONLINE";
  const offline = connectionState === "OFFLINE · READ ONLY";
  return <span aria-label={`Connection state: ${connectionState}`} className={`flex items-center gap-1.5 text-[10px] ${online ? "text-emerald-300" : offline ? "text-amber-200" : "text-cyan-200"}`}>{offline ? <WifiOff className="h-3.5 w-3.5" /> : connectionState === "RECONNECTING" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}{connectionState}</span>;
}
