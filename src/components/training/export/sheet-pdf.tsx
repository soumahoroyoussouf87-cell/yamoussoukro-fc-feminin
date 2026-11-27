/* eslint-disable jsx-a11y/alt-text */
/**
 * Modèles imprimables de la fiche de séance (PDF vectoriel, texte sélectionnable).
 * Les mêmes documents servent à l'aperçu, à l'impression et aux exports d'image.
 */
import { Circle, Document, Ellipse, Font, Image, Line, Page, Path, Polygon, Rect, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import { ATTENDANCE_LABELS, BLOCK_LABELS, CATEGORY_LABELS, dayLong, hm, INTENSITY_LABELS, WORKFLOW_LABELS } from "@/lib/phase2/labels";
import { buildShapes, pitchSize, type Diagram, type Shape } from "@/lib/training/diagram";
import { APPRECIATION_LABELS, scoreCriteria } from "@/lib/training/evaluation";
import { PARTICIPATION_LABELS, plannedLoad, teamLoad } from "@/lib/training/load";
import { clockAt, computeSchedule, fmtMin, itemDuration } from "@/lib/training/schedule";
import type { SheetData, SheetItem, SheetPhase } from "@/lib/training/sheet-types";

import { TEMPLATES, type ExportOptions } from "./templates";
export { TEMPLATES };
export type { ExportOptions };

const NAVY = "#07162E";
const PINK = "#FF0068";
const PINK_TEXT = "#C8005A";
const GREY = "#5B6475";
const LINE = "#D8DCE4";
const SOFT = "#F3F4F8";

let fontsReady = false;
export function registerFonts(origin: string) {
  if (fontsReady) return;
  Font.register({
    family: "Inter",
    fonts: [
      { src: `${origin}/fonts/inter-latin-400-normal.woff`, fontWeight: 400 },
      { src: `${origin}/fonts/inter-latin-400-italic.woff`, fontWeight: 400, fontStyle: "italic" },
      { src: `${origin}/fonts/inter-latin-600-normal.woff`, fontWeight: 600 },
      { src: `${origin}/fonts/inter-latin-700-normal.woff`, fontWeight: 700 },
    ],
  });
  Font.register({
    family: "Barlow",
    fonts: [
      { src: `${origin}/fonts/barlow-condensed-latin-600-normal.woff`, fontWeight: 600 },
      { src: `${origin}/fonts/barlow-condensed-latin-700-normal.woff`, fontWeight: 700 },
      { src: `${origin}/fonts/barlow-condensed-latin-800-normal.woff`, fontWeight: 800 },
    ],
  });
  // Pas de césure automatique (mots français coupés au mauvais endroit).
  Font.registerHyphenationCallback((w) => [w]);
  fontsReady = true;
}

const st = StyleSheet.create({
  page: { fontFamily: "Inter", fontSize: 8.5, color: NAVY, paddingTop: 92, paddingBottom: 44, paddingHorizontal: 28, lineHeight: 1.35 },
  header: { position: "absolute", top: 18, left: 28, right: 28, flexDirection: "row", alignItems: "center", borderBottomWidth: 2.5, borderBottomColor: PINK, paddingBottom: 6 },
  logo: { width: 52, height: 52, objectFit: "contain" },
  club: { fontFamily: "Barlow", fontWeight: 800, fontSize: 17, letterSpacing: 0.4, lineHeight: 1.1, marginBottom: 2 },
  center: { fontSize: 7, fontWeight: 700, color: PINK_TEXT, letterSpacing: 1.6, lineHeight: 1.2 },
  docTitle: { fontFamily: "Barlow", fontWeight: 700, fontSize: 13, textAlign: "right", textTransform: "uppercase", lineHeight: 1.1, marginBottom: 2 },
  meta: { fontSize: 7.5, color: GREY, textAlign: "right" },
  footer: { position: "absolute", bottom: 16, left: 28, right: 28, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 0.6, borderTopColor: LINE, paddingTop: 5, fontSize: 6.8, color: GREY },
  h1: { fontFamily: "Barlow", fontWeight: 800, fontSize: 20, textTransform: "uppercase", lineHeight: 1.1 },
  h2: { fontFamily: "Barlow", fontWeight: 700, fontSize: 11.5, textTransform: "uppercase", color: NAVY, borderBottomWidth: 1.2, borderBottomColor: PINK, paddingBottom: 2, marginTop: 10, marginBottom: 5 },
  h3: { fontWeight: 700, fontSize: 9.5 },
  label: { fontSize: 6.5, fontWeight: 700, color: GREY, textTransform: "uppercase", letterSpacing: 0.5 },
  value: { fontSize: 8.5, fontWeight: 600 },
  cell: { padding: 4, borderRightWidth: 0.6, borderRightColor: LINE },
  row: { flexDirection: "row", borderBottomWidth: 0.6, borderBottomColor: LINE },
  th: { backgroundColor: NAVY, color: "#ffffff", fontWeight: 700, fontSize: 7, textTransform: "uppercase" },
  muted: { color: GREY },
  badge: { backgroundColor: PINK, color: "#ffffff", fontWeight: 700, fontSize: 7, paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 3 },
  box: { borderWidth: 0.8, borderColor: LINE, borderRadius: 4, padding: 6 },
});

// ------------------------------------------------------------------ Éléments communs
function pageDims(o: ExportOptions) {
  const base = o.size === "A3" ? { w: 842, h: 1191 } : { w: 595, h: 842 };
  return o.orientation === "landscape" ? { w: base.h, h: base.w } : base;
}
const contentWidth = (o: ExportOptions) => pageDims(o).w - 56;

function Header({ d, o, title }: { d: SheetData; o: ExportOptions; title: string }) {
  return (
    <View style={st.header} fixed>
      <Image src={`${o.origin}/brand/logo-officiel-yfc.png`} style={st.logo} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={st.club}>YAMOUSSOUKRO FC FÉMININ</Text>
        <Text style={st.center}>CENTRE DE HAUTE PERFORMANCE SPORTIVE</Text>
      </View>
      <View>
        <Text style={st.docTitle}>{title}</Text>
        <Text style={st.meta}>{[d.club.season ? `Saison ${d.club.season}` : null, `Séance n°${d.session.number}`].filter(Boolean).join(" · ")}</Text>
        <Text style={st.meta}>{cap(dayLong(d.session.session_date))}</Text>
      </View>
    </View>
  );
}

function Footer({ d }: { d: SheetData }) {
  const s = d.session;
  const validated = ["valide", "publie", "archive"].includes(s.status);
  const edited = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Abidjan" }).format(new Date());
  return (
    <View style={st.footer} fixed>
      <Text>
        {validated
          ? `${WORKFLOW_LABELS[s.status]}${s.validated_by_name ? ` par ${s.validated_by_name}` : ""}${s.validated_at ? ` le ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeZone: "Africa/Abidjan" }).format(new Date(s.validated_at))}` : ""}`
          : `Document de travail — statut : ${WORKFLOW_LABELS[s.status]}`}
      </Text>
      <Text>Édité le {edited} · Document interne YFC</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
    </View>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Info({ items, cols = 4 }: { items: [string, string | null | undefined][]; cols?: number }) {
  const shown = items.filter(([, v]) => v);
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", borderTopWidth: 0.6, borderLeftWidth: 0.6, borderColor: LINE }}>
      {shown.map(([k, v]) => (
        <View key={k} style={{ width: `${100 / cols}%`, padding: 4, borderRightWidth: 0.6, borderBottomWidth: 0.6, borderColor: LINE }}>
          <Text style={st.label}>{k}</Text>
          <Text style={st.value}>{v}</Text>
        </View>
      ))}
    </View>
  );
}

