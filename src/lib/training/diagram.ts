/**
 * Schéma tactique 2D — modèle de données éditable et géométrie de rendu.
 * Le même calcul de formes (« shapes ») sert à l'éditeur (SVG), aux exports d'image et aux PDF.
 * Unités : 10 unités = 1 mètre.
 */
import { z } from "zod";

export type Pt = { x: number; y: number };
export type PitchKind = "full" | "half" | "third" | "box" | "blank";
export type PitchStyle = "grass" | "stripes" | "plain";
export type Team = "a" | "b" | "c" | "gk";
export type EquipKind = "ball" | "cone" | "disc" | "mannequin" | "minigoal" | "goal" | "pole" | "ladder" | "hurdle";
export type ArrowKind = "run" | "pass" | "dribble" | "shot";

export type PlayerItem = { id: string; type: "player"; x: number; y: number; team: Team; label: string };
export type EquipItem = { id: string; type: EquipKind; x: number; y: number; rot?: number; color?: string };
export type ArrowItem = { id: string; type: "arrow"; kind: ArrowKind; from: Pt; to: Pt; ctrl?: Pt | null; color?: string };
export type ZoneItem = { id: string; type: "zone"; shape: "rect" | "ellipse"; x: number; y: number; w: number; h: number; color: string; hatch: boolean; label?: string };
export type TextItem = { id: string; type: "text"; x: number; y: number; text: string; size: number; color: string };
export type DimItem = { id: string; type: "dim"; from: Pt; to: Pt; label: string };
export type Item = PlayerItem | EquipItem | ArrowItem | ZoneItem | TextItem | DimItem;

export type Frame = { id: string; pos: Record<string, Pt> };
export type Diagram = {
  v: 1;
  pitch: { kind: PitchKind; style: PitchStyle; label?: string };
  items: Item[];
  frames: Frame[];
};

export const TEAM_COLORS: Record<Team, { fill: string; text: string; label: string }> = {
  a: { fill: "#E6007E", text: "#ffffff", label: "Équipe YFC" },
  b: { fill: "#1d4ed8", text: "#ffffff", label: "Équipe adverse" },
  c: { fill: "#facc15", text: "#111827", label: "Jokers / neutres" },
  gk: { fill: "#16a34a", text: "#ffffff", label: "Gardienne" },
};
export const PALETTE = ["#ffffff", "#111827", "#E6007E", "#1d4ed8", "#facc15", "#f97316", "#16a34a", "#ef4444"];
export const EQUIP_LABELS: Record<EquipKind, string> = {
  ball: "Ballon", cone: "Plot", disc: "Coupelle", mannequin: "Mannequin", minigoal: "Mini-but", goal: "But", pole: "Piquet", ladder: "Échelle", hurdle: "Haie",
};
export const ARROW_LABELS: Record<ArrowKind, string> = { run: "Déplacement", pass: "Passe", dribble: "Conduite", shot: "Frappe" };
export const PITCH_LABELS: Record<PitchKind, string> = { full: "Terrain entier", half: "Demi-terrain", third: "Tiers offensif", box: "Surface de réparation", blank: "Zone libre" };

export function pitchSize(kind: PitchKind) {
  switch (kind) {
    case "full": return { w: 1050, h: 680 };
    case "half": return { w: 680, h: 525 };
    case "third": return { w: 680, h: 350 };
    case "box": return { w: 680, h: 240 };
    default: return { w: 1000, h: 650 };
  }
}

export const newId = () => Math.random().toString(36).slice(2, 10);

export function emptyDiagram(kind: PitchKind = "half"): Diagram {
  return { v: 1, pitch: { kind, style: "stripes" }, items: [], frames: [{ id: newId(), pos: {} }] };
}

/** Éléments positionnés par un point (animables). */
export const isPointItem = (i: Item): i is PlayerItem | EquipItem | TextItem => "x" in i && i.type !== "zone";

/** Position d'un élément dans une étape (les étapes ne stockent que les déplacements). */
export function posAt(d: Diagram, item: PlayerItem | EquipItem | TextItem, frame: number): Pt {
  for (let k = Math.min(frame, d.frames.length - 1); k >= 1; k--) {
    const p = d.frames[k]?.pos[item.id];
    if (p) return p;
  }
  return { x: item.x, y: item.y };
}

