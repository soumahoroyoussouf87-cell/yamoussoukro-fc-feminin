"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Copy, LayoutTemplate, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Field, Input } from "@/components/ui/form";
import { WorkflowBar } from "@/components/phase2/workflow-bar";
import { ApprovalHistory } from "@/components/phase2/approval-history";
import { setWorkflowStatus } from "@/lib/phase2/workflow-actions";
import { deleteSessionById, duplicateSessionTo, saveAsTemplate } from "@/lib/training/actions";
import { STEPS, type Check } from "@/lib/training/completeness";
import { formatDateTime } from "@/lib/utils";
import { ExportPanel } from "./export/export-panel";
import type { StepProps } from "./types";

export function StepValidate({ data, perms, history, checks, refresh }: StepProps & { checks: Check[] }) {
  const s = data.session;
  const router = useRouter();
  const [dupDate, setDupDate] = useState("");
  const [tpl, setTpl] = useState({ name: s.theme ?? "", description: "" });
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const blocking = checks.filter((c) => c.required && !c.ok && c.step <= 4);

  const onStatus = async (to: string) => {
    if (["soumis", "valide", "publie"].includes(to) && blocking.length)
      return { error: `Complète d'abord la fiche : ${blocking.map((c) => c.label.toLowerCase()).join(", ")}.` };
    const r = await setWorkflowStatus("training_sessions", s.id, `/entrainement/seances/${s.id}`, to);
    refresh();
    return r;
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Contrôle de la fiche</CardTitle><CardDescription>Les points obligatoires des étapes 1 à 4 conditionnent la soumission et la validation.</CardDescription></CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1.5 text-sm">
              {checks.map((c, k) => (
                <li key={k} className="flex items-start gap-2">
                  {c.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-label="fait" /> : <Circle className={`mt-0.5 size-4 shrink-0 ${c.required ? "text-danger" : "text-muted-foreground"}`} aria-label="à faire" />}
                  <span className="flex-1">{c.label}{c.required && !c.ok ? <strong className="ml-1 text-xs text-danger">obligatoire</strong> : null}</span>
                  {!c.ok ? <Link href={`?etape=${c.step}`} scroll={false} className="text-xs font-semibold text-primary-text hover:underline">Étape {c.step} · {STEPS[c.step - 1].short}</Link> : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Validation</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2">
            <WorkflowBar status={s.status} canWrite={perms.write} canValidate={perms.validate} onChange={onStatus}
              validateHint="La séance est validée puis publiée par l'entraîneur principal ou la direction sportive. Une fois validée, son contenu est verrouillé ; la publication notifie le staff." />
            {s.validated_at ? <p className="text-xs text-muted-foreground">Validée le {formatDateTime(s.validated_at)}{s.validated_by_name ? ` par ${s.validated_by_name}` : ""}{s.published_at ? ` · publiée le ${formatDateTime(s.published_at)}` : ""}.</p> : null}
            <ApprovalHistory items={history} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Imprimer, exporter et partager</CardTitle><CardDescription>En-tête officiel, saison, numéro de séance, pagination et état de validation sur chaque page.</CardDescription></CardHeader>
          <CardContent>
            {perms.export ? <ExportPanel data={data} /> : <p className="text-sm text-muted-foreground">Ton rôle ne permet pas d&apos;exporter les fiches de séance.</p>}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-4">
        {perms.write ? (
          <>
            <Card>
              <CardHeader><CardTitle className="text-base">Dupliquer</CardTitle><CardDescription>Copie les phases, exercices, schémas et le matériel vers une nouvelle séance en brouillon.</CardDescription></CardHeader>
              <CardContent className="flex flex-col gap-2">
                <Field label="Date de la nouvelle séance" htmlFor="dup-date"><Input id="dup-date" type="date" value={dupDate} onChange={(e) => setDupDate(e.target.value)} /></Field>
                <Button type="button" variant="outline" disabled={!dupDate || pending}
                  onClick={() => start(async () => {
                    setMsg(null);
                    const r = await duplicateSessionTo(s.id, dupDate);
                    if (r.ok) router.push(`/entrainement/seances/${r.id}?etape=1&copie=1`);
                    else setMsg({ tone: "err", text: r.error });
                  })}><Copy />Dupliquer la séance</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Enregistrer comme modèle</CardTitle><CardDescription>Réutilisable à la création d&apos;une séance. <Link href="/entrainement/modeles" className="font-semibold text-primary-text underline">Voir les modèles</Link></CardDescription></CardHeader>
              <CardContent className="flex flex-col gap-2">
                <Field label="Nom du modèle" htmlFor="tpl-name"><Input id="tpl-name" value={tpl.name} maxLength={120} onChange={(e) => setTpl((o) => ({ ...o, name: e.target.value }))} /></Field>
                <Field label="Description" htmlFor="tpl-desc"><Input id="tpl-desc" value={tpl.description} maxLength={500} onChange={(e) => setTpl((o) => ({ ...o, description: e.target.value }))} /></Field>
                <Button type="button" variant="outline" disabled={tpl.name.trim().length < 2 || pending}
                  onClick={() => start(async () => {
                    setMsg(null);
                    const r = await saveAsTemplate(s.id, tpl.name, tpl.description);
                    setMsg(r.ok ? { tone: "ok", text: `Modèle « ${tpl.name.trim()} » enregistré.` } : { tone: "err", text: r.error });
                  })}><LayoutTemplate />Enregistrer le modèle</Button>
              </CardContent>
            </Card>
            {msg ? <p role="status" className={msg.tone === "ok" ? "text-sm text-success" : "text-sm text-danger"}>{msg.text}</p> : null}
            {(s.status === "brouillon" || s.status === "soumis" || perms.validate) ? (
              <Card>
                <CardHeader><CardTitle className="text-base">Supprimer</CardTitle><CardDescription>Supprime définitivement la séance, ses phases, présences et évaluation.</CardDescription></CardHeader>
                <CardContent>
                  <ConfirmButton label={<><Trash2 />Supprimer la séance</>} confirmLabel="Supprimer définitivement"
                    onConfirm={async () => { const r = await deleteSessionById(s.id); if (r.ok) router.push("/entrainement/seances"); else setMsg({ tone: "err", text: r.error }); }} />
                </CardContent>
              </Card>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
