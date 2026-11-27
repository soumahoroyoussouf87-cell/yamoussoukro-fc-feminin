"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import { toJpeg, toPng } from "html-to-image";
import { Download, FileImage, Loader2, MessageCircle, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { POSTER_FORMATS, type PosterFormat } from "@/lib/phase2/poster-layout";
import { downloadBlob } from "@/components/training/raster";

/** Éléments communs aux affiches partageables (convoquées, onze de départ). */
export type Team = { name: string; logo: string | null };
export type PosterMatch = { id: string; day: string; kicker: string; dateLabel: string; venue: string | null; home: Team; away: Team };

export const NIGHT = "#07162e";
export const ROYAL = "#063580";
export const FUCHSIA = "#ff0068";
export const LOGO = "/brand/logo-officiel-yfc.png";
export const DISPLAY = "var(--font-barlow), 'Arial Narrow', sans-serif";
export const TEXT = "var(--font-inter), Arial, sans-serif";
/** Numéros de dossard : rose officiel, ombre marine pour rester lisibles sur les photos. */
export const SHIRT_STYLE = { fontFamily: DISPLAY, fontWeight: 800, lineHeight: 1, color: FUCHSIA, textShadow: "0 2px 6px rgba(7,22,46,0.75), 0 0 1px rgba(255,255,255,0.8)" } as const;

type Busy = null | "png" | "jpeg" | "whatsapp" | "share";

export function PosterStudio({ filename, defaultTitle, background, draftNotice, empty, controls, footnote, children }: {
  /** Début du nom des fichiers exportés, sans extension. */
  filename: string;
  defaultTitle: string;
  /** Couleur de fond des exports JPEG. */
  background: string;
  draftNotice?: string | null;
  /** Message affiché à la place de l'affiche quand il n'y a rien à montrer. */
  empty?: React.ReactNode;
  controls?: React.ReactNode;
  footnote?: string;
  children: (format: PosterFormat, title: string) => React.ReactNode;
}) {
  const [format, setFormat] = useState<PosterFormat>("portrait");
  const [title, setTitle] = useState(defaultTitle);
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
  }, [empty]);

  const f = POSTER_FORMATS[format];
  const maxDisplay = format === "story" ? 420 : 600;
  const scale = Math.min(boxWidth, maxDisplay) / f.width;
  const base = `${filename}${format === "portrait" ? "" : `-${format}`}`;

  async function render(kind: "png" | "jpeg-hd" | "whatsapp") {
    const node = poster.current!;
    await document.fonts.ready;
    const opts = { width: f.width, height: f.height, cacheBust: false, style: { transform: "none" }, backgroundColor: background };
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
            await navigator.share({ files: [file], title });
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
    <Button variant={variant} onClick={() => run(kind)} disabled={!!busy || !!empty}>{busy === kind ? <Loader2 className="animate-spin" /> : icon}{label}</Button>
  );

  return (
    <div className="flex flex-col items-center">
      <div className="no-print z-10 mb-4 flex w-full flex-col items-center gap-2 bg-[#07162E] p-3 text-white sm:sticky sm:top-0">
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
          {controls}
        </div>
        <p className="text-center text-xs text-white/70">
          PNG HD et JPEG HD : {f.width * 2} × {f.height * 2} pixels (impression, réseaux sociaux). Version WhatsApp : {f.width} × {f.height}, plus légère.
        </p>
        {draftNotice && !empty ? <p className="rounded bg-[#fff4d6] px-3 py-1 text-center text-xs font-semibold text-[#8a5a00]">{draftNotice}</p> : null}
        {error ? <p role="alert" className="rounded bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">{error}</p> : null}
        {info ? <p className="rounded bg-white/10 px-3 py-1 text-xs">{info}</p> : null}
      </div>

      {empty ? (
        <p className="mx-4 rounded-lg bg-white p-6 text-center text-sm">{empty}</p>
      ) : (
        <div ref={box} className="w-full max-w-[600px] px-4">
          <div className="mx-auto overflow-hidden rounded-md shadow-2xl" style={{ width: f.width * scale, height: f.height * scale }}>
            <div ref={poster} id="affiche" style={{ width: f.width, height: f.height, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
              {children(format, title || defaultTitle)}
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-white/70">{footnote ? `${footnote} · ` : ""}aperçu réduit, l&apos;export est en pleine résolution.</p>
        </div>
      )}
    </div>
  );
}

/** Bandeau oblique « PROVISOIRE » dans le coin supérieur droit. */
export function DraftRibbon({ label = "PROVISOIRE" }: { label?: string }) {
  return (
    <div style={{ position: "absolute", top: 34, right: -62, width: 260, transform: "rotate(35deg)", background: "#f59e0b", color: NIGHT, textAlign: "center", fontFamily: DISPLAY, fontWeight: 800, fontSize: 24, letterSpacing: "0.2em", padding: "6px 0", boxShadow: "0 4px 12px rgba(0,0,0,0.2)", zIndex: 5 }}>{label}</div>
  );
}

export function MatchStrip({ match, k, light = false }: { match: PosterMatch; k: number; light?: boolean }) {
  const logo = (t: Team) => (
    <span style={{ width: 54 * k, height: 54 * k, borderRadius: "50%", background: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
      {t.logo ? <img src={t.logo} alt={`Logo ${t.name}`} style={{ width: "84%", height: "84%", objectFit: "contain" }} /> : <span style={{ fontWeight: 700, fontSize: 18 * k, color: NIGHT }}>{t.name.slice(0, 2).toUpperCase()}</span>}
    </span>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 * k, background: light ? "rgba(255,255,255,0.1)" : NIGHT, color: "#fff", borderRadius: 999, padding: `${8 * k}px ${22 * k}px ${8 * k}px ${8 * k}px`, borderLeft: `6px solid ${FUCHSIA}` }}>
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