function Para({ label, text }: { label: string; text: string | null | undefined }) {
  if (!text) return null;
  return (
    <View style={{ marginBottom: 4 }} wrap={false}>
      <Text style={st.label}>{label}</Text>
      <Text>{text}</Text>
    </View>
  );
}

function DiagramPdf({ data, width, maxHeight }: { data: Diagram; width: number; maxHeight?: number }) {
  const { w, h } = pitchSize(data.pitch.kind);
  let W = width;
  let H = (width * h) / w;
  if (maxHeight && H > maxHeight) { H = maxHeight; W = (maxHeight * w) / h; }
  const shapes = buildShapes(data, 0);
  return (
    <Svg viewBox={`0 0 ${w} ${h}`} style={{ width: W, height: H }}>
      {shapes.map((s, i) => <PdfShape key={i} s={s} />)}
    </Svg>
  );
}

/** react-pdf ne gère pas rgba() : conversion en couleur hexadécimale + opacité. */
function pc(c: string | undefined, opacity?: number) {
  if (!c) return { c, o: opacity };
  const m = c.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
  if (!m) return { c, o: opacity };
  const hex = `#${[m[1], m[2], m[3]].map((x) => Number(x).toString(16).padStart(2, "0")).join("")}`;
  const a = m[4] !== undefined ? Number(m[4]) : 1;
  return { c: hex, o: (opacity ?? 1) * a };
}

