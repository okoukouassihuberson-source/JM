"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./ui/Icon";
import { useToast } from "./ui/Toast";

function beep() {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AC();
    [0, 0.22].forEach((t) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 880; o.connect(g); g.connect(ctx.destination); g.gain.setValueAtTime(0.18, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.18); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.2); });
  } catch { /* audio bloqué avant la première interaction */ }
}

/** Cloche avec pastille + alerte immédiate (son, vibration, toast) quand une nouvelle notification arrive, page ouverte. */
export function NotificationBell({ initial, href = "/mon-espace/notifications", refreshOnNew = true, seconds = 12 }: { initial: number; href?: string; refreshOnNew?: boolean; seconds?: number }) {
  const [unread, setUnread] = useState(initial);
  const since = useRef<string | null>(null);
  const toast = useToast();
  const router = useRouter();
  useEffect(() => setUnread(initial), [initial]);
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      if (document.hidden) return;
      try {
        const r = await fetch(`/api/notifications/poll${since.current ? `?since=${encodeURIComponent(since.current)}` : ""}`, { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        if (stop) return;
        setUnread(j.unread);
        if (since.current && j.items.length) {
          beep(); navigator.vibrate?.([250, 120, 250]);
          toast(j.items[0].title + (j.items.length > 1 ? ` (+${j.items.length - 1})` : ""));
          if (refreshOnNew) router.refresh();
        }
        since.current = j.now;
      } catch { /* réseau instable */ }
    };
    tick();
    const t = setInterval(tick, seconds * 1000);
    const vis = () => !document.hidden && tick();
    document.addEventListener("visibilitychange", vis);
    return () => { stop = true; clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  }, [seconds, refreshOnNew, router, toast]);
  return (
    <Link href={href} className="relative grid size-10 place-items-center rounded-full hover:bg-white/10" aria-label={`Notifications${unread ? `, ${unread} non lue${unread > 1 ? "s" : ""}` : ""}`}>
      <Icon name="bell" />
      {unread > 0 && <span key={unread} className="absolute right-0 top-0 grid min-w-5 animate-pulse-ring place-items-center rounded-full bg-promo-600 px-1 text-[11px] font-extrabold text-white">{unread > 9 ? "9+" : unread}</span>}
    </Link>
  );
}
