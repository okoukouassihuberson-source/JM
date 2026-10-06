"use client";
import { useTransition } from "react";
import { payOnlineAction } from "@/actions/account";
import { Icon } from "./ui/Icon";
import { useToast } from "./ui/Toast";

export function PayOnline({ number }: { number: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <button disabled={pending} className="btn-primary w-full" onClick={() => start(async () => {
      const r = await payOnlineAction(number);
      if (r.url) location.href = r.url; else toast(r.error ?? "Paiement indisponible", "error");
    })}><Icon name="lock" size={18} /> {pending ? "Redirection…" : "Payer maintenant"}</button>
  );
}
