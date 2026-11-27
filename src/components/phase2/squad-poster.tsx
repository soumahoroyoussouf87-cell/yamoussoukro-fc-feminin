"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import { toJpeg, toPng } from "html-to-image";
import { Download, FileImage, Loader2, MessageCircle, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { POSTER_FORMATS, posterGrid, type PosterFormat } from "@/lib/phase2/poster-layout";
import { downloadBlob } from "@/components/training/raster";

export type PosterPlayer = { id: string; firstName: string; lastName: string; shirt: number | null; position: string | null; photo: string | null; sort: number };
type Team = { name: string; logo: string | null };
export type PosterMatch = { id: string; day: string; kicker: string; dateLabel: string; venue: string | null; home: Team; away: Team };

const NIGHT = "#07162e";
const ROYAL = "#063580";
const FUCHSIA = "#ff0068";
const LOGO = "/brand/logo-officiel-yfc.png";
const DISPLAY = "var(--font-barlow), 'Arial Narrow', sans-serif";
const TEXT = "var(--font-inter), Arial, sans-serif";
const PAD = 32;
const GAP = 12;

type Busy = null | "png" | "jpeg" | "whatsapp" | "share";

export function SquadPoster({ players, match, validated, hasSquad }: { players: PosterPlayer[]; match: PosterMatch; validated: boolean; hasSquad: boolean }) {
  const [format, setFormat] = useState<PosterFormat>("portrait");
  const [title, setTitle] = useState("Les convoquées");
  const [showNumbers, setShowNumbers] = useState(true);
  const [showPositions, setShowPositions] = useState(true);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const poster = useRef<HTMLDivElement>(null);
  const [boxWidth, setBoxWidth] = useState(560);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBoxWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const f = POSTER_FORMATS[format];
  const maxDisplay = format === "story" ? 420 : 600;
  const scale = Math.min(boxWidth, maxDisplay) / f.width;
  const base = `affiche-convoquees-${match.day}${format === "portrait" ? "" : `-${format}`}`;

  async function render(kind: "png" | "jpeg-hd" | "whatsapp") {
    const node = poster.current!;
    await document.fonts.ready;
    const opts = { width: f.width, height: f.height, cacheBust: false, style: { transform: "none" }, backgroundColor: "#f4f6fa" };
    // Premier rendu à blanc : certains navigateurs (Safari) n'intègrent les images qu'au second passage.
    await toPng(node, { ...opts, pixelRatio: 0.2 });
    const url = kind === "png" ? await toPng(node, { ...opts, pixelRatio: 2 })
      : await toJpeg(node, { ...opts, pixelRatio: kind === "whatsapp" ? 1 : 2, quality: kind === "whatsapp" ? 0.86 : 0.95 });
    return await (await fetch(url)).blob();
  }

  async function run(kind: Exclude<Busy, null>) {
    setBusy(kind);
    setError(null);
    setInfo(null);
    try {
      if (kind === "png") downloadBlob(await render("png"), `${base}.png`);
      if (kind === "jpeg") downloadBlob(await render("jpeg-hd"), `${base}-hd.jpg`);
      if (kind === "whatsapp") downloadBlob(await render("whatsapp"), `${base}-whatsapp.jpg`);
      if (kind === "share") {
        const blob = await render("whatsapp");
        const file = new File([blob], `${base}.jpg`, { type: "image/jpeg" });
        if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title: title });
          } catch (e) {
            if ((e as Error).name !== "AbortError") throw e;
          }
        } else {
          downloadBlob(blob, file.name);
          setInfo("Le partage direct n'est pas disponible sur cet appareil : l'image a été téléchargée, envoyez-la depuis WhatsApp.");
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export impossible");
    } finally {
      setBusy(null);
    }
  }

  const btn = (kind: Exclude<Busy, null>, icon: React.ReactNode, label: string, variant: "default" | "secondary" = "secondary") => (
    <Button variant={variant} onClick={() => run(kind)} disabled={!!busy || !players.length}>{busy === kind ? <Loader2 className="animate-spin" /> : icon}{label}</Button>
  );

  return (
    <div className="flex flex-col items-center">
      <div className="no-print z-10 mb-4 flex w-full flex-col sm:sticky sm:top-0 items-center gap-2 bg-[#07162E] p-3 text-white">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {btn("png", <FileImage />, "PNG HD", "default")}
          {btn("jpeg", <Download />, "JPEG HD")}
          {btn("whatsapp", <MessageCircle />, "Version WhatsApp")}
          {btn("share", <Share2 />, "Partager")}
          <Button variant="ghost" className="text-white hover:bg-white/10" onClick={() => window.close()}><X />Fermer</Button>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
          <label className="flex items-center gap-2">Format
            <Select value={format} onChange={(e) => setFormat(e.target.value as PosterFormat)} className="h-8 w-auto bg-white text-[#07162E]" aria-label="Format">
              {(Object.keys(POSTER_FORMATS) as PosterFormat[]).map((k) => <option key={k} value={k}>{POSTER_FORMATS[k].label}</option>)}
            </Select>
          </label>
          <label className="flex items-center gap-2">Titre
            <Input value={title} maxLength={28} onChange={(e) => setTitle(e.target.value)} className="h-8 w-48 bg-white text-[#07162E]" aria-label="Titre de l'affiche" />
          </label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={showNumbers} onChange={(e) => setShowNumbers(e.target.checked)} />Numéros</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={showPositions} onChange={(e) => setShowPositions(e.target.checked)} />Postes</label>
        </div>
        <p className="text-center text-xs text-white/70">
          PNG HD et JPEG HD : {f.width * 2} × {f.height * 2} pixels (impression, réseaux sociaux). Version WhatsApp : {f.width} × {f.height}, plus légère.
        </p>
        {!validated && players.length ? <p className="rounded bg-[#fff4d6] px-3 py-1 text-center text-xs font-semibold text-[#8a5a00]">La convocation n&apos;est pas encore validée : l&apos;affiche porte la mention « Provisoire » jusqu&apos;à sa validation.</p> : null}
        {error ? <p role="alert" className="rounded bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">{error}</p> : null}
        {info ? <p className="rounded bg-white/10 px-3 py-1 text-xs">{info}</p> : null}
      </div>

      {!players.length ? (
        <p className="mx-4 rounded-lg bg-white p-6 text-center text-sm">
          {hasSquad ? "Aucune joueuse n'a le statut « Convoquée » pour ce match." : "Aucune convocation pour ce match."} Composez d&apos;abord la convocation dans l&apos;onglet « Convocation » du match.
        </p>
      ) : (
        <div ref={box} className="w-full max-w-[600px] px-4">
          <div className="mx-auto overflow-hidden rounded-md shadow-2xl" style={{ width: f.width * scale, height: f.height * scale }}>
            <div ref={poster} id="affiche" style={{ width: f.width, height: f.height, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
              <Poster players={players} match={match} format={format} title={title} showNumbers={showNumbers} showPositions={showPositions} draft={!validated} />
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-white/70">{players.length} joueuse{players.length > 1 ? "s" : ""} convoquée{players.length > 1 ? "s" : ""} · aperçu réduit, l&apos;export est en pleine résolution.</p>
        </div>
      )}
    </div>
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

      {draft ? (
        <div style={{ position: "absolute", top: 34, right: -62, width: 260, transform: "rotate(35deg)", background: "#f59e0b", color: NIGHT, textAlign: "center", fontFamily: DISPLAY, fontWeight: 800, fontSize: 24, letterSpacing: "0.2em", padding: "6px 0", boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>PROVISOIRE</div>
      ) : null}

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

function MatchStrip({ match, k }: { match: PosterMatch; k: number }) {
  const logo = (t: Team) => (
    <span style={{ width: 54 * k, height: 54 * k, borderRadius: "50%", background: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
      {t.logo ? <img src={t.logo} alt={`Logo ${t.name}`} style={{ width: "84%", height: "84%", objectFit: "contain" }} /> : <span style={{ fontWeight: 700, fontSize: 18 * k, color: NIGHT }}>{t.name.slice(0, 2).toUpperCase()}</span>}
    </span>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 * k, background: NIGHT, color: "#fff", borderRadius: 999, padding: `${8 * k}px ${22 * k}px ${8 * k}px ${8 * k}px`, borderLeft: `6px solid ${FUCHSIA}` }}>
      {logo(match.home)}
      <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 30 * k, textTransform: "uppercase", whiteSpace: "nowrap" }}>{match.home.name}</span>
      <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 24 * k, color: FUCHSIA }}>VS</span>
      <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 30 * k, textTransform: "uppercase", whiteSpace: "nowrap" }}>{match.away.name}</span>
      {logo(match.away)}
      <span style={{ marginLeft: "auto", textAlign: "right", fontSize: 18 * k, lineHeight: 1.25, color: "rgba(255,255,255,0.88)" }}>
        <span style={{ display: "block", fontWeight: 700, textTransform: "capitalize" }}>{match.dateLabel}</span>
        {match.venue ? <span style={{ display: "block" }}>{match.venue}</span> : null}
      </span>
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
        <span style={{ position: "absolute", top: w * 0.04, left: w * 0.06, fontFamily: DISPLAY, fontWeight: 800, fontSize: w * 0.24, lineHeight: 1, color: "#fff", textShadow: "0 2px 6px rgba(0,0,0,0.55)" }}>{p.shirt}</span>
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
