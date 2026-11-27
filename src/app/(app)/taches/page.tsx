import Link from "next/link";
import { ListTodo } from "lucide-react";
import { requireStaff, can } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getScope, listMatches, listStaffOptions } from "@/lib/phase2/data";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { NewTaskForm, TaskRow, type TaskItem } from "@/components/tasks/tasks";
import { cn } from "@/lib/utils";

const isoDaysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

export const metadata = { title: "Tâches du staff" };

const VIEWS = [
  { key: "moi", label: "Mes tâches" },
  { key: "toutes", label: "Toutes en cours" },
  { key: "terminees", label: "Terminées" },
] as const;

export default async function TasksPage({ searchParams }: PageProps<"/taches">) {
  const ctx = await requireStaff();
  const sp = await searchParams;
  const view = VIEWS.find((v) => v.key === sp.vue)?.key ?? "moi";
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const scope = await getScope(ctx);
  const [{ data: me }, staff, matches, { data: sessions }] = await Promise.all([
    supabase.from("staff_members").select("id").eq("club_id", ctx.clubId).eq("profile_id", ctx.userId).maybeSingle(),
    listStaffOptions(ctx),
    can(ctx, "matches.read") ? listMatches(ctx, { seasonId: scope.seasonId, from: isoDaysAgo(30) }) : Promise.resolve([]),
    can(ctx, "planning.read")
      ? supabase.from("training_sessions").select("id, number, session_date, theme").eq("club_id", ctx.clubId).gte("session_date", isoDaysAgo(14)).order("session_date").limit(40)
      : Promise.resolve({ data: [] as { id: string; number: number; session_date: string; theme: string | null }[] }),
  ]);
  let q = supabase.from("staff_tasks")
    .select("id, title, description, status, priority, due_on, assignee_staff_id, created_by, match_id, training_session_id, staff_members(first_name, last_name), matches(id, opponents(name)), training_sessions(id, number)")
    .eq("club_id", ctx.clubId);
  if (view === "terminees") q = q.in("status", ["terminee", "annulee"]).order("updated_at", { ascending: false }).limit(100);
  else {
    q = q.in("status", ["a_faire", "en_cours"]).order("due_on", { ascending: true, nullsFirst: false }).order("created_at");
    if (view === "moi") q = me ? q.eq("assignee_staff_id", me.id) : q.eq("created_by", ctx.userId);
  }
  const { data } = await q;
  const manage = can(ctx, "staff.write") || can(ctx, "planning.write");
  const items: TaskItem[] = (data ?? []).map((t) => {
    const a = t.staff_members as unknown as { first_name: string; last_name: string } | null;
    const m = t.matches as unknown as { id: string; opponents: { name: string } | null } | null;
    const s = t.training_sessions as unknown as { id: string; number: number } | null;
    const mine = t.created_by === ctx.userId || (!!me && t.assignee_staff_id === me.id);
    return {
      id: t.id, title: t.title, description: t.description, status: t.status, priority: t.priority, due_on: t.due_on,
      assignee: a ? `${a.first_name} ${a.last_name}` : null, assigneeId: t.assignee_staff_id,
      link: m ? { href: `/competition/rencontres/${m.id}`, label: `Match ${m.opponents?.name ?? ""}`.trim() } : s ? { href: `/entrainement/seances/${s.id}`, label: `Séance n°${s.number}` } : null,
      canEdit: mine || manage, canDelete: t.created_by === ctx.userId || manage,
      overdue: !!t.due_on && t.due_on < today && (t.status === "a_faire" || t.status === "en_cours"),
    };
  });
  const staffOpts = staff.map((s) => ({ value: s.value, label: s.name }));

  return (
    <div>
      <PageHeader eyebrow="Pilotage" title="Tâches du staff"
        description="Ce que chacun doit faire et pour quand. La personne désignée est notifiée ; elle, l'auteur et l'encadrement peuvent mettre la tâche à jour." />
      <div className="mb-4"><NewTaskForm staff={staffOpts} defaultAssignee={me?.id ?? null}
        matches={matches.map((m) => ({ value: m.id, label: `${m.kickoff_at.slice(0, 10).split("-").reverse().join("/")} · ${m.opponent}` }))}
        sessions={(sessions ?? []).map((s) => ({ value: s.id, label: `${s.session_date.split("-").reverse().join("/")} · Séance n°${s.number}${s.theme ? ` · ${s.theme}` : ""}` }))} /></div>
      <nav aria-label="Vues" className="mb-4 flex gap-1 overflow-x-auto border-b">
        {VIEWS.map((v) => (
          <Link key={v.key} href={`/taches?vue=${v.key}`} aria-current={view === v.key ? "page" : undefined}
            className={cn("whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium", view === v.key ? "border-fuchsia text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>{v.label}</Link>
        ))}
      </nav>
      {!me && view === "moi" ? <p className="mb-3 text-xs text-muted-foreground">Votre compte n&apos;est relié à aucune fiche du staff : « Mes tâches » affiche celles que vous avez créées.</p> : null}
      {items.length === 0 ? (
        <EmptyState icon={ListTodo} title={view === "terminees" ? "Aucune tâche terminée" : "Aucune tâche en cours"} description="Créez une tâche et confiez-la à un membre du staff." />
      ) : (
        <ul className="divide-y rounded-xl border bg-card">{items.map((t) => <TaskRow key={t.id} t={t} staff={staffOpts} />)}</ul>
      )}
    </div>
  );
}
