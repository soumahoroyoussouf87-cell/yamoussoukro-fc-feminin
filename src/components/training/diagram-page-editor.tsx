"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Archive, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { archiveDiagram, duplicateDiagram, saveDiagram } from "@/lib/training/actions";
import type { Diagram } from "@/lib/training/diagram";
import { TacticalBoard } from "./tactical-board";

/** Éditeur d'un schéma de la bibliothèque (création ou modification). */
export function DiagramPageEditor({ id, title, data, canWrite }: { id: string | null; title: string; data: Diagram | null; canWrite: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      {id && canWrite ? (
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => start(async () => { const r = await duplicateDiagram(id); if (r.ok) router.push(`/entrainement/schemas/${r.id}`); })}><Copy />Dupliquer</Button>
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => start(async () => { const r = await archiveDiagram(id); if (r.ok) router.push("/entrainement/schemas"); })}><Archive />Archiver</Button>
        </div>
      ) : null}
      <TacticalBoard initial={data} title={title} readOnly={!canWrite}
        onSave={canWrite ? async (t, d) => { const r = await saveDiagram(id, t, d); if (r.ok && !id) router.replace(`/entrainement/schemas/${r.id}`); else if (r.ok) router.refresh(); return r; } : undefined} />
    </div>
  );
}
