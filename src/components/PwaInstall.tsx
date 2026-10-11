"use client";

import { useEffect, useRef, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const KEY = "jm_pwa_dismissed";
const SNOOZE_MS = 3 * 24 * 3600 * 1000;

function snoozed() {
  try { return Date.now() - Number(localStorage.getItem(KEY) || 0) < SNOOZE_MS; } catch { return false; }
}
function standalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

/** Enregistre le service worker sur toutes les pages et propose l'installation dès l'arrivée sur le site. */
export function PwaInstall() {
  const evt = useRef<InstallEvent | null>(null);
  const [mode, setMode] = useState<"android" | "ios" | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (standalone()) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      evt.current = e as InstallEvent;
      (window as unknown as { __jmInstall?: () => void }).__jmInstall = install;
      if (!snoozed()) setMode("android");
    };
    const onInstalled = () => { evt.current = null; setMode(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // iPhone/iPad : pas d'événement d'installation → on explique le geste (Safari uniquement).
    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
    if (ios && safari && !snoozed()) setMode("ios");

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    const e = evt.current;
    if (!e) return;
    await e.prompt();
    const { outcome } = await e.userChoice;
    evt.current = null;
    if (outcome === "dismissed") dismiss(); else setMode(null);
  }
  function dismiss() {
    try { localStorage.setItem(KEY, String(Date.now())); } catch { /* ignore */ }
    setMode(null);
  }

  if (!mode) return null;
  return (
    <div role="dialog" aria-label="Installer l'application" className="fixed inset-x-3 bottom-20 z-[60] mx-auto max-w-md rounded-2xl bg-[#0a1a52] p-4 text-white shadow-2xl ring-1 ring-white/15 md:bottom-4 md:left-auto md:right-4 md:mx-0">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" width={48} height={48} className="h-12 w-12 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="font-bold">Installer JM Poissonnerie</p>
          {mode === "android" ? (
            <p className="mt-0.5 text-sm text-white/80">Commandez plus vite et recevez les alertes de livraison, directement depuis l&apos;écran d&apos;accueil.</p>
          ) : (
            <p className="mt-0.5 text-sm text-white/80">Appuyez sur <b>Partager</b> (carré avec flèche) puis <b>« Sur l&apos;écran d&apos;accueil »</b>.</p>
          )}
        </div>
        <button onClick={dismiss} aria-label="Fermer" className="-mr-1 -mt-1 rounded-full p-1.5 text-white/70 hover:bg-white/10">✕</button>
      </div>
      {mode === "android" && (
        <div className="mt-3 flex gap-2">
          <button onClick={install} className="flex-1 rounded-xl bg-[#1e5bff] px-4 py-2.5 font-semibold">Installer</button>
          <button onClick={dismiss} className="rounded-xl px-4 py-2.5 text-white/80 hover:bg-white/10">Plus tard</button>
        </div>
      )}
    </div>
  );
}
