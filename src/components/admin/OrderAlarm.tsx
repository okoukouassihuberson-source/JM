"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "../ui/Icon";

type Item = { id: string; title: string; body?: string; link?: string | null; type?: string };

const MUTE_KEY = "jm_alarm_muted";
const RING_EVERY_MS = 3000;
const RING_MAX_MS = 90_000;

function readMuted() { try { return localStorage.getItem(MUTE_KEY) === "1"; } catch { return false; } }

/**
 * Sonnerie d'alerte pour l'admin : à chaque nouvelle commande (ou versement à approuver), une sonnerie
 * se répète toutes les 3 s avec un bandeau rouge jusqu'à ce que l'admin appuie sur « Arrêter » ou ouvre la commande.
 * Les navigateurs interdisent le son tant que la page n'a pas reçu un toucher : un bouton « Activer » est affiché tant que c'est le cas.
 */
export function OrderAlarm() {
  const path = usePathname();
  const ctx = useRef<AudioContext | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopAt = useRef(0);
  const [unlocked, setUnlocked] = useState(false);
  const [muted, setMuted] = useState(false);
  const [ringing, setRinging] = useState<Item[]>([]);
  const mutedRef = useRef(false);

  useEffect(() => { const m = readMuted(); setMuted(m); mutedRef.current = m; }, []);

  const ensureCtx = useCallback(async () => {
    try {
      if (!ctx.current) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ctx.current = new AC();
      }
      if (ctx.current.state === "suspended") await ctx.current.resume();
      setUnlocked(ctx.current.state === "running");
    } catch { /* audio indisponible */ }
  }, []);

  // Tout toucher / clic / touche débloque le son (exigence des navigateurs).
  useEffect(() => {
    const on = () => { void ensureCtx(); };
    const evs = ["pointerdown", "keydown", "touchstart"] as const;
    evs.forEach((e) => window.addEventListener(e, on, { passive: true }));
    return () => evs.forEach((e) => window.removeEventListener(e, on));
  }, [ensureCtx]);

  const ring = useCallback(() => {
    const c = ctx.current;
    if (!c || c.state !== "running" || mutedRef.current) return;
    // « ding-dong » ×2, fort, impossible à confondre avec une notification ordinaire
    const seq: [number, number][] = [[988, 0], [740, 0.28], [988, 0.7], [740, 0.98]];
    for (const [f, t] of seq) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = "square"; o.frequency.value = f;
      o.connect(g); g.connect(c.destination);
      const t0 = c.currentTime + t;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.26);
      o.start(t0); o.stop(t0 + 0.28);
    }
    if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.([300, 150, 300]);
  }, []);

  const stop = useCallback(() => {
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
    setRinging([]);
  }, []);

  const start = useCallback((items: Item[]) => {
    setRinging((prev) => [...items, ...prev.filter((p) => !items.some((i) => i.id === p.id))].slice(0, 5));
    stopAt.current = Date.now() + RING_MAX_MS;
    if (timer.current) return;
    ring();
    timer.current = setInterval(() => { if (Date.now() > stopAt.current) stop(); else ring(); }, RING_EVERY_MS);
  }, [ring, stop]);

  useEffect(() => {
    const h = (e: Event) => start((e as CustomEvent<Item[]>).detail);
    window.addEventListener("jm:alarm", h);
    return () => { window.removeEventListener("jm:alarm", h); if (timer.current) clearInterval(timer.current); };
  }, [start]);

  // Ouvrir la commande concernée = alerte prise en compte.
  useEffect(() => { if (ringing.length && ringing.some((r) => r.link && path === r.link)) stop(); }, [path, ringing, stop]);

  // Titre d'onglet clignotant tant que ça sonne.
  useEffect(() => {
    if (!ringing.length) return;
    const base = document.title; let on = false;
    const t = setInterval(() => { on = !on; document.title = on ? "🔔 NOUVELLE COMMANDE" : base; }, 1000);
    return () => { clearInterval(t); document.title = base; };
  }, [ringing.length]);

  const toggleMute = () => {
    const m = !muted; setMuted(m); mutedRef.current = m;
    try { localStorage.setItem(MUTE_KEY, m ? "1" : "0"); } catch { /* ignore */ }
    if (m) stop(); else void ensureCtx();
  };

  return (
    <>
      {ringing.length > 0 && (
        <div role="alert" className="fixed inset-x-3 top-16 z-[70] mx-auto max-w-xl animate-pulse-ring rounded-2xl bg-promo-600 p-4 text-white shadow-pop ring-4 ring-white/70 lg:top-20">
          <p className="flex items-center gap-2 text-lg font-extrabold"><Icon name="bell" /> {ringing[0].title}{ringing.length > 1 ? ` (+${ringing.length - 1})` : ""}</p>
          {ringing[0].body && <p className="mt-0.5 text-sm text-white/90">{ringing[0].body}</p>}
          {!unlocked && !muted && <p className="mt-1 text-xs font-bold">Touchez l&apos;écran pour activer le son.</p>}
          <div className="mt-3 flex gap-2">
            {ringing[0].link && <Link href={ringing[0].link} onClick={stop} className="btn btn-sm flex-1 bg-white text-promo-600">Voir la commande</Link>}
            <button onClick={stop} className="btn btn-sm border-2 border-white/70 text-white">Arrêter la sonnerie</button>
          </div>
        </div>
      )}
      <div className="fixed bottom-3 left-3 z-40 flex items-center gap-2 lg:left-[17rem]">
        {!unlocked && !muted ? (
          <button onClick={() => void ensureCtx()} className="btn btn-sm animate-pulse bg-promo-600 text-white shadow-pop"><Icon name="bell" size={16} /> Activer la sonnerie des commandes</button>
        ) : (
          <div className="flex items-center gap-1 rounded-full bg-navy-900 px-3 py-1.5 text-xs font-bold text-white shadow-pop">
            <span aria-hidden>{muted ? "🔕" : "🔔"}</span> Sonnerie {muted ? "coupée" : "active"}
            {!muted && <button onClick={() => { void ensureCtx().then(ring); }} className="ml-2 underline">Tester</button>}
            <button onClick={toggleMute} className="ml-2 underline">{muted ? "Réactiver" : "Couper"}</button>
          </div>
        )}
      </div>
    </>
  );
}