function PdfShape({ s }: { s: Shape }) {
  if ("fill" in s || "stroke" in s) {
    const f = pc((s as { fill?: string }).fill);
    const k = pc((s as { stroke?: string }).stroke);
    const op = (s as { opacity?: number }).opacity;
    if (f.c !== (s as { fill?: string }).fill || k.c !== (s as { stroke?: string }).stroke) {
      return <PdfShapeRaw s={{ ...s, fill: f.c, stroke: k.c } as Shape} fillOpacity={f.o === undefined || f.o === 1 ? undefined : f.o} strokeOpacity={k.o === undefined || k.o === 1 ? undefined : k.o} opacity={op} />;
    }
  }
  return <PdfShapeRaw s={s} opacity={(s as { opacity?: number }).opacity} />;
}

function PdfShapeRaw({ s, fillOpacity, strokeOpacity, opacity }: { s: Shape; fillOpacity?: number; strokeOpacity?: number; opacity?: number }) {
  const o = { fillOpacity, strokeOpacity };
  switch (s.k) {
    case "rect": return <Rect x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} fill={s.fill ?? "none"} stroke={s.stroke} strokeWidth={s.sw} strokeDasharray={s.dash} opacity={opacity} {...o} />;
    case "circle": return <Circle cx={s.cx} cy={s.cy} r={s.r} fill={s.fill ?? "none"} stroke={s.stroke} strokeWidth={s.sw} opacity={opacity} {...o} />;
    case "ellipse": return <Ellipse cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} fill={s.fill ?? "none"} stroke={s.stroke} strokeWidth={s.sw} strokeDasharray={s.dash} opacity={opacity} {...o} />;
    case "line": return <Line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.stroke} strokeWidth={s.sw} strokeDasharray={s.dash} opacity={opacity} {...o} strokeLinecap="round" />;
    case "path": return <Path d={s.d} fill={s.fill ?? "none"} stroke={s.stroke} strokeWidth={s.sw} strokeDasharray={s.dash} opacity={opacity} {...o} strokeLinecap="round" strokeLinejoin="round" />;
    case "polygon": return <Polygon points={s.points} fill={s.fill} stroke={s.stroke} strokeWidth={s.sw} {...o} />;
    case "text":
      return (
        <Text x={s.x} y={s.y} fill={s.fill} {...o} textAnchor={s.anchor ?? "start"} style={{ fontFamily: "Inter", fontSize: s.size, fontWeight: s.weight ?? 400 } as never}>
          {s.text}
        </Text>
      );
  }
}

function itemDiagram(d: SheetData, i: SheetItem) {
  const id = i.diagram_id ?? i.exercise.diagram_id;
  return id ? d.diagrams[id]?.data ?? null : null;
}

function DiagramOrImage({ d, item, width, maxHeight }: { d: SheetData; item: SheetItem; width: number; maxHeight?: number }) {
  const diag = itemDiagram(d, item);
  if (diag) return <DiagramPdf data={diag} width={width} maxHeight={maxHeight} />;
  if (item.exercise.diagram_image) return <Image src={item.exercise.diagram_image} style={{ width, maxHeight: maxHeight ?? width, objectFit: "contain" }} />;
  return (
    <View style={{ width, height: Math.min(maxHeight ?? width * 0.6, width * 0.6), borderWidth: 0.8, borderColor: LINE, borderStyle: "dashed", alignItems: "center", justifyContent: "center" }}>
      <Text style={st.muted}>Pas de schéma</Text>
    </View>
  );
}

