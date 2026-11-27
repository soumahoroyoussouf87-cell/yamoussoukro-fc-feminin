"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ImageUp, Loader2, XCircle } from "lucide-react";
import { compressImage } from "@/components/players/compress-image";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { importPlayerPhoto } from "./actions";
import { matchPlayer, type ImportPlayer } from "./match-photo";

export type { ImportPlayer };

type Row = { file: File; preview: string; playerId: string; status: "idle" | "busy" | "ok" | "error"; message?: string };

export function PhotoImport({ players }: { players: ImportPlayer[] }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [replace, setReplace] = useState(false);
  const [running, setRunning] = useState(false);
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const pick = (files: FileList | null) => {
    rows.forEach((r) => URL.revokeObjectURL(r.preview));
    const list = Array.from(files ?? []).filter((f) => /^image\/(png|jpeg|webp)$/.test(f.type));
    setRows(list.sort((a, b) => a.name.localeCompare(b.name, "fr", { numeric: true })).map((file) => ({ file, preview: URL.createObjectURL(file), playerId: matchPlayer(file.name, players), status: "idle" })));
  };
  const setRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const todo = rows.map((r, i) => ({ r, i })).filter(({ r }) => r.playerId && r.status !== "ok" && (replace || !byId.get(r.playerId)?.hasPhoto));
  const dupes = new Set(rows.map((r) => r.playerId).filter((id, i, a) => id && a.indexOf(id) !== i));

  async function run() {
    setRunning(true);
    for (const { r, i } of todo) {
      if (dupes.has(r.playerId)) { setRow(i, { status: "error", message: "Plusieurs photos pour la même joueuse" }); continue; }
      setRow(i, { status: "busy" });
      try {
        const small = await compressImage(r.file);
        const fd = new FormData();
        fd.set("photo", small);
        const res = await importPlayerPhoto(r.playerId, fd);
        setRow(i, res.ok ? { status: "ok" } : { status: "error", message: res.error });
      } catch {
        setRow(i, { status: "error", message: "Erreur réseau, réessayez" });
      }
    }
    setRunning(false);
  }

  const done = rows.filter((r) => r.status === "ok").length;
  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-4">
        <label className="block text-sm font-semibold" htmlFor="photos">1. Sélectionnez toutes les photos du dossier (Ctrl + A dans la fenêtre)</label>
        <input id="photos" type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={(e) => pick(e.currentTarget.files)} className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:font-semibold file:text-primary-foreground" />
        <p className="text-xs text-muted-foreground">Chaque fichier est associé à la joueuse par son numéro de dossard (« 16. AMINATA SANOGO… »), sinon par son nom. Vérifiez et corrigez dans la liste avant d’importer. Les photos sont réduites avant l’envoi.</p>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={replace} onChange={(e) => setReplace(e.currentTarget.checked)} /> Remplacer les photos déjà présentes</label>
      </Card>

      {rows.length ? (
        <Card className="divide-y">
          {rows.map((r, i) => {
            const p = byId.get(r.playerId);
            const skipped = !!p?.hasPhoto && !replace && r.status === "idle";
            return (
              <div key={r.file.name + i} className="flex flex-wrap items-center gap-3 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.preview} alt="" className="size-14 rounded-md object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-muted-foreground">{r.file.name}</p>
                  <select value={r.playerId} disabled={running || r.status === "ok"} onChange={(e) => setRow(i, { playerId: e.currentTarget.value, status: "idle", message: undefined })} className="mt-1 w-full max-w-sm rounded-md border bg-background px-2 py-1 text-sm" aria-label={`Joueuse pour ${r.file.name}`}>
                    <option value="">— Ne pas importer —</option>
                    {players.map((x) => <option key={x.id} value={x.id}>{x.shirt != null ? `${x.shirt}. ` : ""}{x.name}{x.hasPhoto ? " (a déjà une photo)" : ""}</option>)}
                  </select>
                </div>
                <div className="w-48 text-right text-sm">
                  {r.status === "busy" ? <span className="inline-flex items-center gap-1"><Loader2 className="size-4 animate-spin" />Envoi…</span>
                    : r.status === "ok" ? <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 className="size-4" />Importée</span>
                    : r.status === "error" ? <span className="inline-flex items-center gap-1 text-danger"><XCircle className="size-4" />{r.message}</span>
                    : !r.playerId ? <span className="text-muted-foreground">Non associée</span>
                    : dupes.has(r.playerId) ? <span className="text-warning">En double</span>
                    : skipped ? <span className="text-muted-foreground">Déjà une photo</span>
                    : <span className="text-muted-foreground">Prête</span>}
                </div>
              </div>
            );
          })}
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-3">
        {done ? <p className="text-sm font-semibold" role="status">{done} photo(s) importée(s).</p> : null}
        <Button asChild variant="ghost"><Link href="/effectif">Retour à l’effectif</Link></Button>
        <Button onClick={run} disabled={running || todo.length === 0}>{running ? <Loader2 className="animate-spin" /> : <ImageUp />}2. Importer {todo.length} photo(s)</Button>
      </div>
    </div>
  );
}
