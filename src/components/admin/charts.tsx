import { fcfa } from "@/lib/format";

const COLORS = ["#1e6bff", "#0a1a52", "#7db3ff", "#12318f", "#3f8bff", "#5b6785"];

const short = (n: number) => (n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(1)} M` : n >= 1000 ? `${Math.round(n / 1000)} k` : String(n));

/** Barres verticales SVG (sans JS) : revenu par jour. */
export function BarChart({ data, label = "FCFA" }: { data: { label: string; value: number; sub?: string }[]; label?: string }) {
  const W = 640, H = 220, L = 38, B = 26, T = 10;
  const max = Math.max(1, ...data.map((d) => d.value));
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const top = Math.ceil(max / step) * step;
  const bw = (W - L) / data.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Graphique ${label} par jour`}>
      {[0, 0.25, 0.5, 0.75, 1].map((t) => { const y = T + (H - B - T) * (1 - t); return <g key={t}><line x1={L} x2={W} y1={y} y2={y} stroke="#dde5f2" strokeDasharray={t ? "3 4" : ""} /><text x={L - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#5b6785">{short(top * t)}</text></g>; })}
      {data.map((d, i) => {
        const h = ((H - B - T) * d.value) / top, x = L + i * bw + bw * 0.18, y = H - B - h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw * 0.64} height={Math.max(h, 1)} rx={4} fill={i === data.length - 1 ? "#1e6bff" : "#7db3ff"}><title>{`${d.sub ?? d.label} : ${fcfa(d.value)}`}</title></rect>
            <text x={x + bw * 0.32} y={H - 8} textAnchor="middle" fontSize="10" fill="#5b6785">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function HBars({ data, unit = "FCFA", format }: { data: { label: string; value: number; hint?: string }[]; unit?: string; format?: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="space-y-3">
      {data.map((d, i) => (
        <li key={d.label}>
          <div className="mb-1 flex justify-between gap-2 text-sm"><span className="truncate font-semibold text-navy-900">{d.label}{d.hint && <span className="ml-1 text-xs font-normal text-muted">{d.hint}</span>}</span><span className="shrink-0 font-bold">{format ? format(d.value) : `${fcfa(d.value, false)} ${unit}`}</span></div>
          <div className="h-2.5 overflow-hidden rounded-full bg-electric-50"><div className="h-full rounded-full" style={{ width: `${(d.value / max) * 100}%`, background: COLORS[i % 2 ? 1 : 0] }} /></div>
        </li>
      ))}
    </ul>
  );
}

export function Donut({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const R = 52, C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative size-36 shrink-0">
        <svg viewBox="0 0 140 140" className="size-full -rotate-90" role="img" aria-label="Commandes par statut">
          <circle cx="70" cy="70" r={R} fill="none" stroke="#eef3fb" strokeWidth="18" />
          {data.filter((d) => d.value > 0).map((d) => { const len = (d.value / (total || 1)) * C; const el = <circle key={d.label} cx="70" cy="70" r={R} fill="none" stroke={d.color} strokeWidth="18" strokeDasharray={`${Math.max(len - 1.5, 0.5)} ${C}`} strokeDashoffset={-acc}><title>{`${d.label} : ${d.value}`}</title></circle>; acc += len; return el; })}
        </svg>
        <span className="h-display absolute inset-0 grid place-items-center text-3xl text-navy-900" style={{ textTransform: "none" }}>{total}</span>
      </div>
      <ul className="grid min-w-40 flex-1 gap-1.5 text-sm">{data.map((d) => <li key={d.label} className="flex items-center gap-2"><span className="size-3 shrink-0 rounded-full" style={{ background: d.color }} /><span className="flex-1 text-muted">{d.label}</span><b>{d.value}</b></li>)}</ul>
    </div>
  );
}

export function StatCard({ label, value, sub, icon, tone = "navy" }: { label: string; value: string; sub?: string; icon?: React.ReactNode; tone?: "navy" | "blue" | "red" | "green" | "orange" }) {
  const t = { navy: "bg-navy-900 text-white", blue: "bg-electric-100 text-electric-500", red: "bg-promo-50 text-promo-600", green: "bg-success-50 text-success-600", orange: "bg-warning-50 text-warning-600" }[tone];
  return (
    <div className="card flex items-center gap-4 p-4 sm:p-5">
      {icon && <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${t}`}>{icon}</span>}
      <div className="min-w-0"><p className="truncate text-[11px] font-bold uppercase tracking-wider text-muted">{label}</p><p className="h-display truncate text-2xl text-navy-900 sm:text-3xl" style={{ textTransform: "none" }}>{value}</p>{sub && <p className="truncate text-xs text-muted">{sub}</p>}</div>
    </div>
  );
}
