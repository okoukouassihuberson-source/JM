"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "../ui/Icon";

/** Partage de position OPTIONNEL (limite la consommation de données : 1 envoi / 25 s, uniquement pendant une livraison). */
export function GpsToggle({ active }: { active: boolean }) {
  const [on, setOn] = useState(false);
  const [msg, setMsg] = useState("");
  const last = useRef(0);
  useEffect(() => { try { setOn(localStorage.getItem("jm_gps") === "1"); } catch {} }, []);
  useEffect(() => {
    if (!on || !active || !("geolocation" in navigator)) return;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        if (Date.now() - last.current < 25000) return;
        last.current = Date.now();
        fetch("/api/driver/location", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lat: p.coords.latitude, lng: p.coords.longitude }) })
          .then((r) => setMsg(r.ok ? "Position partagée" : "Envoi impossible")).catch(() => setMsg("Hors connexion"));
      },
      () => setMsg("Autorisez la localisation"), { enableHighAccuracy: true, maximumAge: 15000 });
    return () => navigator.geolocation.clearWatch(id);
  }, [on, active]);
  const toggle = () => { const n = !on; setOn(n); try { localStorage.setItem("jm_gps", n ? "1" : "0"); } catch {} setMsg(""); };
  return (
    <button type="button" onClick={toggle} aria-pressed={on} className={`flex w-full items-center justify-between gap-3 rounded-2xl border-2 p-3.5 text-left transition ${on ? "border-electric-500 bg-electric-50" : "border-line bg-white"}`}>
      <span className="flex items-center gap-3"><Icon name="map" className={on ? "text-electric-500" : "text-muted"} /><span><b className="block text-sm text-navy-900">Partager ma position (GPS)</b><span className="text-xs text-muted">{on ? msg || (active ? "Actif pendant la livraison" : "S'active dès votre départ") : "Facultatif — économise vos données"}</span></span></span>
      <span className={`h-6 w-11 rounded-full p-0.5 transition ${on ? "bg-electric-500" : "bg-slate-300"}`}><span className={`block size-5 rounded-full bg-white transition ${on ? "translate-x-5" : ""}`} /></span>
    </button>
  );
}