/** Interpolation entre deux étapes (animation). */
export function posBetween(d: Diagram, item: PlayerItem | EquipItem | TextItem, frame: number, t: number): Pt {
  const a = posAt(d, item, frame);
  if (t <= 0 || frame + 1 >= d.frames.length) return a;
  const b = posAt(d, item, frame + 1);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

// ------------------------------------------------------------------ Formes primitives
export type Shape =
  | { k: "rect"; x: number; y: number; w: number; h: number; fill?: string; stroke?: string; sw?: number; rx?: number; dash?: string; opacity?: number }
  | { k: "circle"; cx: number; cy: number; r: number; fill?: string; stroke?: string; sw?: number; opacity?: number }
  | { k: "ellipse"; cx: number; cy: number; rx: number; ry: number; fill?: string; stroke?: string; sw?: number; dash?: string; opacity?: number }
  | { k: "line"; x1: number; y1: number; x2: number; y2: number; stroke: string; sw: number; dash?: string; opacity?: number }
  | { k: "path"; d: string; fill?: string; stroke?: string; sw?: number; dash?: string; opacity?: number }
  | { k: "polygon"; points: string; fill: string; stroke?: string; sw?: number }
  | { k: "text"; x: number; y: number; text: string; size: number; fill: string; weight?: 400 | 700; anchor?: "start" | "middle" | "end" };

const LINE = "rgba(255,255,255,0.9)";

export function pitchShapes(p: Diagram["pitch"]): Shape[] {
  const { w, h } = pitchSize(p.kind);
  const s: Shape[] = [];
  const base = p.style === "plain" ? "#ffffff" : "#3f9a3a";
  const line = p.style === "plain" ? "#94a3b8" : LINE;
  s.push({ k: "rect", x: 0, y: 0, w, h, fill: base });
  if (p.style === "stripes") {
    const n = 10;
    const horizontal = p.kind !== "full";
    for (let i = 0; i < n; i += 2) {
      if (horizontal) s.push({ k: "rect", x: 0, y: (h / n) * i, w, h: h / n, fill: "#4aa843" });
      else s.push({ k: "rect", x: (w / n) * i, y: 0, w: w / n, h, fill: "#4aa843" });
    }
  }
  const m = 15; // marge
  const sw = 3;
  if (p.kind === "blank") {
    s.push({ k: "rect", x: m, y: m, w: w - 2 * m, h: h - 2 * m, stroke: line, sw, fill: "none" });
    return s;
  }
  if (p.kind === "full") {
    const L = w - 2 * m, H = h - 2 * m;
    s.push({ k: "rect", x: m, y: m, w: L, h: H, stroke: line, sw, fill: "none" });
    s.push({ k: "line", x1: w / 2, y1: m, x2: w / 2, y2: h - m, stroke: line, sw });
    s.push({ k: "circle", cx: w / 2, cy: h / 2, r: 91.5, stroke: line, sw, fill: "none" });
    s.push({ k: "circle", cx: w / 2, cy: h / 2, r: 4, fill: line });
    for (const side of [0, 1]) {
      const x0 = side === 0 ? m : w - m;
      const dir = side === 0 ? 1 : -1;
      s.push({ k: "rect", x: side === 0 ? m : w - m - 165, y: h / 2 - 201.5, w: 165, h: 403, stroke: line, sw, fill: "none" });
      s.push({ k: "rect", x: side === 0 ? m : w - m - 55, y: h / 2 - 91.5, w: 55, h: 183, stroke: line, sw, fill: "none" });
      s.push({ k: "circle", cx: x0 + dir * 110, cy: h / 2, r: 4, fill: line });
      s.push({ k: "rect", x: side === 0 ? m - 12 : w - m, y: h / 2 - 36.6, w: 12, h: 73.2, stroke: line, sw, fill: "none" });
      const ax = x0 + dir * 165;
      s.push({ k: "path", d: `M ${ax} ${h / 2 - 73} A 91.5 91.5 0 0 ${side === 0 ? 1 : 0} ${ax} ${h / 2 + 73}`, stroke: line, sw, fill: "none" });
    }
    return s;
  }
  // Vues verticales : but en haut, largeur du terrain = w.
  const W = w - 2 * m;
  const top = m;
  const cx = w / 2;
  const bottom = p.kind === "half" ? h - m : h;
  s.push({ k: "line", x1: m, y1: top, x2: w - m, y2: top, stroke: line, sw });
  s.push({ k: "line", x1: m, y1: top, x2: m, y2: bottom, stroke: line, sw });
  s.push({ k: "line", x1: w - m, y1: top, x2: w - m, y2: bottom, stroke: line, sw });
  if (p.kind === "half") {
    s.push({ k: "line", x1: m, y1: bottom, x2: w - m, y2: bottom, stroke: line, sw });
    s.push({ k: "path", d: `M ${cx - 91.5} ${bottom} A 91.5 91.5 0 0 1 ${cx + 91.5} ${bottom}`, stroke: line, sw, fill: "none" });
    s.push({ k: "circle", cx, cy: bottom, r: 4, fill: line });
  }
  const scale = W / 680;
  s.push({ k: "rect", x: cx - 201.5 * scale, y: top, w: 403 * scale, h: 165, stroke: line, sw, fill: "none" });
  s.push({ k: "rect", x: cx - 91.5 * scale, y: top, w: 183 * scale, h: 55, stroke: line, sw, fill: "none" });
  s.push({ k: "circle", cx, cy: top + 110, r: 4, fill: line });
  if (p.kind !== "box") s.push({ k: "path", d: `M ${cx - 73} ${top + 165} A 91.5 91.5 0 0 0 ${cx + 73} ${top + 165}`, stroke: line, sw, fill: "none" });
  s.push({ k: "rect", x: cx - 36.6, y: top - 12, w: 73.2, h: 12, stroke: line, sw, fill: "rgba(255,255,255,0.25)" });
  return s;
}

function arrowHead(tip: Pt, from: Pt, color: string, size = 18): Shape {
  const a = Math.atan2(tip.y - from.y, tip.x - from.x);
  const p1 = { x: tip.x - size * Math.cos(a - 0.45), y: tip.y - size * Math.sin(a - 0.45) };
  const p2 = { x: tip.x - size * Math.cos(a + 0.45), y: tip.y - size * Math.sin(a + 0.45) };
  return { k: "polygon", points: `${tip.x},${tip.y} ${p1.x},${p1.y} ${p2.x},${p2.y}`, fill: color };
}

function quad(a: Pt, c: Pt, b: Pt, t: number): Pt {
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
}

function arrowShapes(it: ArrowItem): Shape[] {
  const color = it.color ?? (it.kind === "pass" ? "#ffffff" : it.kind === "shot" ? "#facc15" : "#111827");
  const ctrl = it.ctrl ?? null;
  const pts: Pt[] = [];
  const N = 40;
  for (let i = 0; i <= N; i++) pts.push(ctrl ? quad(it.from, ctrl, it.to, i / N) : { x: it.from.x + ((it.to.x - it.from.x) * i) / N, y: it.from.y + ((it.to.y - it.from.y) * i) / N });
  const tip = pts[N];
  const back = pts[N - 3];
  const out: Shape[] = [];
  if (it.kind === "dribble") {
    // Ligne ondulée le long de la trajectoire.
    const wave: string[] = [];
    for (let i = 0; i <= N - 3; i++) {
      const p = pts[i], q = pts[Math.min(i + 1, N)];
      const ang = Math.atan2(q.y - p.y, q.x - p.x) + Math.PI / 2;
      const amp = i === 0 || i === N - 3 ? 0 : Math.sin(i * 1.4) * 6;
      wave.push(`${i === 0 ? "M" : "L"} ${(p.x + Math.cos(ang) * amp).toFixed(1)} ${(p.y + Math.sin(ang) * amp).toFixed(1)}`);
    }
    out.push({ k: "path", d: wave.join(" "), stroke: color, sw: 3.5, fill: "none" });
  } else {
    const d = ctrl ? `M ${it.from.x} ${it.from.y} Q ${ctrl.x} ${ctrl.y} ${back.x} ${back.y}` : `M ${it.from.x} ${it.from.y} L ${back.x} ${back.y}`;
    out.push({ k: "path", d, stroke: color, sw: it.kind === "shot" ? 6 : 4, dash: it.kind === "pass" ? "14 10" : undefined, fill: "none" });
  }
  out.push(arrowHead(tip, back, color, it.kind === "shot" ? 24 : 20));
  return out;
}

/** Lignes de hachures d'un rectangle (x − y = c), découpées analytiquement. */
function hatch(x: number, y: number, w: number, h: number, color: string): Shape[] {
  const out: Shape[] = [];
  const step = 18;
  for (let c = -h; c < w; c += step) {
    // Segment de la droite (x0 + c + t, y0 + t) dans le rectangle.
    const t0 = Math.max(0, -c);
    const t1 = Math.min(h, w - c);
    if (t1 <= t0) continue;
    out.push({ k: "line", x1: x + c + t0, y1: y + t0, x2: x + c + t1, y2: y + t1, stroke: color, sw: 2, opacity: 0.55 });
  }
  return out;
}

function equipShapes(it: EquipItem, p: Pt): Shape[] {
  const { x, y } = p;
  switch (it.type) {
    case "ball":
      return [
        { k: "circle", cx: x, cy: y, r: 9, fill: "#ffffff", stroke: "#111827", sw: 2 },
        { k: "polygon", points: `${x},${y - 4} ${x + 4},${y - 1} ${x + 2.5},${y + 4} ${x - 2.5},${y + 4} ${x - 4},${y - 1}`, fill: "#111827" },
      ];
    case "cone":
      return [{ k: "polygon", points: `${x},${y - 13} ${x + 10},${y + 9} ${x - 10},${y + 9}`, fill: it.color ?? "#f97316", stroke: "#7c2d12", sw: 1.5 }];
    case "disc":
      return [{ k: "ellipse", cx: x, cy: y, rx: 10, ry: 6, fill: it.color ?? "#facc15", stroke: "#854d0e", sw: 1.5 }];
    case "mannequin":
      return [
        { k: "rect", x: x - 8, y: y - 10, w: 16, h: 24, rx: 4, fill: it.color ?? "#facc15", stroke: "#713f12", sw: 1.5 },
        { k: "circle", cx: x, cy: y - 15, r: 6, fill: it.color ?? "#facc15", stroke: "#713f12", sw: 1.5 },
      ];
    case "minigoal":
    case "goal": {
      const gw = it.type === "goal" ? 73 : 30;
      const gh = it.type === "goal" ? 16 : 12;
      const s: Shape[] = [{ k: "rect", x: x - gw / 2, y: y - gh / 2, w: gw, h: gh, fill: "rgba(255,255,255,0.35)", stroke: "#ffffff", sw: 3 }];
      for (let i = 1; i < 4; i++) s.push({ k: "line", x1: x - gw / 2 + (gw / 4) * i, y1: y - gh / 2, x2: x - gw / 2 + (gw / 4) * i, y2: y + gh / 2, stroke: "#ffffff", sw: 1, opacity: 0.7 });
      return s;
    }
    case "pole":
      return [
        { k: "line", x1: x, y1: y - 20, x2: x, y2: y + 6, stroke: it.color ?? "#facc15", sw: 4 },
        { k: "circle", cx: x, cy: y + 7, r: 4, fill: "#111827" },
      ];
    case "ladder": {
      const s: Shape[] = [{ k: "rect", x: x - 12, y: y - 40, w: 24, h: 80, fill: "none", stroke: it.color ?? "#facc15", sw: 3 }];
      for (let i = 1; i < 8; i++) s.push({ k: "line", x1: x - 12, y1: y - 40 + i * 10, x2: x + 12, y2: y - 40 + i * 10, stroke: it.color ?? "#facc15", sw: 2 });
      return s;
    }
    case "hurdle":
      return [
        { k: "line", x1: x - 16, y1: y, x2: x + 16, y2: y, stroke: it.color ?? "#ef4444", sw: 5 },
        { k: "line", x1: x - 14, y1: y, x2: x - 14, y2: y + 8, stroke: "#111827", sw: 2 },
        { k: "line", x1: x + 14, y1: y, x2: x + 14, y2: y + 8, stroke: "#111827", sw: 2 },
      ];
  }
}

/** Formes d'un élément, à une étape donnée (et une interpolation t ∈ [0, 1[). */
export function itemShapes(d: Diagram, it: Item, frame = 0, t = 0): Shape[] {
  if (it.type === "zone") {
    const z = it;
    const out: Shape[] = [];
    if (z.shape === "rect") {
      out.push({ k: "rect", x: z.x, y: z.y, w: z.w, h: z.h, fill: z.color, opacity: 0.22, stroke: z.color, sw: 2.5, dash: "10 6" });
      if (z.hatch) out.push(...hatch(z.x, z.y, z.w, z.h, z.color));
    } else {
      out.push({ k: "ellipse", cx: z.x + z.w / 2, cy: z.y + z.h / 2, rx: z.w / 2, ry: z.h / 2, fill: z.color, opacity: 0.25, stroke: z.color, sw: 2.5, dash: "10 6" });
    }
    if (z.label) out.push({ k: "text", x: z.x + 8, y: z.y + 22, text: z.label, size: 18, fill: "#ffffff", weight: 700 });
    return out;
  }
  if (it.type === "dim") {
    const c = "#ffffff";
    const out: Shape[] = [{ k: "line", x1: it.from.x, y1: it.from.y, x2: it.to.x, y2: it.to.y, stroke: c, sw: 2, dash: "6 5" }, arrowHead(it.from, it.to, c, 12), arrowHead(it.to, it.from, c, 12)];
    if (it.label) {
      const mx = (it.from.x + it.to.x) / 2, my = (it.from.y + it.to.y) / 2;
      const tw = it.label.length * 9 + 12;
      out.push({ k: "rect", x: mx - tw / 2, y: my - 13, w: tw, h: 24, rx: 5, fill: "#111827", opacity: 0.8 });
      out.push({ k: "text", x: mx, y: my + 5, text: it.label, size: 16, fill: "#ffffff", weight: 700, anchor: "middle" });
    }
    return out;
  }
  if (it.type === "arrow") return arrowShapes(it);
  const p = posBetween(d, it, frame, t);
  if (it.type === "player") {
    const c = TEAM_COLORS[it.team] ?? TEAM_COLORS.a;
    const out: Shape[] = [{ k: "circle", cx: p.x, cy: p.y, r: 17, fill: c.fill, stroke: "#ffffff", sw: 3 }];
    if (it.label) out.push({ k: "text", x: p.x, y: p.y + 6, text: it.label.slice(0, 3), size: it.label.length > 2 ? 13 : 16, fill: c.text, weight: 700, anchor: "middle" });
    return out;
  }
  if (it.type === "text") return [{ k: "text", x: p.x, y: p.y, text: it.text, size: it.size, fill: it.color, weight: 700 }];
  return equipShapes(it, p);
}

/** Ordre d'affichage : zones, cotes, flèches, matériel, joueuses, ballon, textes. */
export function drawOrder(i: Item) {
  switch (i.type) {
    case "zone": return 0;
    case "dim": return 1;
    case "arrow": return 2;
    case "player": return 4;
    case "ball": return 5;
    case "text": return 6;
    default: return 3;
  }
}

export const sortedItems = (d: Diagram) => [...d.items].sort((a, b) => drawOrder(a) - drawOrder(b));

/** Toutes les formes du schéma, pour une étape (et une interpolation t ∈ [0, 1[). */
export function buildShapes(d: Diagram, frame = 0, t = 0): Shape[] {
  const out: Shape[] = pitchShapes(d.pitch);
  for (const it of sortedItems(d)) out.push(...itemShapes(d, it, frame, t));
  return out;
}

/** Sérialise des formes en SVG autonome (exports d'image). */
export function shapesToSvg(shapes: Shape[], w: number, h: number) {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const attr = (o: Record<string, unknown>) => Object.entries(o).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => `${k}="${typeof v === "string" ? esc(v) : v}"`).join(" ");
  const body = shapes.map((s) => {
    switch (s.k) {
      case "rect": return `<rect ${attr({ x: s.x, y: s.y, width: s.w, height: s.h, rx: s.rx, fill: s.fill ?? "none", stroke: s.stroke, "stroke-width": s.sw, "stroke-dasharray": s.dash, opacity: s.opacity })}/>`;
      case "circle": return `<circle ${attr({ cx: s.cx, cy: s.cy, r: s.r, fill: s.fill ?? "none", stroke: s.stroke, "stroke-width": s.sw, opacity: s.opacity })}/>`;
      case "ellipse": return `<ellipse ${attr({ cx: s.cx, cy: s.cy, rx: s.rx, ry: s.ry, fill: s.fill ?? "none", stroke: s.stroke, "stroke-width": s.sw, "stroke-dasharray": s.dash, opacity: s.opacity })}/>`;
      case "line": return `<line ${attr({ x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2, stroke: s.stroke, "stroke-width": s.sw, "stroke-dasharray": s.dash, opacity: s.opacity, "stroke-linecap": "round" })}/>`;
      case "path": return `<path ${attr({ d: s.d, fill: s.fill ?? "none", stroke: s.stroke, "stroke-width": s.sw, "stroke-dasharray": s.dash, opacity: s.opacity, "stroke-linecap": "round", "stroke-linejoin": "round" })}/>`;
      case "polygon": return `<polygon ${attr({ points: s.points, fill: s.fill, stroke: s.stroke, "stroke-width": s.sw })}/>`;
      case "text": return `<text ${attr({ x: s.x, y: s.y, "font-size": s.size, fill: s.fill, "font-weight": s.weight ?? 400, "text-anchor": s.anchor ?? "start", "font-family": "Inter, Arial, sans-serif" })}>${esc(s.text)}</text>`;
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body.join("")}</svg>`;
}

export function diagramSvg(d: Diagram, frame = 0) {
  const { w, h } = pitchSize(d.pitch.kind);
  return shapesToSvg(buildShapes(d, frame), w, h);
}

/** Nombre d'éléments par type (matériel déduit du schéma). */
export function countEquipment(d: Diagram) {
  const n: Partial<Record<EquipKind | "player", number>> = {};
  for (const i of d.items) if (i.type !== "arrow" && i.type !== "zone" && i.type !== "text" && i.type !== "dim") n[i.type] = (n[i.type] ?? 0) + 1;
  return n;
}

// ------------------------------------------------------------------ Validation (import / sauvegarde)
const num = z.number().finite().min(-2000).max(4000);
const pt = z.object({ x: num, y: num });
const id = z.string().min(1).max(40);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const itemSchema = z.union([
  z.object({ id, type: z.literal("player"), x: num, y: num, team: z.enum(["a", "b", "c", "gk"]), label: z.string().max(4) }),
  ...(["ball", "cone", "disc", "mannequin", "minigoal", "goal", "pole", "ladder", "hurdle"] as const).map((t) =>
    z.object({ id, type: z.literal(t), x: num, y: num, rot: num.optional(), color: color.optional() }),
  ),
  z.object({ id, type: z.literal("arrow"), kind: z.enum(["run", "pass", "dribble", "shot"]), from: pt, to: pt, ctrl: pt.nullable().optional(), color: color.optional() }),
  z.object({ id, type: z.literal("zone"), shape: z.enum(["rect", "ellipse"]), x: num, y: num, w: num, h: num, color, hatch: z.boolean(), label: z.string().max(40).optional() }),
  z.object({ id, type: z.literal("text"), x: num, y: num, text: z.string().max(80), size: z.number().min(8).max(60), color }),
  z.object({ id, type: z.literal("dim"), from: pt, to: pt, label: z.string().max(20) }),
] as unknown as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);

export const diagramSchema = z.object({
  v: z.literal(1),
  pitch: z.object({ kind: z.enum(["full", "half", "third", "box", "blank"]), style: z.enum(["grass", "stripes", "plain"]), label: z.string().max(60).optional() }),
  items: z.array(itemSchema).max(300),
  frames: z.array(z.object({ id, pos: z.record(z.string(), pt) })).min(1).max(20),
});

export function parseDiagram(raw: unknown): Diagram | null {
  const r = diagramSchema.safeParse(raw);
  return r.success ? (r.data as Diagram) : null;
}
