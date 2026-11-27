"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { createTask, deleteTask, updateTask, type TaskFormState } from "@/lib/staff/task-actions";
import { cn } from "@/lib/utils";

type Opt = { value: string; label: string };
export const TASK_STATUS_LABELS: Record<string, string> = { a_faire: "À faire", en_cours: "En cours", terminee: "Terminée", annulee: "Annulée" };
export const TASK_PRIORITY_LABELS: Record<string, string> = { basse: "Basse", normale: "Normale", haute: "Haute" };

export function NewTaskForm({ staff, matches, sessions, defaultAssignee }: { staff: Opt[]; matches: Opt[]; sessions: Opt[]; defaultAssignee: string | null }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<TaskFormState, FormData>(async (prev, fd) => {
    const r = await createTask(prev, fd);
    if (r?.ok) setOpen(false);
    return r;
  }, undefined);
  if (!open) return <Button onClick={() => setOpen(true)}><Plus />Nouvelle tâche</Button>;
  return (
    <form action={action} className="w-full space-y-3 rounded-xl border bg-card p-4" aria-label="Nouvelle tâche">
      <Field label="Tâche" htmlFor="t-title"><Input id="t-title" name="title" required maxLength={160} placeholder="Ex. Monter la vidéo du dernier match" autoFocus /></Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Confiée à" htmlFor="t-assignee">
          <Select id="t-assignee" name="assignee_staff_id" defaultValue={defaultAssignee ?? ""}>
            <option value="">— Non attribuée —</option>
            {staff.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
        </Field>
        <Field label="Échéance" htmlFor="t-due"><Input id="t-due" name="due_on" type="date" /></Field>
        <Field label="Priorité" htmlFor="t-prio">
          <Select id="t-prio" name="priority" defaultValue="normale">
            {Object.entries(TASK_PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Match lié (facultatif)" htmlFor="t-match">
          <Select id="t-match" name="match_id" defaultValue=""><option value="">—</option>{matches.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</Select>
        </Field>
        <Field label="Séance liée (facultatif)" htmlFor="t-session">
          <Select id="t-session" name="training_session_id" defaultValue=""><option value="">—</option>{sessions.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</Select>
        </Field>
      </div>
      <Field label="Détails (facultatif)" htmlFor="t-desc"><Textarea id="t-desc" name="description" rows={2} maxLength={2000} /></Field>
      {state?.error ? <p role="alert" className="text-sm font-medium text-danger">{state.error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>{pending ? "Création…" : "Créer la tâche"}</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
      </div>
      <p className="text-xs text-muted-foreground">La personne désignée reçoit une notification.</p>
    </form>
  );
}

export type TaskItem = {
  id: string; title: string; description: string | null; status: string; priority: string; due_on: string | null;
  assignee: string | null; assigneeId: string | null; link: { href: string; label: string } | null; canEdit: boolean; canDelete: boolean; overdue: boolean;
};

export function TaskRow({ t, staff }: { t: TaskItem; staff: Opt[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  const [status, setStatus] = useState(t.status);
  const run = (fn: () => Promise<{ error?: string }>, undo?: () => void) => start(async () => {
    const r = await fn();
    setErr(r.error ?? null);
    if (r.error) undo?.(); else router.refresh();
  });
  const setTo = (next: string) => { const prev = status; setStatus(next); run(() => updateTask(t.id, { status: next }), () => setStatus(prev)); };
  const done = status === "terminee" || status === "annulee";
  return (
    <li className={cn("flex flex-wrap items-start gap-3 p-3", done && "opacity-70")}>
      <input type="checkbox" className="mt-1 size-5 accent-[var(--yfc-fuchsia)]" checked={status === "terminee"} disabled={!t.canEdit}
        aria-label={`Marquer « ${t.title} » comme ${status === "terminee" ? "à faire" : "terminée"}`}
        onChange={(e) => setTo(e.target.checked ? "terminee" : "a_faire")} />
      <div className="min-w-0 flex-1">
        <p className={cn("font-medium", status === "terminee" && "line-through")}>{t.title}</p>
        {t.description ? <p className="whitespace-pre-line text-sm text-muted-foreground">{t.description}</p> : null}
        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {t.priority === "haute" ? <Badge variant="warning">Priorité haute</Badge> : t.priority === "basse" ? <Badge variant="outline">Priorité basse</Badge> : null}
          {t.due_on ? <span className={cn(t.overdue && "font-semibold text-danger")}>{t.overdue ? "En retard · " : "Échéance "}{t.due_on.split("-").reverse().join("/")}</span> : null}
          {t.link ? <a className="underline" href={t.link.href}>{t.link.label}</a> : null}
        </p>
        {err ? <p role="alert" className="text-xs text-danger">{err}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {t.canEdit ? (
          <>
            <Select aria-label="Confiée à" className="h-8 w-44 text-xs" value={t.assigneeId ?? ""} disabled={pending}
              onChange={(e) => run(() => updateTask(t.id, { assignee_staff_id: e.target.value || null }))}>
              <option value="">— Non attribuée —</option>
              {staff.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
            <Select aria-label="Statut" className="h-8 w-32 text-xs" value={status} disabled={pending}
              onChange={(e) => setTo(e.target.value)}>
              {Object.entries(TASK_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">{t.assignee ?? "Non attribuée"} · {TASK_STATUS_LABELS[status]}</span>
        )}
        {t.canDelete ? (armed ? (
          <span className="inline-flex gap-1">
            <Button size="sm" variant="destructive" disabled={pending} onClick={() => run(() => deleteTask(t.id))}>Supprimer</Button>
            <Button size="sm" variant="ghost" onClick={() => setArmed(false)}>Annuler</Button>
          </span>
        ) : <Button size="sm" variant="ghost" aria-label={`Supprimer « ${t.title} »`} onClick={() => setArmed(true)}><Trash2 /></Button>) : null}
      </div>
    </li>
  );
}