function sessionInfo(d: SheetData, total: number): [string, string | null][] {
  const s = d.session;
  return [
    ["Date", cap(dayLong(s.session_date))],
    ["Horaire", [hm(s.starts_at), hm(s.ends_at)].filter(Boolean).join(" – ") || null],
    ["Lieu", s.location],
    ["Durée programmée", total ? fmtMin(total) : null],
    ["Référence match", s.match_ref],
    ["Responsable", s.responsible],
    ["Groupe", s.audience],
    ["Système", s.game_system],
    ["Période", s.period],
    ["Intensité prévue", s.intensity ? INTENSITY_LABELS[s.intensity] : null],
    ["RPE prévu", s.planned_rpe ? `${s.planned_rpe}/10` : null],
    ["Charge prévue", plannedLoad(s.planned_rpe, total) ? `${plannedLoad(s.planned_rpe, total)} UA` : null],
    ["Météo", s.weather],
    ["Terrain", s.pitch_condition],
  ];
}

function Title({ d }: { d: SheetData }) {
  const s = d.session;
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={st.h1}>{s.theme ?? "Séance d'entraînement"}</Text>
      {s.sub_theme ? <Text style={{ fontSize: 10, fontWeight: 600, color: PINK_TEXT }}>{s.sub_theme}</Text> : null}
    </View>
  );
}

function Objectives({ d }: { d: SheetData }) {
  const s = d.session;
  if (!s.main_objective && !s.secondary_objectives && !s.specific_objectives.length) return null;
  return (
    <View>
      <Text style={st.h2}>Objectifs</Text>
      <Para label="Objectif principal" text={s.main_objective} />
      <Para label="Objectifs secondaires" text={s.secondary_objectives} />
      {s.specific_objectives.length ? (
        <View wrap={false}>
          <Text style={st.label}>Objectifs spécifiques</Text>
          {s.specific_objectives.map((o, k) => <Text key={k}>{k + 1}. {o}</Text>)}
        </View>
      ) : null}
    </View>
  );
}

function Timeline({ d }: { d: SheetData }) {
  const sched = computeSchedule(d.phases.map((p) => ({ id: p.id, duration_min: p.duration_min, items: p.items })));
  const s = d.session;
  const cols = [0.2, 0.14, 0.46, 0.2];
  return (
    <View>
      <Text style={st.h2}>Déroulé de la séance · {fmtMin(sched.total)}</Text>
      <View style={[st.row, st.th]}>
        {["Phase", "Horaire", "Exercice", "Volume"].map((h, k) => <Text key={h} style={[st.cell, { width: `${cols[k] * 100}%` }]}>{h}</Text>)}
      </View>
      {d.phases.map((p, pi) => {
        const t = sched.phases[pi];
        const rows = p.items.length ? p.items : [null];
        return rows.map((i, k) => {
          const it = i ? t.items[k] : null;
          const dur = i ? itemDuration(i) : null;
          return (
            <View key={`${p.id}-${k}`} style={[st.row, { backgroundColor: pi % 2 ? SOFT : "#ffffff" }]} wrap={false}>
              <View style={[st.cell, { width: `${cols[0] * 100}%` }]}>{k === 0 ? <><Text style={{ fontWeight: 700 }}>{p.title}</Text>{p.block ? <Text style={st.muted}>{BLOCK_LABELS[p.block]}</Text> : null}</> : null}</View>
              <Text style={[st.cell, { width: `${cols[1] * 100}%` }]}>{s.starts_at ? `${clockAt(s.starts_at, it?.start ?? t.start)} – ${clockAt(s.starts_at, it?.end ?? t.end)}` : ""}</Text>
              <View style={[st.cell, { width: `${cols[2] * 100}%` }]}>
                {i ? <><Text style={{ fontWeight: 600 }}>{i.exercise.title}</Text><Text style={st.muted}>{CATEGORY_LABELS[i.exercise.category]}{i.exercise.players_count ? ` · ${i.exercise.players_count}` : ""}{i.exercise.dimensions ? ` · ${i.exercise.dimensions}` : ""}</Text></> : <Text style={st.muted}>{p.notes ?? "—"}</Text>}
              </View>
              <Text style={[st.cell, { width: `${cols[3] * 100}%`, borderRightWidth: 0 }]}>
                {i && dur ? `${(i.series ?? 1) > 1 ? `${i.series} × ` : ""}${i.duration_min ?? "?"} min${i.recovery_sec ? ` · récup. ${i.recovery_sec} s` : ""}${i.pause_after_min ? ` · pause ${i.pause_after_min} min` : ""}` : fmtMin(t.total)}
              </Text>
            </View>
          );
        });
      })}
      {d.phases.length === 0 ? <Text style={[st.muted, { padding: 4 }]}>Aucune phase.</Text> : null}
    </View>
  );
}

