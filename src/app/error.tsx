"use client";
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-navy-950 px-4 text-center text-white">
      <div><h1 className="h-display text-5xl">Oups, un incident</h1><p className="mt-2 text-white/70">Une erreur est survenue. Réessayez dans un instant.</p><button onClick={reset} className="btn-primary mt-6">Réessayer</button></div>
    </div>
  );
}
