"use client";

import { useEffect, useState } from "react";
import { Archive, Download, Eye, FileImage, FileText, Loader2, MessageCircle, Printer, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { weekSummary } from "@/lib/training/actions";
import type { SheetData } from "@/lib/training/sheet-types";
import { cn } from "@/lib/utils";
import { downloadBlob, slug } from "../raster";
import { TEMPLATES, type ExportOptions, type Orientation, type PaperSize, type TemplateId } from "./templates";

type Busy = null | "preview" | "pdf" | "print" | "jpeg" | "whatsapp" | "png" | "zip" | "share";

/** Rendu d'un PDF en images, page par page (pdf.js). */
async function rasterize(pdfBlob: Blob, opts: { dpi?: number; maxSide?: number; type: "image/png" | "image/jpeg"; quality?: number }) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
  const task = pdfjs.getDocument({ data: new Uint8Array(await pdfBlob.arrayBuffer()) });
  const doc = await task.promise;
  const out: Blob[] = [];
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      let scale = opts.dpi ? opts.dpi / 72 : 2;
      if (opts.maxSide) scale = opts.maxSide / Math.max(base.width, base.height);
      // Les navigateurs mobiles limitent la taille des images (~16 millions de pixels).
      const maxPixels = 16_000_000;
      if (base.width * base.height * scale * scale > maxPixels) scale = Math.sqrt(maxPixels / (base.width * base.height));
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, canvas, viewport }).promise;
      out.push(await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Image impossible"))), opts.type, opts.quality ?? 0.92)));
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }
  return out;
}

/** Inscrit la résolution (DPI) dans un JPEG (en-tête JFIF), pour l'impression. */
async function withJfifDpi(blob: Blob, dpi: number) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  // Segment APP0 « JFIF » juste après SOI (FFD8) : unités = 1 (ppp), densités X et Y.
  if (buf[2] === 0xff && buf[3] === 0xe0 && buf[6] === 0x4a && buf[7] === 0x46) {
    buf[13] = 1;
    buf[14] = dpi >> 8; buf[15] = dpi & 0xff;
    buf[16] = dpi >> 8; buf[17] = dpi & 0xff;
  }
  return new Blob([buf], { type: "image/jpeg" });
}

/** Dernier PDF produit (évite de le recalculer pour chaque format). */
const pdfCache = new Map<string, Blob>();

