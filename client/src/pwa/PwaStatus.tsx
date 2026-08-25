import { Button } from "@/components/ui/button";
import { RefreshCw, Wifi, WifiOff } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export const PWA_BUILD_ID = "crypto-hub-pwa-r2-20260825";

type PwaStatusValue = {
  online: boolean;
  lastOnlineAt: number | null;
  updateReady: boolean;
  activateUpdate: () => void;
  markReadSnapshot: (timestamp: number | null | undefined) => void;
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
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    const markOnline = () => {
      const now = Date.now();
      setOnline(true);
      setLastOnlineAt(now);
      try { sessionStorage.setItem("crypto-hub-last-online-at", String(now)); } catch { /* storage unavailable */ }
    };
    const markOffline = () => setOnline(false);
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

  const markReadSnapshot = useCallback((timestamp: number | null | undefined) => {
    if (!timestamp || !navigator.onLine) return;
    setLastOnlineAt(timestamp);
    try { sessionStorage.setItem("crypto-hub-last-online-at", String(timestamp)); } catch { /* storage unavailable */ }
  }, []);

  const value = useMemo(() => ({ online, lastOnlineAt, updateReady, activateUpdate, markReadSnapshot }), [online, lastOnlineAt, updateReady, activateUpdate, markReadSnapshot]);
  return <PwaStatusContext.Provider value={value}>{children}</PwaStatusContext.Provider>;
}

export function usePwaStatus() {
  const value = useContext(PwaStatusContext);
  if (!value) throw new Error("usePwaStatus must be used inside PwaStatusProvider.");
  return value;
}

export function PwaStatusBanner() {
  const { online, lastOnlineAt, updateReady, activateUpdate } = usePwaStatus();
  const lastUpdated = lastOnlineAt ? new Date(lastOnlineAt).toLocaleString() : "UNAVAILABLE";
  if (online && !updateReady) return null;
  return <div role="status" aria-live="polite" className={`fixed inset-x-0 top-0 z-[100] border-b px-4 py-2 text-xs shadow-lg backdrop-blur ${online ? "border-cyan-300/25 bg-[#071b27]/95 text-cyan-50" : "border-amber-300/25 bg-[#241c08]/95 text-amber-50"}`}>
    <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-2">
      {online ? <span className="flex items-center gap-2"><RefreshCw className="h-3.5 w-3.5" /><strong>UPDATE READY</strong><span className="text-cyan-100/75">A newer app shell is available. Reload only when you are not confirming a Paper Trade or Research action.</span></span> : <span className="flex items-center gap-2"><WifiOff className="h-3.5 w-3.5" /><strong>OFFLINE · READ ONLY</strong><span className="text-amber-100/75">LAST UPDATED: {lastUpdated} · LIVE DATA UNAVAILABLE · Paper Trading requires a live connection to Crypto Hub.</span></span>}
      {online && updateReady ? <Button size="sm" onClick={activateUpdate} className="h-7 bg-cyan-300 px-2.5 text-[11px] text-slate-950 hover:bg-cyan-200">Reload to update</Button> : null}
    </div>
  </div>;
}

export function OnlineStatusLabel() {
  const { online } = usePwaStatus();
  return <span className={`flex items-center gap-1.5 text-[10px] ${online ? "text-emerald-300" : "text-amber-200"}`}><span className="sr-only">{online ? "Online" : "Offline"}</span>{online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}{online ? "ONLINE" : "OFFLINE"}</span>;
}
