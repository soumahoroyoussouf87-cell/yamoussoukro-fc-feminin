"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { cutout } from "./cutout";
import { POSTER_FORMATS, pitchPoint, type PosterFormat } from "@/lib/phase2/poster-layout";
import { DISPLAY, DraftRibbon, FUCHSIA, LOGO, MatchStrip, NIGHT, PosterStudio, ROYAL, SHIRT_STYLE, TEXT, type PosterMatch } from "./poster-studio";

export type LineupPosterPlayer = { id: string; firstName: string; lastName: string; shirt: number | null; photo: string | null; x: number | null; y: number | null; captain: boolean };
export type LineupPosterBench = { id: string; lastName: string; shirt: number | null };

const PAD = 36;
/** Fondu des bords de la photo (ellipse) : la joueuse se détache sans cercle autour. */
const FADE = "radial-gradient(ellipse 50% 52% at 50% 46%, #000 62%, transparent 100%)";
/** Photo détourée : seul le bas (buste) est fondu. */
const FADE_BOTTOM = "linear-gradient(180deg, #000 72%, transparent 100%)";

export function LineupPoster({ starters, bench, system, match, draft, empty }: {
  starters: LineupPosterPlayer[]; bench: LineupPosterBench[]; system: string; match: PosterMatch; draft: boolean; empty: string | null;
}) {
  const [showBench, setShowBench] = useState(bench.length > 0);
  const [showSystem, setShowSystem] = useState(true);
  return (
    <PosterStudio
      filename={`affiche-onze-${match.day}`}
      defaultTitle="Onze de départ"
      background={NIGHT}
      draftNotice={draft ? "Composition provisoire : elle est confidentielle. L'affiche porte la mention « Provisoire » ; ne la diffusez qu'après validation." : null}
      empty={empty}
      footnote={`${starters.length} titulaire${starters.length > 1 ? "s" : ""}${system ? ` · ${system}` : ""}`}
      controls={<>
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={showSystem} onChange={(e) => setShowSystem(e.target.checked)} />Système</label>
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={showBench} disabled={!bench.length} onChange={(e) => setShowBench(e.target.checked)} />Remplaçantes</label>
      </>}
    >
      {(format, title) => <Poster starters={starters} bench={showBench ? bench : []} system={showSystem ? system : ""} match={match} format={format} title={title} draft={draft} />}
    </PosterStudio>
  );
}