function Equipment({ d }: { d: SheetData }) {
  if (!d.equipment.length && !d.session.legacy_equipment) return null;
  return (
    <View wrap={false}>
      <Text style={st.h2}>Matériel</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {d.equipment.map((e) => (
          <View key={e.item} style={{ width: "33%", marginBottom: 3, flexDirection: "row", alignItems: "center" }}>
            <View style={{ width: 7, height: 7, borderWidth: 0.8, borderColor: NAVY, marginRight: 4 }} />
            <Text>{e.quantity} × {e.item}</Text>
          </View>
        ))}
      </View>
      {d.session.legacy_equipment ? <Text style={st.muted}>{d.session.legacy_equipment}</Text> : null}
    </View>
  );
}

function ExerciseTexts({ item, compact = false }: { item: SheetItem; compact?: boolean }) {
  const e = item.exercise;
  return (
    <View>
      <Para label="Objectif" text={e.objective} />
      <Para label="Organisation" text={e.organisation} />
      <Para label="Consignes" text={e.instructions} />
      {!compact ? <Para label="Déroulement / progression" text={e.progression} /> : null}
      <Para label="Points de coaching" text={e.coaching_points} />
      <Para label="Critères de réussite" text={e.success_criteria} />
      {!compact ? (
        <>
          <Para label="Critères de réalisation" text={e.realisation_criteria} />
          <Para label="Contraintes" text={e.constraints} />
          <Para label="Variantes" text={e.variables} />
          <Para label="Corrections attendues" text={e.corrections} />
        </>
      ) : null}
      <Para label="Matériel" text={e.equipment} />
      <Para label="Précisions du jour" text={item.notes} />
      {e.video_links.length ? <Para label="Vidéos" text={e.video_links.map((l) => `${l.title} : ${l.url}`).join("\n")} /> : null}
    </View>
  );
}

function ExerciseHead({ d, item, phase, index }: { d: SheetData; item: SheetItem; phase: SheetPhase; index: number }) {
  const sched = computeSchedule(d.phases.map((p) => ({ id: p.id, duration_min: p.duration_min, items: p.items })));
  const t = sched.phases.flatMap((p) => p.items).find((x) => x.id === item.id);
  const s = d.session;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: NAVY, color: "#ffffff", padding: 5, borderRadius: 3, marginBottom: 5 }}>
      <Text style={{ fontFamily: "Barlow", fontWeight: 800, fontSize: 16, color: PINK, marginRight: 7, lineHeight: 1 }}>{index}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: 700, fontSize: 10 }}>{item.exercise.title}</Text>
        <Text style={{ fontSize: 7, color: "#C9D1E0" }}>{phase.title} · {CATEGORY_LABELS[item.exercise.category]}</Text>
      </View>
      <Text style={{ fontSize: 8, fontWeight: 600, textAlign: "right" }}>
        {s.starts_at && t ? `${clockAt(s.starts_at, t.start)} – ${clockAt(s.starts_at, t.end)}\n` : ""}
        {(item.series ?? 1) > 1 ? `${item.series} × ` : ""}{item.duration_min ?? "?"} min{item.recovery_sec && (item.series ?? 1) > 1 ? ` · récup. ${item.recovery_sec} s` : ""}{itemDuration(item).total !== (item.duration_min ?? 0) ? ` · total ${fmtMin(itemDuration(item).total)}` : ""}
      </Text>
    </View>
  );
}

function Signatures() {
  return (
    <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }} wrap={false}>
      {["Préparée par", "Validée par (entraîneur principal)", "Direction sportive"].map((l) => (
        <View key={l} style={[st.box, { flex: 1, height: 58 }]}>
          <Text style={st.label}>{l}</Text>
          <Text style={[st.muted, { marginTop: 30, fontSize: 6.5 }]}>Nom, date et signature</Text>
        </View>
      ))}
    </View>
  );
}

