/**
 * Phase 3 · livraison 3 — Projet de jeu et évaluations collectives (migration 012) sur les VRAIES migrations (PGlite).
 * Seed du cahier des charges, gel de la version publiée, clone puis publication, systèmes,
 * circuit de validation et verrouillage, copie des objectifs de compacité, RLS par rôle.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { as, CLUB, createLocalDb, makeUser, tryAs, type Db } from "./pg-harness";

let db: Db;
const u: Record<string, string> = {};
let v1 = "";
let v2 = "";
let evalId = "";

const one = async <T,>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];

beforeAll(async () => {
  db = await createLocalDb();
  for (const [k, role] of [["coach", "head_coach"], ["assistant", "assistant_coach"], ["comm", "communication"], ["admin", "admin"], ["player", "player"]] as const) {
    u[k] = await makeUser(db, k, role);
  }
  v1 = (await one<{ id: string }>(`select v.id from public.game_model_versions v join public.game_models m on m.id = v.model_id where m.club_id = $1 and v.status = 'publie'`, [CLUB])).id;
}, 60_000);

describe("Projet de jeu du cahier des charges (§9)", () => {
  it("version 1 publiée : 5 moments pondérés à 100 %, 41 principes, 4 objectifs de compacité", async () => {
    const m = await db.query<{ code: string; weight: string }>(`select code, weight from public.game_moments where version_id = $1 order by sort_order`, [v1]);
    expect(m.rows).toHaveLength(5);
    expect(m.rows.reduce((a, r) => a + Number(r.weight), 0)).toBe(100);
    expect((await one<{ c: number }>(`select count(*)::int c from public.game_principles where version_id = $1`, [v1])).c).toBe(41);
    expect((await one<{ c: number }>(`select count(*)::int c from public.compactness_targets where club_id = $1`, [CLUB])).c).toBe(4);
  });

  it("lecture avec evaluations.read ; rien pour la communication, l'administration ou les joueuses", async () => {
    expect(await as(db, u.assistant, `select id from public.game_principles where version_id = $1`, [v1])).toHaveLength(41);
    for (const k of ["comm", "admin", "player"]) expect(await as(db, u[k], `select id from public.game_principles`)).toHaveLength(0);
  });

  it("la version publiée est figée, même pour l'entraîneur principal", async () => {
    expect(await tryAs(db, u.coach, `update public.game_principles set label = 'Changé' where version_id = $1`, [v1])).toMatch(/figé/);
    expect(await tryAs(db, u.coach, `update public.game_moments set weight = 50 where version_id = $1 and code = 'cpa'`, [v1])).toMatch(/figé/);
    expect(await tryAs(db, u.coach, `delete from public.game_model_versions where id = $1`, [v1])).toMatch(/ne se supprime pas/);
  });

  it("seul frameworks.manage crée un brouillon ; publication contrôlée puis archivage de l'ancienne version", async () => {
    expect(await tryAs(db, u.assistant, `select public.clone_game_model_version($1, 'v2 adjoint')`, [v1])).toMatch(/réservée/);
    v2 = (await as<{ id: string }>(db, u.coach, `select public.clone_game_model_version($1, 'Saison 2') id`, [v1]))[0].id;
    expect((await one<{ c: number }>(`select count(*)::int c from public.game_principles where version_id = $1`, [v2])).c).toBe(41);
    await as(db, u.coach, `update public.game_moments set weight = 40 where version_id = $1 and code = 'cpa'`, [v2]);
    expect(await tryAs(db, u.coach, `select public.publish_game_model_version($1)`, [v2])).toMatch(/total 130/);
    await as(db, u.coach, `update public.game_moments set weight = 10 where version_id = $1 and code = 'cpa'`, [v2]);
    await as(db, u.coach, `update public.game_principles set label = 'Sortir proprement de derrière' where version_id = $1 and sort_order = 1`, [v2]);
    await as(db, u.coach, `select public.publish_game_model_version($1)`, [v2]);
    const s = await db.query<{ id: string; status: string }>(`select id, status from public.game_model_versions where id in ($1, $2)`, [v1, v2]);
    expect(Object.fromEntries(s.rows.map((r) => [r.id, r.status]))).toEqual({ [v1]: "archive", [v2]: "publie" });
    // L'historique n'est pas réécrit.
    expect((await one<{ c: number }>(`select count(*)::int c from public.game_principles where version_id = $1 and label = 'Sortir proprement de derrière'`, [v1])).c).toBe(0);
  });
});

describe("Systèmes et animations", () => {
  it("un seul système du club ; une animation se rattache à un système de référence", async () => {
    const slots = JSON.stringify([{ label: "GB", x: 50, y: 95 }]);
    const ref = (await as<{ id: string }>(db, u.coach, `insert into public.game_systems (club_id, name, base, phase, slots, is_reference) values ($1, '4-3-3', '4-3-3', 'reference', $2, true) returning id`, [CLUB, slots]))[0].id;
    await as(db, u.coach, `insert into public.game_systems (club_id, name, base, phase, parent_id, slots) values ($1, '3-2-5', '4-3-3', 'possession', $2, $3)`, [CLUB, ref, slots]);
    expect(await tryAs(db, u.coach, `insert into public.game_systems (club_id, name, base, phase, slots, is_reference) values ($1, '4-4-2', '4-4-2', 'reference', $2, true)`, [CLUB, slots])).toMatch(/unique|duplicate/);
    expect(await tryAs(db, u.coach, `insert into public.game_systems (club_id, name, base, phase, slots) values ($1, 'Orpheline', '4-3-3', 'possession', $2)`, [CLUB, slots])).toMatch(/check|rattache/);
    expect(await tryAs(db, u.assistant, `insert into public.game_systems (club_id, name, base, phase, slots) values ($1, 'Adj', '4-3-3', 'reference', $2)`, [CLUB, slots])).toMatch(/row-level security/);
  });
});

describe("Évaluations collectives", () => {
  it("refuse une version non publiée et un principe hors version ; la communication n'écrit pas", async () => {
    expect(await tryAs(db, u.assistant, `insert into public.collective_evaluations (club_id, game_model_version_id, context, evaluated_on, title) values ($1, $2, 'match', '2026-11-22', 'Vieux')`, [CLUB, v1])).toMatch(/pas publié/);
    expect(await tryAs(db, u.comm, `insert into public.collective_evaluations (club_id, game_model_version_id, context, evaluated_on, title) values ($1, $2, 'match', '2026-11-22', 'Comm')`, [CLUB, v2])).toMatch(/row-level security/);
    evalId = (await as<{ id: string }>(db, u.assistant, `insert into public.collective_evaluations (club_id, game_model_version_id, context, evaluated_on, title) values ($1, $2, 'match', '2026-11-22', 'Collectif J5') returning id`, [CLUB, v2]))[0].id;
    expect(await tryAs(db, u.assistant, `insert into public.collective_scores (club_id, collective_evaluation_id, unit_kind, unit_code, criterion_code, score) values ($1, $2, 'principe', 'inexistant', 'maitrise', 4)`, [CLUB, evalId])).toMatch(/hors du projet/);
    expect(await tryAs(db, u.assistant, `insert into public.collective_scores (club_id, collective_evaluation_id, unit_kind, unit_code, criterion_code, score) values ($1, $2, 'secteur', 'defense', 'vitesse', 4)`, [CLUB, evalId])).toMatch(/check/);
  });

  it("notes, N/E et mesure de compacité avec l'objectif en vigueur copié", async () => {
    const code = (await one<{ code: string }>(`select code from public.game_principles where version_id = $1 order by sort_order limit 1`, [v2])).code;
    await as(db, u.assistant, `insert into public.collective_scores (club_id, collective_evaluation_id, unit_kind, unit_code, criterion_code, score, fact) values
      ($1, $2, 'principe', $3, 'maitrise', 4, 'Relance courte réussie 6 fois sur 8'), ($1, $2, 'secteur', 'defense', 'coordination', 3, null), ($1, $2, 'relation', 'defense_milieu', 'distances', null, null)`, [CLUB, evalId, code]);
    await as(db, u.assistant, `insert into public.collective_measures (club_id, collective_evaluation_id, relation_code, situation, distance_m) values ($1, $2, 'defense_milieu', 'bloc_median', 13)`, [CLUB, evalId]);
    const m = await one<{ target_min: string; target_max: string }>(`select target_min, target_max from public.collective_measures where collective_evaluation_id = $1`, [evalId]);
    expect([Number(m.target_min), Number(m.target_max)]).toEqual([10, 15]);
  });

  it("validation réservée et historisée, puis verrouillage ; l'objectif copié ne change plus", async () => {
    expect(await tryAs(db, u.assistant, `update public.collective_evaluations set status = 'valide' where id = $1`, [evalId])).toMatch(/réservée/);
    await as(db, u.assistant, `update public.collective_evaluations set status = 'soumis' where id = $1`, [evalId]);
    await as(db, u.coach, `update public.collective_evaluations set status = 'valide' where id = $1`, [evalId]);
    const h = await db.query<{ to_status: string }>(`select to_status from public.approval_history where entity_id = $1 order by id`, [evalId]);
    expect(h.rows.map((r) => r.to_status)).toEqual(["brouillon", "soumis", "valide"]);
    expect(await tryAs(db, u.assistant, `update public.collective_scores set score = 5 where collective_evaluation_id = $1`, [evalId])).toMatch(/validée/);
    expect(await as(db, u.assistant, `delete from public.collective_evaluations where id = $1 returning id`, [evalId])).toHaveLength(0);
    await as(db, u.coach, `update public.compactness_targets set min_m = 8, max_m = 12 where club_id = $1 and situation = 'bloc_median' and relation_code = 'defense_milieu'`, [CLUB]);
    await as(db, u.coach, `update public.collective_measures set note = 'Revu' where collective_evaluation_id = $1`, [evalId]);
    const m = await one<{ target_min: string; target_max: string }>(`select target_min, target_max from public.collective_measures where collective_evaluation_id = $1`, [evalId]);
    expect([Number(m.target_min), Number(m.target_max)]).toEqual([10, 15]);
    const n = await one<{ c: number }>(`select count(*)::int c from public.notifications where link = '/performance/collective/' || $1`, [evalId]);
    expect(n.c).toBeGreaterThan(0);
  });

  it("une joueuse ne voit aucune évaluation collective", async () => {
    expect(await as(db, u.player, `select id from public.collective_evaluations`)).toHaveLength(0);
  });
});