function Poster({ starters, bench, system, match, format, title, draft }: {
  starters: LineupPosterPlayer[]; bench: LineupPosterBench[]; system: string; match: PosterMatch; format: PosterFormat; title: string; draft: boolean;
}) {
  const f = POSTER_FORMATS[format];
  const k = Math.min(1.15, f.header / 300);
  const benchH = bench.length ? (format === "story" ? 120 : 84) : 0;
  const pitch = { left: PAD, top: f.header + 4, width: f.width - PAD * 2, height: f.height - f.header - f.footer - benchH - 24 };
  // Taille d'une joueuse : limitée par la largeur (5 de front) et la hauteur (5 lignes).
  const tw = Math.min(pitch.width * 0.19, pitch.height * 0.185);
  const tokenW = tw * 1.3;
  const tokenH = tw * 1.3;
  const inner = { left: pitch.left + tokenW / 2, top: pitch.top + tokenH * 0.42, width: pitch.width - tokenW, height: pitch.height - tokenH * 0.96 };
  const captain = starters.find((p) => p.captain);

  return (
    <div style={{
      position: "relative", width: f.width, height: f.height, overflow: "hidden", fontFamily: TEXT, color: "#fff",
      background: `repeating-linear-gradient(125deg, rgba(255,255,255,0.035) 0 90px, rgba(255,255,255,0) 90px 210px), radial-gradient(90% 60% at 50% 45%, #0b4fb8 0%, ${ROYAL} 45%, ${NIGHT} 100%)`,
    }}>
      <div style={{ position: "absolute", top: -170, right: -250, width: 520, height: 230, background: FUCHSIA, transform: "rotate(-35deg)" }} />
      <div style={{ position: "absolute", top: -40, right: -300, width: 520, height: 46, background: "#ffffff", opacity: 0.9, transform: "rotate(-35deg)" }} />
      {draft ? <DraftRibbon /> : null}

      {/* En-tête */}
      <div style={{ position: "relative", height: f.header, padding: `${24 * k}px ${PAD}px 0`, display: "flex", flexDirection: "column", justifyContent: "center", gap: 14 * k }}>
        <div style={{ display: "flex", alignItems: "center", gap: 26 * k }}>
          <img src={LOGO} alt="Logo officiel du Yamoussoukro FC Féminin" style={{ height: 160 * k, width: "auto", flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            {match.kicker ? <p style={{ margin: 0, fontFamily: DISPLAY, fontWeight: 700, fontSize: 24 * k, letterSpacing: "0.18em", textTransform: "uppercase", color: "#ff5c9d" }}>{match.kicker}</p> : null}
            <p style={{ margin: 0, fontFamily: DISPLAY, fontWeight: 700, fontSize: 34 * k, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.85)", lineHeight: 1.1 }}>Yamoussoukro FC Féminin</p>
            <h1 style={{ margin: 0, fontFamily: DISPLAY, fontWeight: 800, fontSize: Math.min(104 * k, (f.width - 330 * k) / Math.max(8, title.length) * 1.85), lineHeight: 0.95, textTransform: "uppercase", color: "#fff" }}>{title}</h1>
          </div>
        </div>
        <MatchStrip match={match} k={k} light />
      </div>

      {/* Terrain */}
      <PitchLines {...pitch} />
      {system ? (
        <span style={{ position: "absolute", left: pitch.left + 18, top: pitch.top + 14, fontFamily: DISPLAY, fontWeight: 800, fontSize: 30 * k, letterSpacing: "0.06em", color: "#fff", background: FUCHSIA, borderRadius: 6, padding: "2px 12px" }}>{system}</span>
      ) : null}
      {starters.map((p) => {
        const pt = pitchPoint(p.x, p.y);
        return <Token key={p.id} p={p} tw={tw} cx={inner.left + pt.x * inner.width} cy={inner.top + pt.y * inner.height} />;
      })}

      {/* Remplaçantes */}
      {bench.length ? (
        <div style={{ position: "absolute", left: PAD, right: PAD, bottom: f.footer + 10, height: benchH - 10, display: "flex", alignItems: "center", gap: 18, borderTop: "2px solid rgba(255,255,255,0.18)" }}>
          <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 24, letterSpacing: "0.12em", color: FUCHSIA, flexShrink: 0 }}>REMPLAÇANTES</span>
          <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: bench.length > 7 ? 21 : 24, letterSpacing: "0.03em", lineHeight: 1.25 }}>
            {bench.map((b, i) => (
              <span key={b.id} style={{ whiteSpace: "nowrap" }}>
                {b.shirt != null ? <span style={{ color: FUCHSIA }}>{b.shirt} </span> : null}{b.lastName.toUpperCase()}{i < bench.length - 1 ? <span style={{ color: "rgba(255,255,255,0.4)" }}>{"  ·  "}</span> : null}
              </span>
            ))}
          </span>
        </div>
      ) : null}

      {/* Pied */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: f.footer, background: NIGHT, display: "flex", alignItems: "center", justifyContent: "space-between", padding: `0 ${PAD}px`, borderTop: `5px solid ${FUCHSIA}` }}>
        <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 22, letterSpacing: "0.14em", textTransform: "uppercase" }}>Yamoussoukro FC Féminin · Centre de Haute Performance</span>
        {captain ? <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 22, letterSpacing: "0.08em", textTransform: "uppercase", color: "#ff5c9d" }}>Capitaine : {captain.lastName}</span> : null}
      </div>
    </div>
  );
}

