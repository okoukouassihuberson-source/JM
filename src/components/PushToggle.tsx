"use client";
import { useEffect, useState, useTransition } from "react";
import { removePushSubscriptionAction, savePushSubscriptionAction, sendTestPushAction } from "@/actions/push";
import { Icon } from "./ui/Icon";
import { useToast } from "./ui/Toast";

const b64 = (s: string) => { const p = "=".repeat((4 - (s.length % 4)) % 4); const r = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(r, (c) => c.charCodeAt(0)); };

type State = "loading" | "unsupported" | "denied" | "off" | "on";

/** Active les notifications sur le téléphone, même application fermée (Web Push). */
export function PushToggle({ publicKey, className = "" }: { publicKey: string; className?: string }) {
  const [state, setState] = useState<State>("loading");
  const [pending, start] = useTransition();
  const toast = useToast();

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState("unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      setState((await reg?.pushManager.getSubscription()) ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  const enable = () => start(async () => {
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState(perm === "denied" ? "denied" : "off"); return toast("Autorisez les notifications pour recevoir les alertes.", "error"); }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const s = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(publicKey) }));
      const r = await savePushSubscriptionAction(JSON.parse(JSON.stringify(s)));
      if (r.error) return toast(r.error, "error");
      setState("on"); toast(r.message ?? "Alertes activées.");
    } catch (e: any) { toast(`Activation impossible : ${e?.message ?? "erreur"}`, "error"); }
  });
  const disable = () => start(async () => {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const s = await reg?.pushManager.getSubscription();
    if (s) { await removePushSubscriptionAction(s.endpoint); await s.unsubscribe(); }
    setState("off"); toast("Alertes désactivées sur cet appareil.");
  });
  const test = () => start(async () => { const r = await sendTestPushAction(); toast(r.error ?? r.message ?? "OK", r.error ? "error" : "success"); });

  if (state === "loading") return null;
  const msg = {
    unsupported: "Ce navigateur ne gère pas les notifications. Sur iPhone : ouvrez le site dans Safari, « Partager → Sur l'écran d'accueil », puis rouvrez-le depuis l'icône.",
    denied: "Notifications bloquées : autorisez-les dans les réglages du navigateur (cadenas à côté de l'adresse), puis rechargez.",
    off: "Recevez chaque nouvelle livraison même téléphone verrouillé.",
    on: "Alertes actives sur cet appareil.",
  }[state];
  return (
    <div className={`rounded-2xl border-2 p-3.5 ${state === "on" ? "border-success-600/30 bg-success-50" : "border-electric-400/40 bg-electric-50"} ${className}`}>
      <p className="flex items-start gap-2 text-sm font-semibold text-navy-900"><Icon name="bell" size={18} className="mt-0.5 shrink-0 text-electric-500" />{msg}</p>
      {state === "off" && <button onClick={enable} disabled={pending} className="btn-primary mt-3 w-full">{pending ? "Activation…" : "ACTIVER LES ALERTES"}</button>}
      {state === "on" && <div className="mt-3 grid grid-cols-2 gap-2"><button onClick={test} disabled={pending} className="btn-outline btn-sm">Envoyer un test</button><button onClick={disable} disabled={pending} className="btn-outline btn-sm">Désactiver</button></div>}
    </div>
  );
}