export function ExportPanel({ data }: { data: SheetData }) {
  const s = data.session;
  const items = data.phases.flatMap((p) => p.items);
  const [template, setTemplate] = useState<TemplateId>("complete");
  const [size, setSize] = useState<PaperSize>("A4");
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [itemId, setItemId] = useState<string>(items[0]?.id ?? "");
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [preview, setPreview] = useState<string[] | null>(null);

  useEffect(() => () => preview?.forEach((u) => URL.revokeObjectURL(u)), [preview]);

  const key = JSON.stringify({ id: s.id, template, size, orientation, itemId, at: s.updated_at, n: data.attendance.length, e: data.evaluation?.updated_at });
  const base = `seance-${s.number}-${s.session_date}-${slug(TEMPLATES.find((t) => t.id === template)!.label)}${size === "A3" ? "-a3" : ""}`;

  const makePdf = async () => {
    const hit = pdfCache.get(key);
    if (hit) return hit;
    const [{ pdf }, mod] = await Promise.all([import("@react-pdf/renderer"), import("./sheet-pdf")]);
    const origin = window.location.origin;
    mod.registerFonts(origin);
    let week: ExportOptions["week"] = null;
    if (template === "semaine") {
      const r = await weekSummary(s.id);
      if (!r.ok) throw new Error(r.error);
      week = { monday: r.monday, rows: r.rows };
    }
    const o: ExportOptions = { template, size, orientation, itemId, week, origin };
    const blob = await pdf(<mod.SheetDocument d={data} o={o} />).toBlob();
    pdfCache.clear();
    pdfCache.set(key, blob);
    return blob;
  };

  const run = async (b: Busy, fn: () => Promise<void>) => {
    setBusy(b);
    setError(null);
    setInfo(null);
    try { await fn(); }
    catch (e) { setError(e instanceof Error && e.message ? `Export impossible : ${e.message}` : "Export impossible."); }
    finally { setBusy(null); }
  };

  const doPreview = () => run("preview", async () => {
    const blob = await makePdf();
    const pages = await rasterize(blob, { maxSide: 1100, type: "image/jpeg", quality: 0.85 });
    setPreview(pages.map((p) => URL.createObjectURL(p)));
  });
  const doPdf = () => run("pdf", async () => downloadBlob(await makePdf(), `${base}.pdf`));
  const doPrint = () => run("print", async () => {
    const url = URL.createObjectURL(await makePdf());
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    frame.src = url;
    document.body.appendChild(frame);
    await new Promise<void>((res) => { frame.onload = () => res(); setTimeout(res, 4000); });
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch {
      window.open(url, "_blank", "noopener");
    }
    setTimeout(() => { frame.remove(); URL.revokeObjectURL(url); }, 60_000);
  });
  const doImages = (b: "jpeg" | "png" | "whatsapp") => () =>
    run(b, async () => {
      const blob = await makePdf();
      const pages =
        b === "jpeg" ? await Promise.all((await rasterize(blob, { dpi: 300, type: "image/jpeg", quality: 0.92 })).map((p) => withJfifDpi(p, 300)))
        : b === "png" ? await rasterize(blob, { dpi: 200, type: "image/png" })
        : await rasterize(blob, { maxSide: 1600, type: "image/jpeg", quality: 0.82 });
      const ext = b === "png" ? "png" : "jpg";
      const suffix = b === "whatsapp" ? "-whatsapp" : b === "jpeg" ? "-300dpi" : "-hd";
      if (pages.length === 1) return downloadBlob(pages[0], `${base}${suffix}.${ext}`);
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      pages.forEach((p, k) => zip.file(`${base}${suffix}-page-${String(k + 1).padStart(2, "0")}.${ext}`, p));
      downloadBlob(await zip.generateAsync({ type: "blob" }), `${base}${suffix}.zip`);
      setInfo(`${pages.length} pages regroupées dans un fichier ZIP.`);
    });
  const doZip = () => run("zip", async () => {
    const blob = await makePdf();
    const pages = await Promise.all((await rasterize(blob, { dpi: 300, type: "image/jpeg", quality: 0.92 })).map((p) => withJfifDpi(p, 300)));
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    zip.file(`${base}.pdf`, blob);
    pages.forEach((p, k) => zip.file(`pages/${base}-page-${String(k + 1).padStart(2, "0")}.jpg`, p));
    downloadBlob(await zip.generateAsync({ type: "blob" }), `${base}.zip`);
    setInfo(`ZIP : PDF et ${pages.length} page(s) en JPEG 300 DPI.`);
  });
  const doShare = () => run("share", async () => {
    const blob = await makePdf();
    const file = new File([blob], `${base}.pdf`, { type: "application/pdf" });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.share && nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: `Séance n°${s.number}`, text: `${s.theme ?? "Séance d'entraînement"} — ${s.session_date}` });
      } catch (e) {
        if ((e as Error).name !== "AbortError") throw e;
      }
      return;
    }
    downloadBlob(blob, file.name);
    setInfo("Le partage direct n'est pas disponible sur cet appareil : le PDF a été téléchargé, tu peux l'envoyer depuis tes fichiers.");
  });

  const pick = (t: TemplateId) => { setTemplate(t); setOrientation(TEMPLATES.find((x) => x.id === t)!.orientation); setPreview(null); };
  const btn = (id: Busy, Icon: typeof Download, label: string, onClick: () => void, variant: "outline" | "default" | "secondary" = "outline") => (
    <Button key={id} type="button" variant={variant} size="sm" disabled={!!busy} onClick={() => void onClick()}>
      {busy === id ? <Loader2 className="animate-spin" /> : <Icon />}{label}
    </Button>
  );

  return (
    <div className="flex flex-col gap-4">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Modèle</legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {TEMPLATES.map((t) => (
            <label key={t.id} className={cn("flex cursor-pointer flex-col gap-0.5 rounded-lg border p-3 text-sm", template === t.id ? "border-primary bg-primary/5" : "hover:bg-accent")}>
              <span className="flex items-center gap-2 font-semibold">
                <input type="radio" name="template" value={t.id} checked={template === t.id} onChange={() => pick(t.id)} className="accent-[var(--primary)]" />{t.label}
              </span>
              <span className="text-xs text-muted-foreground">{t.description}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">Format
          <Select className="h-9 w-28" value={size} onChange={(e) => { setSize(e.target.value as PaperSize); setPreview(null); }}><option value="A4">A4</option><option value="A3">A3</option></Select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">Orientation
          <Select className="h-9 w-36" value={orientation} onChange={(e) => { setOrientation(e.target.value as Orientation); setPreview(null); }}><option value="portrait">Portrait</option><option value="landscape">Paysage</option></Select>
        </label>
        {template === "exercice" ? (
          <label className="flex min-w-60 flex-1 flex-col gap-1 text-sm font-medium">Exercice
            <Select className="h-9" value={itemId} onChange={(e) => { setItemId(e.target.value); setPreview(null); }}>
              {items.map((i, k) => <option key={i.id} value={i.id}>{k + 1}. {i.exercise.title}</option>)}
            </Select>
          </label>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {btn("preview", Eye, "Aperçu", doPreview, "secondary")}
        {btn("print", Printer, "Imprimer", doPrint)}
        {btn("pdf", FileText, "PDF", doPdf, "default")}
        {btn("jpeg", FileImage, "JPEG 300 DPI", doImages("jpeg"))}
        {btn("whatsapp", MessageCircle, "Version WhatsApp", doImages("whatsapp"))}
        {btn("png", FileImage, "PNG HD", doImages("png"))}
        {btn("zip", Archive, "ZIP (toutes les pages)", doZip)}
        {btn("share", Share2, "Partager", doShare)}
      </div>
      {busy ? <p className="text-xs text-muted-foreground" role="status">Préparation du document…</p> : null}
      {error ? <p role="alert" className="text-sm font-medium text-danger">{error}</p> : null}
      {info ? <p role="status" className="text-sm text-success">{info}</p> : null}
      {preview ? (
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Aperçu · {preview.length} page(s)</p>
            <Button type="button" size="sm" variant="ghost" onClick={() => setPreview(null)} aria-label="Fermer l'aperçu"><X /></Button>
          </div>
          <div className="flex flex-col items-center gap-3">
            {preview.map((u, k) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={u} src={u} alt={`Page ${k + 1} du document`} className="w-full max-w-3xl rounded border bg-white shadow" />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
