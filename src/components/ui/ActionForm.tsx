"use client";
import { createContext, startTransition, useActionState, useContext, useRef, useTransition, type ReactNode } from "react";
import { useToast } from "./Toast";
import { Icon } from "./Icon";

export type ActionState = { ok?: boolean; error?: string; message?: string; n?: number };
type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

const Pending = createContext(false);
export const usePending = () => useContext(Pending);

/** Formulaire branché sur une server action : conserve les valeurs saisies en cas d'erreur, affiche erreurs et confirmations. */
export function ActionForm({ action, children, className, reset, successToast = true }: { action: Action; children: ReactNode; className?: string; reset?: boolean; successToast?: boolean }) {
  const toast = useToast();
  const ref = useRef<HTMLFormElement>(null);
  // Le toast est émis ici (et non dans un effet) : il survit si la revalidation démonte le formulaire.
  const [state, run, pending] = useActionState(async (prev: ActionState, fd: FormData) => {
    const r = await action(prev, fd);
    if (r.message && successToast) toast(r.message, "success");
    if (r.ok && reset) ref.current?.reset();
    return r;
  }, {} as ActionState);
  return (
    <Pending.Provider value={pending}>
      <form ref={ref} className={className} onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => run(fd)); }}>
        {state.error && (
          <p role="alert" className="mb-4 flex items-start gap-2 rounded-xl bg-promo-50 px-3.5 py-3 text-sm font-semibold text-promo-600">
            <Icon name="alert" size={18} className="mt-0.5 shrink-0" /> {state.error}
          </p>
        )}
        {children}
      </form>
    </Pending.Provider>
  );
}

export function Submit({ children, className = "btn-primary", pendingText = "Patientez…", disabled }: { children: ReactNode; className?: string; pendingText?: string; disabled?: boolean }) {
  const pending = usePending();
  return (
    <button type="submit" disabled={pending || disabled} className={className}>
      {pending ? (<><span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />{pendingText}</>) : children}
    </button>
  );
}

/** Bouton qui exécute directement une action (sans formulaire), avec état de chargement et confirmation optionnelle. */
export function ActionButton({ action, args = [], children, className = "btn-outline btn-sm", confirm, successToast = true, onDone }: { action: (...a: any[]) => Promise<ActionState | void>; args?: unknown[]; children: ReactNode; className?: string; confirm?: string; successToast?: boolean; onDone?: () => void }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} className={className}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        start(async () => {
          const r = (await action(...args)) ?? {};
          if (r.error) toast(r.error, "error");
          else if (r.message && successToast) toast(r.message, "success");
          if (!r.error) onDone?.();
        });
      }}>
      {pending ? <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : children}
    </button>
  );
}