function Attendance({ d, detailed }: { d: SheetData; detailed: boolean }) {
  if (!d.attendance.length) return null;
  const players = new Map(d.players.map((p) => [p.id, p]));
  const counts = new Map<string, number>();
  for (const a of d.attendance) counts.set(a.status, (counts.get(a.status) ?? 0) + 1);
  const load = teamLoad(d.attendance);
  const rows = [...d.attendance].sort((a, b) => (players.get(a.player_id)?.shirt ?? 99) - (players.get(b.player_id)?.shirt ?? 99));
  const cols = [0.06, 0.3, 0.18, 0.13, 0.1, 0.08, 0.15];
  return (
    <View>
      <Text style={st.h2}>Présences et charge</Text>
      <Text style={{ marginBottom: 4 }}>{[...counts].map(([k, n]) => `${ATTENDANCE_LABELS[k]} : ${n}`).join(" · ")}</Text>
      {load ? <Text style={{ marginBottom: 4, fontWeight: 600 }}>Moyennes équipe : RPE {String(load.rpe).replace(".", ",")} · {load.minutes} min · sRPE {load.srpe} UA ({load.players} joueuses notées)</Text> : null}
      {detailed ? (
        <>
          <View style={[st.row, st.th]}>
            {["N°", "Joueuse", "Présence", "Participation", "Minutes", "RPE", "sRPE"].map((h, k) => <Text key={h} style={[st.cell, { width: `${cols[k] * 100}%` }]}>{h}</Text>)}
          </View>
          {rows.map((a, k) => {
            const p = players.get(a.player_id);
            return (
              <View key={a.player_id} style={[st.row, { backgroundColor: k % 2 ? SOFT : "#ffffff" }]} wrap={false}>
                <Text style={[st.cell, { width: `${cols[0] * 100}%`, fontWeight: 700 }]}>{p?.shirt ?? ""}</Text>
                <View style={[st.cell, { width: `${cols[1] * 100}%` }]}><Text>{p?.name ?? "Joueuse"}</Text>{a.note ? <Text style={[st.muted, { fontSize: 6.8 }]}>{a.note}</Text> : null}</View>
                <Text style={[st.cell, { width: `${cols[2] * 100}%` }]}>{ATTENDANCE_LABELS[a.status]}</Text>
                <Text style={[st.cell, { width: `${cols[3] * 100}%` }]}>{a.participation ? PARTICIPATION_LABELS[a.participation] : ""}</Text>
                <Text style={[st.cell, { width: `${cols[4] * 100}%` }]}>{a.minutes ?? ""}</Text>
                <Text style={[st.cell, { width: `${cols[5] * 100}%` }]}>{a.rpe ?? ""}</Text>
                <Text style={[st.cell, { width: `${cols[6] * 100}%`, borderRightWidth: 0 }]}>{a.minutes != null && a.rpe != null ? `${a.minutes * a.rpe} UA` : ""}</Text>
              </View>
            );
          })}
        </>
      ) : null}
    </View>
  );
}

