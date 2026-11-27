"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { POSTER_FORMATS, posterGrid, type PosterFormat } from "@/lib/phase2/poster-layout";
import { DISPLAY, DraftRibbon, FUCHSIA, LOGO, MatchStrip, NIGHT, PosterStudio, ROYAL, SHIRT_STYLE, TEXT, type PosterMatch } from "./poster-studio";

export type { PosterMatch } from "./poster-studio";
export type PosterPlayer = { id: string; firstName: string; lastName: string; shirt: number | null; position: string | null; photo: string | null; sort: number };

const PAD = 32;
const GAP = 12;

export function SquadPoster({ players, match, validated, hasSquad }: { players: PosterPlayer[]; match: PosterMatch; validated: boolean; hasSquad: boolean }) {
  const [showNumbers, setShowNumbers] = useState(true);
  const [showPositions, setShowPositions] = useState(true);
  const n = players.length;
  return (
    <PosterStudio
      filename={`affiche-convoquees-${match.day}`}
      defaultTitle="Les convoquées"
      background="#f4f6fa"
      draftNotice={validated ? null : "La convocation n'est pas encore validée : l'affiche porte la mention « Provisoire » jusqu'à sa validation."}
      empty={n ? null : `${hasSquad ? "Aucune joueuse n'a le statut « Convoquée » pour ce match." : "Aucune convocation pour ce match."} Composez d'abord la convocation dans l'onglet « Convocation » du match.`}
      footnote={`${n} joueuse${n > 1 ? "s" : ""} convoquée${n > 1 ? "s" : ""}`}
      controls={<>
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={showNumbers} onChange={(e) => setShowNumbers(e.target.checked)} />Numéros</label>
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={showPositions} onChange={(e) => setShowPositions(e.target.checked)} />Postes</label>
      </>}
    >
      {(format, title) => <Poster players={players} match={match} format={format} title={title} showNumbers={showNumbers} showPositions={showPositions} draft={!validated} />}
    </PosterStudio>
  );
}

function Poster({ players, match, format, title, showNumbers, showPositions, draft }: {
  players: PosterPlayer[]; match: PosterMatch; format: PosterFormat; title: string; showNumbers: boolean; showPositions: boolean; draft: boolean;
}) {
  const f = POSTER_FORMATS[format];
  const k = Math.min(1.15, f.header / 300);
  const gridW = f.width - PAD * 2;
  const gridH = f.height - f.header - f.footer - PAD;
  const grid = posterGrid(players.length, gridW, gridH, { gap: GAP });
  const rows: PosterPlayer[][] = [];
  let i = 0;
  for (const n of grid.rows) { rows.push(players.slice(i, i + n)); i += n; }

  return (
    <div style={{
      position: "relative", width: f.width, height: f.height, overflow: "hidden", fontFamily: TEXT, color: NIGHT,
      background: `repeating-linear-gradient(125deg, rgba(255,255,255,0.55) 0 90px, rgba(255,255,255,0) 90px 210px), linear-gradient(160deg, #ffffff 0%, #eef1f7 55%, #e3e8f2 100%)`,
    }}>
      {/* Bande d'accent */}
      <div style={{ position: "absolute", top: -170, right: -250, width: 520, height: 230, background: FUCHSIA, transform: "rotate(-35deg)" }} />
      <div style={{ position: "absolute", top: -40, right: -300, width: 520, height: 46, background: ROYAL, transform: "rotate(-35deg)" }} />

      {/* En-tête */}
      <div style={{ position: "relative", height: f.header, padding: `${28 * k}px ${PAD}px 0`, display: "flex", flexDirection: "column", justifyContent: "center", gap: 16 * k }}>
        <div style={{ display: "flex", alignItems: "center", gap: 28 * k }}>
          <img src={LOGO} alt="Logo officiel du Yamoussoukro FC Féminin" style={{ height: 168 * k, width: "auto", flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            {match.kicker ? <p style={{ margin: 0, fontFamily: DISPLAY, fontWeight: 700, fontSize: 24 * k, letterSpacing: "0.18em", textTransform: "uppercase", color: "#d1005a" }}>{match.kicker}</p> : null}
            <p style={{ margin: 0, fontFamily: DISPLAY, fontWeight: 700, fontSize: 34 * k, letterSpacing: "0.06em", textTransform: "uppercase", color: ROYAL, lineHeight: 1.1 }}>Yamoussoukro FC Féminin</p>
            <h1 style={{ margin: 0, fontFamily: DISPLAY, fontWeight: 800, fontSize: Math.min(104 * k, (f.width - 330 * k) / Math.max(8, title.length) * 1.85), lineHeight: 0.95, textTransform: "uppercase", color: NIGHT }}>{title || "Les convoquées"}</h1>
          </div>
        </div>
        <MatchStrip match={match} k={k} />
      </div>

      {draft ? <DraftRibbon /> : null}

      {/* Grille des joueuses */}
      <div style={{ position: "absolute", left: PAD, top: f.header + PAD / 2, width: gridW, height: gridH, display: "flex", flexDirection: "column", justifyContent: "center", gap: GAP }}>
        {rows.map((row, r) => (
          <div key={r} style={{ display: "flex", justifyContent: "center", gap: GAP }}>
            {row.map((p) => <Card key={p.id} p={p} w={grid.cardWidth} h={grid.cardHeight} showNumber={showNumbers} showPosition={showPositions} />)}
          </div>
        ))}
      </div>

      {/* Pied */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: f.footer, background: NIGHT, color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", padding: `0 ${PAD}px`, borderTop: `5px solid ${FUCHSIA}` }}>
        <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 22, letterSpacing: "0.14em", textTransform: "uppercase" }}>Yamoussoukro FC Féminin · Centre de Haute Performance</span>
        <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 22, letterSpacing: "0.08em", textTransform: "uppercase", color: "#ff5c9d" }}>{players.length} convoquée{players.length > 1 ? "s" : ""}</span>
      </div>
    </div>
  );
}

