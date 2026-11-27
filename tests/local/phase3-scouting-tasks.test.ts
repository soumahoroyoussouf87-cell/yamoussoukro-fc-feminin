/**
 * Phase 3 · livraison 4 — Analyse des adversaires et tâches du staff (migration 013) sur les VRAIES migrations (PGlite).
 * Confidentialité des fiches adversaires, cohérence adversaire/match, attribution et notification des tâches,
 * droits de modification (personne désignée, auteur, encadrement).
 */
import { beforeAll, describe, expect, it } from "vitest";
import { as, CLUB, createLocalDb, makeUser, TEAM, tryAs, type Db } from "./pg-harness";

let db: Db;
const u: Record<string, string> = {};
const staff: Record<string, string> = {};
let opp = "";
let other = "";
let match = "";
let task = "";

const one = async <T,>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];

beforeAll(async () => {
  db = await createLocalDb();
  for (const [k, role] of [["coach", "head_coach"], ["assistant", "assistant_coach"], ["kit", "kit_manager"], ["comm", "communication"], ["player", "player"]] as const) {
    u[k] = await makeUser(db, k, role);
  }
  const role = (await one<{ id: string }>(`select id from public.roles where code = 'kit_manager'`)).id;
  for (const k of ["assistant", "kit"]) {
    staff[k] = (await one<{ id: string }>(`insert into public.staff_members (club_id, role_id, first_name, last_name, profile_id) values ($1, $2, $3, 'TEST', $4) returning id`, [CLUB, role, k, u[k]])).id;
  }
  opp = (await one<{ id: string }>(`insert into public.opponents (club_id, name) values ($1, 'Adversaire A') returning id`, [CLUB])).id;
  other = (await one<{ id: string }>(`insert into public.opponents (club_id, name) values ($1, 'Adversaire B') returning id`, [CLUB])).id;
  const team = TEAM;
  const season = (await one<{ id: string }>(`insert into public.seasons (club_id, label, starts_on, ends_on, is_active) values ($1, 'TEST 2026-2027', '2026-08-01', '2027-06-30', true) returning id`, [CLUB])).id;
  match = (await one<{ id: string }>(`insert into public.matches (club_id, team_id, season_id, opponent_id, kickoff_at) values ($1, $2, $3, $4, '2026-11-29 15:00Z') returning id`, [CLUB, team, season, opp])).id;
}, 60_000);

describe("Analyse des adversaires (confidentiel)", () => {
  it("le staff technique crée une fiche ; la cohérence adversaire / match est contrôlée", async () => {
    const r = await as<{ id: string }>(db, u.assistant, `insert into public.opponent_scouting (club_id, opponent_id, match_id, observed_on, usual_system, strengths)
      values ($1, $2, $3, '2026-11-20', '4-4-2', 'Jeu long vers la n°9') returning id`, [CLUB, opp, match]);
    expect(r).toHaveLength(1);
    expect(await tryAs(db, u.assistant, `insert into public.opponent_scouting (club_id, opponent_id, match_id, observed_on) values ($1, $2, $3, '2026-11-20')`, [CLUB, other, match])).toMatch(/n'oppose pas/);
  });

  it("invisible et non modifiable pour l'intendance, la communication et les joueuses", async () => {
    for (const k of ["kit", "comm", "player"]) expect(await as(db, u[k], `select id from public.opponent_scouting`)).toHaveLength(0);
    expect(await tryAs(db, u.kit, `insert into public.opponent_scouting (club_id, opponent_id, observed_on) values ($1, $2, '2026-11-20')`, [CLUB, opp])).toMatch(/row-level security/);
    expect(await as(db, u.coach, `select id from public.opponent_scouting`)).toHaveLength(1);
  });
});

describe("Tâches du staff", () => {
  it("tout membre du staff crée une tâche ; la personne désignée est notifiée", async () => {
    task = (await as<{ id: string }>(db, u.coach, `insert into public.staff_tasks (club_id, title, assignee_staff_id, due_on, priority) values ($1, 'Préparer les chasubles', $2, '2026-11-28', 'haute') returning id`, [CLUB, staff.kit]))[0].id;
    const n = await one<{ c: number }>(`select count(*)::int c from public.notifications where user_id = $1 and kind = 'tache'`, [u.kit]);
    expect(n.c).toBe(1);
    expect(await as(db, u.kit, `select id from public.staff_tasks`)).toHaveLength(1);
    expect(await as(db, u.player, `select id from public.staff_tasks`)).toHaveLength(0);
    expect(await tryAs(db, u.player, `insert into public.staff_tasks (club_id, title) values ($1, 'Joueuse')`, [CLUB])).toMatch(/row-level security/);
  });

  it("la personne désignée termine sa tâche (date de fin posée) ; un autre membre ne peut pas la modifier", async () => {
    expect(await as(db, u.comm, `update public.staff_tasks set status = 'terminee' where id = $1 returning id`, [task])).toHaveLength(0);
    await as(db, u.kit, `update public.staff_tasks set status = 'terminee' where id = $1`, [task]);
    const t = await one<{ status: string; completed_at: string | null }>(`select status, completed_at from public.staff_tasks where id = $1`, [task]);
    expect(t.status).toBe("terminee");
    expect(t.completed_at).not.toBeNull();
    await as(db, u.kit, `update public.staff_tasks set status = 'en_cours' where id = $1`, [task]);
    expect((await one<{ completed_at: string | null }>(`select completed_at from public.staff_tasks where id = $1`, [task])).completed_at).toBeNull();
  });

  it("réattribution notifiée ; suppression réservée à l'auteur ou à l'encadrement", async () => {
    await as(db, u.coach, `update public.staff_tasks set assignee_staff_id = $2 where id = $1`, [task, staff.assistant]);
    expect((await one<{ c: number }>(`select count(*)::int c from public.notifications where user_id = $1 and kind = 'tache'`, [u.assistant])).c).toBe(1);
    expect(await as(db, u.kit, `delete from public.staff_tasks where id = $1 returning id`, [task])).toHaveLength(0);
    expect(await as(db, u.coach, `delete from public.staff_tasks where id = $1 returning id`, [task])).toHaveLength(1);
  });
});