function Evaluation({ d }: { d: SheetData }) {
  const ev = d.evaluation;
  if (!ev) return null;
  const score = scoreCriteria(ev.criteria);
  return (
    <View>
      <Text style={st.h2}>Évaluation et bilan</Text>
      {ev.criteria.length ? (
        <View style={{ marginBottom: 6 }}>
          {ev.criteria.map((c, k) => (
            <View key={k} style={[st.row, { paddingVertical: 2.5 }]} wrap={false}>
              <Text style={{ flex: 1 }}>{c.label}</Text>
              {c.score == null ? <Text style={[st.muted, { width: 90, textAlign: "right" }]}>Non observé</Text> : (
                <View style={{ width: 90, flexDirection: "row", justifyContent: "flex-end", alignItems: "center" }}>
                  {[1, 2, 3, 4, 5].map((n) => <View key={n} style={{ width: 8, height: 8, marginLeft: 2, borderRadius: 1.5, backgroundColor: n <= (c.score ?? 0) ? PINK : LINE }} />)}
                  <Text style={{ marginLeft: 5, fontWeight: 700 }}>{c.score}/5</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      ) : null}
      <View style={{ flexDirection: "row", gap: 12, marginBottom: 6 }} wrap={false}>
        {score ? <Text style={{ fontWeight: 700 }}>Note : {score.points}/{score.max} ({score.pct} %)</Text> : null}
        {ev.appreciation ? <Text style={st.badge}>{APPRECIATION_LABELS[ev.appreciation]}</Text> : null}
        {ev.actual_duration_min ? <Text>Durée réelle : {ev.actual_duration_min} min</Text> : null}
        {ev.intensity_observed ? <Text>Intensité observée : {INTENSITY_LABELS[ev.intensity_observed]}</Text> : null}
      </View>
      <Para label="Points positifs" text={ev.strengths} />
      <Para label="Points à améliorer" text={ev.improvements} />
      <Para label="Difficultés rencontrées" text={ev.difficulties} />
      <Para label="Corrections apportées" text={ev.corrections} />
      <Para label="Objectif de la prochaine séance" text={ev.next_objective} />
    </View>
  );
}

// ------------------------------------------------------------------ Modèles
export function SheetDocument({ d, o }: { d: SheetData; o: ExportOptions }) {
  const tpl = TEMPLATES.find((t) => t.id === o.template)!;
  const total = computeSchedule(d.phases.map((p) => ({ id: p.id, duration_min: p.duration_min, items: p.items }))).total;
  const W = contentWidth(o);
  const items = d.phases.flatMap((p) => p.items.map((i) => ({ item: i, phase: p })));
  const pageProps = { size: o.size, orientation: o.orientation, style: st.page } as const;
  const title = `${tpl.label}`;
  const landscape = o.orientation === "landscape";

  let body: React.ReactNode;
  if (o.template === "complete") {
    body = (
      <Page {...pageProps}>
        <Header d={d} o={o} title={title} />
        <Title d={d} />
        <Info items={sessionInfo(d, total)} cols={landscape ? 6 : 4} />
        <Objectives d={d} />
        <Timeline d={d} />
        <Equipment d={d} />
        {items.length ? <Text style={st.h2} minPresenceAhead={200}>Exercices</Text> : null}
        {items.map(({ item, phase }, k) => (
          <View key={item.id} style={{ marginBottom: 10 }} wrap={false} minPresenceAhead={120}>
            <ExerciseHead d={d} item={item} phase={phase} index={k + 1} />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <DiagramOrImage d={d} item={item} width={W * 0.48} maxHeight={landscape ? 300 : 260} />
              <View style={{ flex: 1 }}><ExerciseTexts item={item} compact /></View>
            </View>
          </View>
        ))}
        <Attendance d={d} detailed={false} />
        <Evaluation d={d} />
        {d.session.notes ? <><Text style={st.h2}>Remarques</Text><Text>{d.session.notes}</Text></> : null}
        <Signatures />
        <Footer d={d} />
      </Page>
    );
  } else if (o.template === "terrain") {
    body = (
      <>
        <Page {...pageProps}>
          <Header d={d} o={o} title={title} />
          <Title d={d} />
          <Info items={sessionInfo(d, total)} cols={landscape ? 7 : 4} />
          <View style={{ flexDirection: landscape ? "row" : "column", gap: 14 }}>
            <View style={{ flex: 1.6 }}><Timeline d={d} /></View>
            <View style={{ flex: 1 }}><Objectives d={d} /><Equipment d={d} /></View>
          </View>
          <Footer d={d} />
        </Page>
        {items.map(({ item, phase }, k) => (
          <Page key={item.id} {...pageProps}>
            <Header d={d} o={o} title={title} />
            <ExerciseHead d={d} item={item} phase={phase} index={k + 1} />
            <View style={{ flexDirection: landscape ? "row" : "column", gap: 12 }}>
              <DiagramOrImage d={d} item={item} width={landscape ? W * 0.58 : W} maxHeight={landscape ? pageDims(o).h - 180 : (pageDims(o).h - 160) * 0.5} />
              <View style={{ flex: 1 }}><ExerciseTexts item={item} /></View>
            </View>
            <Footer d={d} />
          </Page>
        ))}
      </>
    );
  } else if (o.template === "resume") {
    body = (
      <Page {...pageProps}>
        <Header d={d} o={o} title={title} />
        <Title d={d} />
        <Info items={sessionInfo(d, total)} cols={landscape ? 6 : 4} />
        <Objectives d={d} />
        <Timeline d={d} />
        <Equipment d={d} />
        <Footer d={d} />
      </Page>
    );
  } else if (o.template === "bilan") {
    body = (
      <Page {...pageProps}>
        <Header d={d} o={o} title={title} />
        <Title d={d} />
        <Info items={sessionInfo(d, total).slice(0, landscape ? 6 : 4)} cols={landscape ? 6 : 4} />
        <Para label="Objectif principal" text={d.session.main_objective} />
        <Attendance d={d} detailed />
        <Evaluation d={d} />
        {!d.attendance.length && !d.evaluation ? <Text style={[st.muted, { marginTop: 10 }]}>Présences et évaluation non saisies.</Text> : null}
        <Signatures />
        <Footer d={d} />
      </Page>
    );
  } else if (o.template === "exercice") {
    const sel = items.find((x) => x.item.id === o.itemId) ?? items[0];
    body = (
      <Page {...pageProps}>
        <Header d={d} o={o} title={title} />
        {sel ? (
          <>
            <ExerciseHead d={d} item={sel.item} phase={sel.phase} index={items.indexOf(sel) + 1} />
            <Info items={[["Joueuses", sel.item.exercise.players_count], ["Espace", sel.item.exercise.dimensions], ["Séries", sel.item.series ? String(sel.item.series) : null], ["Durée", fmtMin(itemDuration(sel.item).total)], ["Thème", d.session.theme]]} cols={5} />
            <View style={{ flexDirection: landscape ? "row" : "column", gap: 12, marginTop: 8 }}>
              <DiagramOrImage d={d} item={sel.item} width={landscape ? W * 0.58 : W} maxHeight={landscape ? pageDims(o).h - 210 : (pageDims(o).h - 200) * 0.5} />
              <View style={{ flex: 1 }}><ExerciseTexts item={sel.item} /></View>
            </View>
          </>
        ) : <Text style={st.muted}>Aucun exercice dans cette séance.</Text>}
        <Footer d={d} />
      </Page>
    );
  } else {
    const week = o.week;
    const cols = [0.15, 0.1, 0.3, 0.27, 0.08, 0.1];
    body = (
      <Page {...pageProps}>
        <Header d={d} o={o} title={title} />
        <Text style={st.h1}>Semaine du {week ? dayLong(week.monday) : dayLong(d.session.session_date)}</Text>
        <View style={{ marginTop: 8 }}>
          <View style={[st.row, st.th]}>
            {["Jour", "Horaire", "Séance / rencontre", "Objectif", "Durée", "RPE prévu"].map((h, k) => <Text key={h} style={[st.cell, { width: `${cols[k] * 100}%` }]}>{h}</Text>)}
          </View>
          {(week?.rows ?? []).map((r, k) => (
            <View key={k} style={[st.row, { backgroundColor: r.kind === "match" ? "#FFE3EF" : k % 2 ? SOFT : "#ffffff" }]} wrap={false}>
              <Text style={[st.cell, { width: `${cols[0] * 100}%`, fontWeight: 700 }]}>{cap(dayLong(r.date))}</Text>
              <Text style={[st.cell, { width: `${cols[1] * 100}%` }]}>{[hm(r.starts_at), hm(r.ends_at)].filter(Boolean).join(" – ")}</Text>
              <View style={[st.cell, { width: `${cols[2] * 100}%` }]}>
                <Text style={{ fontWeight: 700 }}>{r.kind === "seance" ? `Séance n°${r.number} · ` : ""}{r.title}</Text>
                {r.location ? <Text style={st.muted}>{r.location}</Text> : null}
              </View>
              <Text style={[st.cell, { width: `${cols[3] * 100}%` }]}>{r.objective ?? ""}</Text>
              <Text style={[st.cell, { width: `${cols[4] * 100}%` }]}>{r.duration ? `${r.duration} min` : ""}</Text>
              <Text style={[st.cell, { width: `${cols[5] * 100}%`, borderRightWidth: 0 }]}>{r.planned_rpe ? `${r.planned_rpe}/10` : ""}</Text>
            </View>
          ))}
          {!week?.rows.length ? <Text style={[st.muted, { padding: 4 }]}>Aucune séance cette semaine.</Text> : null}
        </View>
        <Footer d={d} />
      </Page>
    );
  }

  return (
    <Document title={`${tpl.label} — Séance n°${d.session.number}`} author="Yamoussoukro FC Féminin" subject={d.session.theme ?? "Séance d'entraînement"} creator="YFC Centre de Haute Performance" producer="YFC Centre de Haute Performance" language="fr-FR">
      {body}
    </Document>
  );
}