function Card({ p, w, h, showNumber, showPosition }: { p: PosterPlayer; w: number; h: number; showNumber: boolean; showPosition: boolean }) {
  const last = p.lastName.toUpperCase();
  const lastSize = Math.min(w * 0.135, (w * 1.75) / Math.max(6, last.length));
  const firstSize = Math.min(w * 0.085, (w * 1.7) / Math.max(10, p.firstName.length));
  const initials = `${p.firstName.charAt(0)}${p.lastName.charAt(0)}`.toUpperCase();
  return (
    <div style={{ position: "relative", width: w, height: h, borderRadius: w * 0.06, overflow: "hidden", flexShrink: 0, background: `linear-gradient(165deg, #0b4fb8 0%, ${ROYAL} 42%, ${NIGHT} 100%)`, boxShadow: "0 6px 16px rgba(7,22,46,0.28)" }}>
      <div style={{ position: "absolute", top: -h * 0.1, right: -w * 0.55, width: w, height: h * 0.5, background: FUCHSIA, opacity: 0.55, transform: "rotate(-35deg)" }} />
      {p.photo ? (
        <img src={p.photo} alt="" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "80%", objectFit: "cover", objectPosition: "center 18%" }} />
      ) : (
        <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "72%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: DISPLAY, fontWeight: 800, fontSize: w * 0.42, color: "rgba(255,255,255,0.22)" }}>{initials}</div>
      )}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "52%", background: `linear-gradient(180deg, rgba(7,22,46,0) 0%, rgba(7,22,46,0.82) 42%, ${NIGHT} 70%)` }} />
      {showNumber && p.shirt != null ? (
        <span style={{ position: "absolute", top: w * 0.04, left: w * 0.06, ...SHIRT_STYLE, fontSize: w * 0.24 }}>{p.shirt}</span>
      ) : null}
      <img src={LOGO} alt="" style={{ position: "absolute", top: w * 0.05, right: w * 0.05, width: w * 0.17, height: "auto", filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.4))" }} />
      <div style={{ position: "absolute", left: 4, right: 4, bottom: w * 0.07, textAlign: "center", color: "#fff" }}>
        <p style={{ margin: 0, fontWeight: 600, fontSize: firstSize, lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.firstName}</p>
        <p style={{ margin: 0, fontFamily: DISPLAY, fontWeight: 800, fontSize: lastSize, lineHeight: 1.02, letterSpacing: "0.02em", whiteSpace: "nowrap" }}>{last}</p>
        {showPosition && p.position ? (
          <span style={{ display: "inline-block", marginTop: w * 0.03, background: FUCHSIA, borderRadius: 4, padding: `1px ${w * 0.04}px`, fontFamily: DISPLAY, fontWeight: 700, fontSize: w * 0.075, letterSpacing: "0.08em" }}>{p.position}</span>
        ) : null}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 4, background: FUCHSIA }} />
    </div>
  );
}
