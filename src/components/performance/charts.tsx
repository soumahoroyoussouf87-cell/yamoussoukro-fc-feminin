"use client";

import { useState } from "react";
import { CONTEXT_LABELS, type Context } from "@/lib/performance/engine";

const fmt = (n: number) => String(n).replace(".", ",");

/** Radar 6 dimensions (0-100). Une seule série : le titre de la carte la nomme. */
export function Radar({ axes, size = 280 }: { axes: { label: string; value: number | null; n?: number }[]; size?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const c = size / 2;
  const r = c - 40;
  const padX = 70; // place pour les libellés latéraux (« Comportementale »)
  const N = axes.length;
  const pt = (i: number, v: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / N;
    return [c + Math.cos(a) * r * (v / 100), c + Math.sin(a) * r * (v / 100)] as const;
  };
  const rings = [20, 40, 60, 80, 100];
  const known = axes.map((a, i) => ({ ...a, i })).filter((a) => a.value != null);
  const poly = known.length >= 3 ? known.map((a) => pt(a.i, a.value!).join(",")).join(" ") : null;
  return (
    <figure className="relative">
      <svg viewBox={`${-padX} 0 ${size + 2 * padX} ${size}`} className="mx-auto w-full max-w-[400px]" role="img"
        aria-label={`Radar : ${axes.map((a) => `${a.label} ${a.value == null ? "non évalué" : fmt(a.value)}`).join(", ")}`}>
        {rings.map((v) => (
          <polygon key={v} points={axes.map((_, i) => pt(i, v).join(",")).join(" ")} fill="none" stroke="currentColor" className="text-border" strokeWidth={v === 100 ? 1.2 : 0.8} />
        ))}
        {axes.map((_, i) => {
          const [x, y] = pt(i, 100);
          return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="currentColor" className="text-border" strokeWidth={0.8} />;
        })}
        {[60, 100].map((v) => {
          const [, y] = pt(0, v);
          return <text key={v} x={c + 4} y={y + 10} fontSize={9} className="fill-muted-foreground">{v}</text>;
        })}
        {poly ? <polygon points={poly} fill="var(--color-fuchsia)" fillOpacity={0.18} stroke="var(--color-fuchsia)" strokeWidth={2} strokeLinejoin="round" /> : null}
        {known.map((a) => {
          const [x, y] = pt(a.i, a.value!);
          return (
            <g key={a.i} onMouseEnter={() => setHover(a.i)} onMouseLeave={() => setHover(null)}>
              <circle cx={x} cy={y} r={12} fill="transparent" />
              <circle cx={x} cy={y} r={hover === a.i ? 6 : 4.5} fill="var(--color-fuchsia)" stroke="var(--color-card)" strokeWidth={2} />
            </g>
          );
        })}
        {axes.map((a, i) => {
          const [x, y] = pt(i, 118);
          const anchor = Math.abs(x - c) < 4 ? "middle" : x > c ? "start" : "end";
          return (
            <text key={i} x={x} y={y} textAnchor={anchor} dominantBaseline="middle" fontSize={11} className="fill-foreground font-semibold">
              <tspan x={x} dy={-6}>{a.label}</tspan>
              <tspan x={x} dy={13} className={a.value == null ? "fill-muted-foreground font-normal" : "fill-foreground"}>{a.value == null ? "N/E" : fmt(a.value)}</tspan>
            </text>
          );
        })}
      </svg>
      {hover != null && axes[hover].value != null ? (
        <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-md border bg-card px-2 py-1 text-xs shadow">
          <strong>{axes[hover].label}</strong> : {fmt(axes[hover].value!)}{axes[hover].n != null ? ` · ${axes[hover].n} évaluation(s)` : ""}
        </div>
      ) : null}
    </figure>
  );
}

/** Courbe de progression : indice de chaque évaluation validée, dans l'ordre chronologique. */
export function Progression({ points }: { points: { id: string; date: string; context: Context; value: number | null; title?: string }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const data = points.filter((p) => p.value != null) as { id: string; date: string; context: Context; value: number; title?: string }[];
  if (data.length < 2) return <p className="text-sm text-muted-foreground">La courbe apparaît à partir de deux évaluations validées.</p>;
  const W = 640;
  const H = 220;
  const pad = { l: 34, r: 12, t: 12, b: 28 };
  const x = (i: number) => pad.l + (i * (W - pad.l - pad.r)) / (data.length - 1);
  const y = (v: number) => pad.t + ((100 - v) * (H - pad.t - pad.b)) / 100;
  const path = data.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.value)}`).join(" ");
  const h = hover != null ? data[hover] : null;
  return (
    <figure className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Progression : ${data.map((d) => `${d.date} ${fmt(d.value)}`).join(", ")}`}
        onMouseLeave={() => setHover(null)}>
        {[20, 40, 60, 80, 100].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="currentColor" className="text-border" strokeWidth={0.8} />
            <text x={pad.l - 6} y={y(v)} textAnchor="end" dominantBaseline="middle" fontSize={10} className="fill-muted-foreground">{v}</text>
          </g>
        ))}
        {hover != null ? <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="currentColor" className="text-muted-foreground" strokeWidth={1} strokeDasharray="3 3" /> : null}
        <path d={path} fill="none" stroke="var(--color-fuchsia)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => (
          <g key={d.id} onMouseEnter={() => setHover(i)}>
            <rect x={x(i) - (W - pad.l - pad.r) / (2 * (data.length - 1))} y={pad.t} width={(W - pad.l - pad.r) / (data.length - 1)} height={H - pad.t - pad.b} fill="transparent" />
            <circle cx={x(i)} cy={y(d.value)} r={hover === i ? 6 : 4} fill={d.context === "match" ? "var(--color-fuchsia)" : "var(--color-card)"} stroke="var(--color-fuchsia)" strokeWidth={2} />
          </g>
        ))}
        <text x={pad.l} y={H - 8} fontSize={10} className="fill-muted-foreground">{data[0].date.split("-").reverse().join("/")}</text>
        <text x={W - pad.r} y={H - 8} textAnchor="end" fontSize={10} className="fill-muted-foreground">{data.at(-1)!.date.split("-").reverse().join("/")}</text>
      </svg>
      {h ? (
        <div className="pointer-events-none absolute top-0 rounded-md border bg-card px-2 py-1 text-xs shadow"
          style={{ left: `${(x(hover!) / W) * 100}%`, transform: `translateX(${hover! > data.length / 2 ? "-105%" : "5%"})` }}>
          <strong>{fmt(h.value)}</strong> · {h.date.split("-").reverse().join("/")}<br />{CONTEXT_LABELS[h.context]}{h.title ? ` · ${h.title}` : ""}
        </div>
      ) : null}
      <figcaption className="mt-1 flex gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><span className="inline-block size-2.5 rounded-full bg-fuchsia" />Compétition</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block size-2.5 rounded-full border-2 border-fuchsia" />Entraînement</span>
      </figcaption>
    </figure>
  );
}
