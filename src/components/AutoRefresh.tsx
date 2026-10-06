"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Rafraîchit les données serveur périodiquement (onglet visible uniquement) — suivi sans websocket. */
export function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) router.refresh(); }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