function Token({ p, tw, cx, cy }: { p: LineupPosterPlayer; tw: number; cx: number; cy: number }) {
  const w = tw * 1.3;
  const cut = useCutout(p.photo);
  // Photo sans cadre : bords fondus dans le terrain (effet « détouré »).
  const photo = tw * 0.8;
  const photoH = photo * 1.02;
  const last = p.lastName.toUpperCase();
  const nameSize = Math.min(tw * 0.2, (w * 1.75) / Math.max(6, last.length));
  const initials = `${p.firstName.charAt(0)}${p.lastName.charAt(0)}`.toUpperCase();
  return (
    <div style={{ position: "absolute", left: cx - w / 2, top: cy - tw * 0.42, width: w, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ position: "relative", width: w, height: photoH, display: "flex", justifyContent: "center" }}>
        {p.shirt != null ? (
          <span style={{ ...SHIRT_STYLE, position: "absolute", right: w / 2 + photo * 0.2, top: photoH * 0.5 - tw * 0.36, fontSize: tw * 0.66, letterSpacing: "-0.02em", zIndex: 2, color: "#fff", textShadow: "0 3px 10px rgba(7,22,46,0.95)" }}>{p.shirt}</span>
        ) : null}
        <div style={{ position: "relative", width: photo, height: photoH, overflow: "hidden", WebkitMaskImage: cut ? FADE_BOTTOM : FADE, maskImage: cut ? FADE_BOTTOM : FADE }}>
          {p.photo ? (
            <img src={cut ?? p.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 18%", filter: cut ? "drop-shadow(0 6px 10px rgba(0,0,0,0.45))" : undefined }} />
          ) : (
            <span style={{ display: "flex", width: photo * 0.78, height: photo * 0.78, margin: `${photo * 0.1}px auto 0`, borderRadius: "50%", alignItems: "center", justifyContent: "center", fontFamily: DISPLAY, fontWeight: 800, fontSize: photo * 0.34, color: "rgba(255,255,255,0.6)", background: `linear-gradient(165deg, #0b4fb8, ${NIGHT})` }}>{initials}</span>
          )}
        </div>
        {p.captain ? (
          <span style={{ position: "absolute", top: tw * 0.02, left: w / 2 + photo * 0.18, width: tw * 0.24, height: tw * 0.24, borderRadius: "50%", background: "#fff", color: NIGHT, border: `3px solid ${FUCHSIA}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: DISPLAY, fontWeight: 800, fontSize: tw * 0.15 }}>C</span>
        ) : null}
      </div>
      <span style={{ marginTop: -tw * 0.02, fontFamily: DISPLAY, fontWeight: 800, fontSize: nameSize, lineHeight: 1.05, letterSpacing: "0.03em", whiteSpace: "nowrap", textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>{last}</span>
      <span style={{ marginTop: 3, width: "62%", height: 4, borderRadius: 2, background: FUCHSIA }} />
    </div>
  );
}

/** Photo détourée dans le navigateur (fond uni retiré) ; null tant qu'elle n'est pas prête ou si le fond est chargé. */
function useCutout(src: string | null) {
  const [out, setOut] = useState<{ src: string; url: string | null } | null>(null);
  useEffect(() => {
    if (!src) return;
    let alive = true;
    cutout(src).then((url) => { if (alive) setOut({ src, url }); }).catch(() => { if (alive) setOut({ src, url: null }); });
    return () => { alive = false; };
  }, [src]);
  return out && out.src === src ? out.url : null;
}

/** Tracé du terrain (vue de dessus), attaque en haut. */
function PitchLines({ left, top, width, height }: { left: number; top: number; width: number; height: number }) {
  const s = { fill: "none", stroke: "rgba(255,255,255,0.32)", strokeWidth: 3, vectorEffect: "non-scaling-stroke" as const };
  return (
    <svg viewBox="0 0 68 105" preserveAspectRatio="none" style={{ position: "absolute", left, top, width, height }} aria-hidden>
      <rect x="0.5" y="0.5" width="67" height="104" {...s} />
      <line x1="0.5" y1="52.5" x2="67.5" y2="52.5" {...s} />
      <ellipse cx="34" cy="52.5" rx="9.15" ry="9.15" {...s} />
      <rect x="13.85" y="0.5" width="40.3" height="16.5" {...s} />
      <rect x="24.85" y="0.5" width="18.3" height="5.5" {...s} />
      <rect x="13.85" y="88" width="40.3" height="16.5" {...s} />
      <rect x="24.85" y="99" width="18.3" height="5.5" {...s} />
      <path d="M26.7 17 A9.15 9.15 0 0 0 41.3 17" {...s} />
      <path d="M26.7 88 A9.15 9.15 0 0 1 41.3 88" {...s} />
    </svg>
  );
}
