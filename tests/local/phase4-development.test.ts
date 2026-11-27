/**
 * Phase 4 · livraison 1 — Plans de développement (migration 015) sur les VRAIES migrations (PGlite).
 * Portée contrôlée, cohérence club, réévaluation (statut des objectifs, prochaine échéance, clôture),
 * notification du responsable, confidentialité.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { as, CLUB, createLocalDb, makeUser, tryAs, type Db } from "./pg-harness";

let db: Db;
const u: Record<string, string> = {};
let player = "";
let foreign = "";
let staffKit = "";
let plan = "";
let obj = "";

const one = async <T,>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];

beforeAll(async () => {
  db = await createLocalDb();
  for (const [k, role] of [["coach", "head_coach"], ["assistant", "assistant_coach"], ["analyst", "video_analyst"], ["comm", "communication"], ["player", "player"]] as const) {
    u[k] = await makeUser(db, k, role);
  }
  player = (await one<{ id: string }>(`insert into public.players (club_id, first_name, last_name) values ($1, 'Awa', 'PDI') returning id`, [CLUB])).id;
  const club2 = (await one<{ id: string }>(`insert into public.clubs (name) values ('Autre club') returning id`)).id;
  foreign = (await one<{ id: string }>(`insert into public.players (club_id, first_name, last_name) values ($1, 'Hors', 'CLUB') returning id`, [club2])).id;
  const role = (await one<{ id: string }>(`select id from public.roles where code = 'assistant_coach'`)).id;
  staffKit = (await one<{ id: string }>(`insert into public.staff_members (club_id, role_id, first_name, last_name, profile_id) values ($1, $2, 'Adjointe', 'TEST', $3) returning id`, [CLUB, role, u.assistant])).id;
}, 60_000);

describe("Plans de développement", () => {
  it("création d'un plan individuel ; le responsable désigné est notifié", async () => {
    plan = (await as<{ id: string }>(db, u.coach, `insert into public.development_plans (club_id, scope, player_id, title, starts_on, ends_on, owner_staff_id, findings)
      values ($1, 'individuel', $2, 'Jeu long pied gauche', '2026-11-27', '2027-01-31', $3, 'Passes longues : 2/5 réussies sur les 3 derniers matchs') returning id`, [CLUB, player, staffKit]))[0].id;
    const n = await one<{ c: number }>(`select count(*)::int c from public.notifications where user_id = $1 and kind = 'developpement'`, [u.assistant]);
    expect(n.c).toBe(1);
  });

  it("portée contrôlée et cohérence club", async () => {
    expect(await tryAs(db, u.coach, `insert into public.development_plans (club_id, scope, title, starts_on, ends_on) values ($1, 'individuel', 'Sans joueuse', '2026-11-27', '2027-01-31')`, [CLUB])).toMatch(/check|contrainte/);
    expect(await tryAs(db, u.coach, `insert into public.development_plans (club_id, scope, sector_code, title, starts_on, ends_on) values ($1, 'collectif', 'defense', 'Mauvais', '2026-11-27', '2027-01-31')`, [CLUB])).toMatch(/check|contrainte/);
    expect(await tryAs(db, u.coach, `insert into public.development_plans (club_id, scope, player_id, title, starts_on, ends_on) values ($1, 'individuel', $2, 'Autre club', '2026-11-27', '2027-01-31')`, [CLUB, foreign])).toMatch(/autre club/);
    expect(await tryAs(db, u.coach, `insert into public.development_plans (club_id, scope, title, starts_on, ends_on) values ($1, 'collectif', 'Dates', '2027-01-31', '2026-11-27')`, [CLUB])).toMatch(/check|contrainte/);
    expect(await tryAs(db, u.coach, `update public.development_plans set scope = 'collectif', player_id = null where id = $1`, [plan])).toMatch(/portée/);
  });

  it("objectif, exercice correctif et réévaluation : le statut suit la dernière réévaluation", async () => {
    obj = (await as<{ id: string }>(db, u.assistant, `insert into public.development_objectives (club_id, plan_id, label, dimension, criterion_code, baseline, target, unit)
      values ($1, $2, 'Réussir 4 passes longues sur 5', 'technique', 'passe_longue', 2, 4, '/5') returning id`, [CLUB, plan]))[0].id;
    await as(db, u.assistant, `insert into public.development_actions (club_id, objective_id, label, frequency) values ($1, $2, 'Jeu long en duo 30 m', '2 fois par semaine')`, [CLUB, obj]);
    const r1 = (await as<{ id: string }>(db, u.coach, `insert into public.development_reviews (club_id, plan_id, reviewed_on, facts, decision, next_review_on) values ($1, $2, '2026-12-15', '3/5 en moyenne', 'poursuivre', '2027-01-15') returning id`, [CLUB, plan]))[0].id;
    await as(db, u.coach, `insert into public.development_review_items (club_id, review_id, objective_id, value, status) values ($1, $2, $3, 3, 'partiel')`, [CLUB, r1, obj]);
    expect((await one<{ status: string }>(`select status from public.development_objectives where id = $1`, [obj])).status).toBe("partiel");
    expect((await one<{ d: string }>(`select next_review_on::text d from public.development_plans where id = $1`, [plan])).d).toBe("2027-01-15");
    // Une réévaluation plus ancienne saisie après coup ne remplace pas la plus récente.
    const r0 = (await as<{ id: string }>(db, u.coach, `insert into public.development_reviews (club_id, plan_id, reviewed_on, decision, next_review_on) values ($1, $2, '2026-12-01', 'ajuster', '2026-12-10') returning id`, [CLUB, plan]))[0].id;
    await as(db, u.coach, `insert into public.development_review_items (club_id, review_id, objective_id, value, status) values ($1, $2, $3, 2, 'non_atteint')`, [CLUB, r0, obj]);
    expect((await one<{ status: string }>(`select status from public.development_objectives where id = $1`, [obj])).status).toBe("partiel");
    expect((await one<{ d: string }>(`select next_review_on::text d from public.development_plans where id = $1`, [plan])).d).toBe("2027-01-15");
  });

  it("clôture par réévaluation : plan terminé, date de clôture posée", async () => {
    const r2 = (await as<{ id: string }>(db, u.coach, `insert into public.development_reviews (club_id, plan_id, reviewed_on, decision) values ($1, $2, '2027-01-20', 'cloturer') returning id`, [CLUB, plan]))[0].id;
    await as(db, u.coach, `insert into public.development_review_items (club_id, review_id, objective_id, value, status) values ($1, $2, $3, 4, 'atteint')`, [CLUB, r2, obj]);
    const p = await one<{ status: string; closed_at: string | null }>(`select status, closed_at from public.development_plans where id = $1`, [plan]);
    expect(p.status).toBe("termine");
    expect(p.closed_at).not.toBeNull();
    expect((await one<{ status: string }>(`select status from public.development_objectives where id = $1`, [obj])).status).toBe("atteint");
  });

  it("réévaluation : objectif d'un autre plan refusé", async () => {
    const other = (await as<{ id: string }>(db, u.coach, `insert into public.development_plans (club_id, scope, title, starts_on, ends_on) values ($1, 'collectif', 'Pressing collectif', '2026-11-27', '2027-03-31') returning id`, [CLUB]))[0].id;
    const r = (await as<{ id: string }>(db, u.coach, `insert into public.development_reviews (club_id, plan_id, reviewed_on, decision) values ($1, $2, '2026-12-20', 'poursuivre') returning id`, [CLUB, other]))[0].id;
    expect(await tryAs(db, u.coach, `insert into public.development_review_items (club_id, review_id, objective_id, status) values ($1, $2, $3, 'atteint')`, [CLUB, r, obj])).toMatch(/hors du plan/);
  });

  it("réévaluation groupée (RPC) : tout ou rien — un objectif étranger annule la clôture", async () => {
    const p2 = (await as<{ id: string }>(db, u.coach, `insert into public.development_plans (club_id, scope, sector_code, title, starts_on, ends_on) values ($1, 'sectoriel', 'defense', 'Alignement défensif', '2026-11-27', '2027-02-28') returning id`, [CLUB]))[0].id;
    const err = await tryAs(db, u.coach, `select public.add_development_review($1, '{"reviewed_on":"2026-12-20","decision":"cloturer"}'::jsonb, jsonb_build_array(jsonb_build_object('objective_id', $2::text, 'status', 'atteint')))`, [p2, obj]);
    expect(err).toMatch(/hors du plan/);
    expect((await one<{ status: string }>(`select status from public.development_plans where id = $1`, [p2])).status).toBe("actif");
    expect((await one<{ c: number }>(`select count(*)::int c from public.development_reviews where plan_id = $1`, [p2])).c).toBe(0);
    const o2 = (await as<{ id: string }>(db, u.coach, `insert into public.development_objectives (club_id, plan_id, label) values ($1, $2, 'Ligne à 4 alignée') returning id`, [CLUB, p2]))[0].id;
    await as(db, u.coach, `select public.add_development_review($1, '{"reviewed_on":"2026-12-20","decision":"poursuivre","next_review_on":"2027-01-10"}'::jsonb, jsonb_build_array(jsonb_build_object('objective_id', $2::text, 'value', 3, 'status', 'partiel')))`, [p2, o2]);
    expect((await one<{ status: string }>(`select status from public.development_objectives where id = $1`, [o2])).status).toBe("partiel");
    expect(await tryAs(db, u.analyst, `select public.add_development_review($1, '{"reviewed_on":"2026-12-21","decision":"poursuivre","next_review_on":"2027-01-10"}'::jsonb, '[]'::jsonb)`, [p2])).toMatch(/row-level security|introuvable/);
  });

  it("confidentialité : lecture seule pour l'analyste vidéo, invisible pour la communication et les joueuses", async () => {
    expect(await as(db, u.analyst, `select id from public.development_plans`)).toHaveLength(3);
    expect(await as(db, u.analyst, `update public.development_plans set title = 'Modifié' where id = $1 returning id`, [plan])).toHaveLength(0);
    for (const k of ["comm", "player"]) {
      expect(await as(db, u[k], `select id from public.development_plans`)).toHaveLength(0);
      expect(await as(db, u[k], `select id from public.development_objectives`)).toHaveLength(0);
    }
    expect(await tryAs(db, u.comm, `insert into public.development_plans (club_id, scope, title, starts_on, ends_on) values ($1, 'collectif', 'Essai', '2026-11-27', '2027-01-31')`, [CLUB])).toMatch(/row-level security/);
  });
});
