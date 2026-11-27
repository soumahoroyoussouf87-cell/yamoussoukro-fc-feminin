"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { archiveTheme, createTheme, updateTheme } from "@/lib/training/actions";
import type { ThemeRow } from "./types";

export function ThemesManager({ themes, usage, canWrite }: { themes: ThemeRow[]; usage: Record<string, number>; canWrite: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [sub, setSub] = useState<Record<string, string>>({});
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => { setError(null); const r = await fn(); if (!r.ok) setError(r.error ?? "Action refusée."); router.refresh(); });
  const mains = themes.filter((t) => !t.parent_id);
  return (
    <div className="flex flex-col gap-4">
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      {canWrite ? (
        <Card className="p-4">
          <div className="flex gap-2">
            <Input aria-label="Nouveau thème principal" value={name} maxLength={120} placeholder="Nouveau thème principal (ex. Conservation du ballon)" onChange={(e) => setName(e.target.value)} />
            <Button type="button" disabled={pending || name.trim().length < 2} onClick={() => { run(() => createTheme(name, null)); setName(""); }}><Plus />Créer</Button>
          </div>
        </Card>
      ) : null}
      {mains.length === 0 ? <Card className="p-6 text-center text-sm text-muted-foreground">Aucun thème. Les thèmes créés ici sont proposés dans les fiches de séance.</Card> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {mains.map((m) => (
          <Card key={m.id} className={m.archived ? "opacity-60" : undefined}>
            <CardHeader className="flex-row items-center gap-2">
              {canWrite ? (
                <Input aria-label="Nom du thème" defaultValue={m.name} maxLength={120} className="h-9 font-semibold"
                  onBlur={(e) => { if (e.target.value.trim() !== m.name && e.target.value.trim().length >= 2) run(() => updateTheme(m.id, e.target.value, null)); }} />
              ) : <CardTitle className="flex-1 text-base">{m.name}</CardTitle>}
              <span className="whitespace-nowrap text-xs text-muted-foreground">{usage[m.id] ?? 0} séance(s)</span>
              {canWrite ? <Button type="button" size="sm" variant="ghost" aria-label={m.archived ? "Réactiver" : "Archiver"} title={m.archived ? "Réactiver" : "Archiver"} onClick={() => run(() => archiveTheme(m.id, !m.archived))}>{m.archived ? <ArchiveRestore /> : <Archive />}</Button> : null}
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5">
              {themes.filter((t) => t.parent_id === m.id).map((t) => (
                <div key={t.id} className={`flex items-center gap-2 text-sm ${t.archived ? "opacity-60" : ""}`}>
                  <span className="text-muted-foreground">↳</span>
                  {canWrite ? <Input aria-label="Nom du sous-thème" defaultValue={t.name} maxLength={120} className="h-8"
                    onBlur={(e) => { if (e.target.value.trim() !== t.name && e.target.value.trim().length >= 2) run(() => updateTheme(t.id, e.target.value, null)); }} /> : <span className="flex-1">{t.name}</span>}
                  <span className="whitespace-nowrap text-xs text-muted-foreground">{usage[t.id] ?? 0}</span>
                  {canWrite ? <Button type="button" size="sm" variant="ghost" aria-label={t.archived ? "Réactiver" : "Archiver"} onClick={() => run(() => archiveTheme(t.id, !t.archived))}>{t.archived ? <ArchiveRestore /> : <Archive />}</Button> : null}
                </div>
              ))}
              {canWrite && !m.archived ? (
                <div className="flex gap-2 pt-1">
                  <Input aria-label={`Nouveau sous-thème de ${m.name}`} className="h-8" value={sub[m.id] ?? ""} maxLength={120} placeholder="Ajouter un sous-thème" onChange={(e) => setSub((o) => ({ ...o, [m.id]: e.target.value }))} />
                  <Button type="button" size="sm" variant="outline" disabled={pending || (sub[m.id] ?? "").trim().length < 2} onClick={() => { run(() => createTheme(sub[m.id], m.id)); setSub((o) => ({ ...o, [m.id]: "" })); }}><Plus /></Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
