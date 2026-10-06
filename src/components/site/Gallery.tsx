"use client";
import Image from "next/image";
import { useState } from "react";
import { Icon } from "../ui/Icon";

export function Gallery({ images, name, badge }: { images: { id: string; url: string; alt: string }[]; name: string; badge?: string }) {
  const [i, setI] = useState(0);
  const cur = images[i];
  return (
    <div className="space-y-3">
      <div className="relative aspect-square overflow-hidden rounded-3xl border border-line bg-electric-50 shadow-card lg:aspect-[4/3.4]">
        {cur ? <Image src={cur.url} alt={cur.alt || `${name} — JM Poissonnerie`} fill priority sizes="(max-width:1024px) 100vw, 600px" className="object-cover" quality={75} /> : <div className="grid h-full place-items-center text-electric-400"><Icon name="fish" size={72} /></div>}
        {badge && <span className="absolute left-0 top-5 rounded-r-full bg-promo-600 px-4 py-2 text-lg font-black text-white shadow-lg">{badge}</span>}
        <span className="absolute bottom-3 left-3 rounded-full bg-white/95 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-navy-900 shadow">Fraîcheur · Qualité · Confiance</span>
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {images.map((im, k) => (
            <button key={im.id} type="button" onClick={() => setI(k)} aria-label={`Photo ${k + 1}`} aria-current={k === i} className={`relative size-20 shrink-0 overflow-hidden rounded-xl border-2 ${k === i ? "border-electric-500" : "border-line"}`}>
              <Image src={im.url} alt="" fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
