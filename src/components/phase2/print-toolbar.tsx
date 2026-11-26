"use client";

import { useState } from "react";
import { Download, Printer } from "lucide-react";
import { toPng } from "html-to-image";
import { Button } from "@/components/ui/button";

/** Barre d'outils des documents : impression / PDF (navigateur) et export PNG. */
export function PrintToolbar({ filename, landscape = false }: { filename: string; landscape?: boolean }) {
  const [busy, setBusy] = useState(false);
  async function png() {
    const el = document.getElementById("document");
    if (!el) return;
    setBusy(true);
    try {
      const url = await toPng(el, { pixelRatio: 2, backgroundColor: "#ffffff" });
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.png`;
      a.click();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="no-print sticky top-0 z-10 mb-4 flex flex-wrap items-center justify-center gap-2 bg-[#07162E] p-3 text-white">
      {landscape ? <style>{"@media print { @page { size: A4 landscape; } }"}</style> : null}
      <Button onClick={() => window.print()}><Printer />Imprimer / Enregistrer en PDF</Button>
      <Button variant="secondary" onClick={png} disabled={busy}><Download />{busy ? "Export…" : "Exporter en PNG"}</Button>
      <Button variant="ghost" className="text-white hover:bg-white/10" onClick={() => window.close()}>Fermer</Button>
      <p className="w-full text-center text-xs text-white/60">Pour un PDF : « Imprimer » puis choisissez « Enregistrer au format PDF » comme imprimante.</p>
    </div>
  );
}
