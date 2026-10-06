"use client";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Icon } from "./Icon";

type T = { id: number; msg: string; kind: "success" | "error" };
const Ctx = createContext<(msg: string, kind?: "success" | "error") => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<T[]>([]);
  const push = useCallback((msg: string, kind: "success" | "error" = "success") => {
    const id = Date.now() + Math.random();
    setItems((l) => [...l.slice(-2), { id, msg, kind }]);
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 3800);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[100] flex flex-col items-center gap-2 px-4 lg:bottom-6" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`pointer-events-auto flex max-w-sm animate-fade items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-pop ${t.kind === "error" ? "bg-promo-600" : "bg-navy-900"}`}>
            <Icon name={t.kind === "error" ? "alert" : "check"} size={18} />
            {t.msg}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
