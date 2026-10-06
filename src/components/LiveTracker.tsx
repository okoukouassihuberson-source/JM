"use client";
import { useEffect, useState } from "react";
import { timeAgo } from "@/lib/format";
import { Icon } from "./ui/Icon";

type Pos = { lat: number; lng: number; updated_at: string } | null;

/** GPS temps réel OPTIONNEL : rien n'est chargé tant que le client ne l'active pas (économie de données). */
export function LiveTracker({ number, initial }: { number: string; initial: Pos }) {
  const [on, setOn] = useState(false);
  const [pos, setPos] = useState<Pos>(initial);
  const [status, setStatus] = useState<string>("");
  useEffect(() => {
    if (!on) return;
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch(`/api/track/${number}`, { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        if (stop) return;
        setPos(j.position); setStatus(j.status);
        if (j.status === "delivered") location.reload();
      } catch { /* réseau instable : on réessaie au prochain cycle */ }
    };
    tick();
    const t = setInterval(() => { if (!document.hidden) tick(); }, 20000);
    return () => { stop = true; clearInterval(t); };
  }, [on, number]);

  if (!on) return (
    <button type="button" onClick={() => setOn(true)} className="btn-outline w-full"><Icon name="map" size={18} /> Suivre mon livreur sur la carte</button>
  );
  const d = 0.008;
  return (
    <div className="space-y-2">
      {pos ? (
        <>
          <iframe title="Position du livreur" loading="lazy" className="h-64 w-full rounded-2xl border border-line"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${pos.lng - d},${pos.lat - d},${pos.lng + d},${pos.lat + d}&layer=mapnik&marker=${pos.lat},${pos.lng}`} />
          <p className="flex items-center justify-between text-xs text-muted"><span>Position mise à jour {timeAgo(pos.updated_at)}</span><button className="font-bold text-electric-500" onClick={() => setOn(false)}>Masquer la carte</button></p>
        </>
      ) : (
        <p className="rounded-2xl bg-electric-50 p-4 text-sm font-semibold text-navy-800">La position du livreur n&apos;est pas encore partagée. Elle s&apos;affichera automatiquement dès qu&apos;il l&apos;activera. {status && ""}</p>
      )}
    </div>
  );
}
