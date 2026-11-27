/**
 * Phase 3 · livraison 1 — Performance Framework (migration 010) sur les VRAIES migrations
 * (PGlite, voir pg-harness.ts). Référentiel initial, figement des versions publiées,
 * publication contrôlée, circuit de validation, verrouillage et RLS par rôle.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { as, CLUB, createLocalDb, makeUser, tryAs, type Db } from "./pg-harness";

let db: Db;
const u: Record<string, string> = {};
let v1 = "";
let player = "";

const one = async <T,>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];

beforeAll(async () => {
  db = await createLocalDb();
  for (const [k, role] of [
    ["director", "sporting_director"], ["coach", "head_coach"], ["assistant", "assistant_coach"], ["analyst", "video_analyst"],
    ["comm", "communication"], ["admin", "admin"], ["player", "player"], ["nobody", null],
  ] as const) u[k] = await makeUser(db, k, role);
  v1 = (await one<{ id: string }>(`select id from public.framework_versions where club_id = $1 and status = 'publie'`, [CLUB])).id;
  player = (await one<{ id: string }>(`insert into public.players (club_id, first_name, last_name) values ($1, 'Test', 'PERF') returning id`, [CLUB])).id;
}, 60_000);

describe("Référentiel initial du cahier des charges", () => {
  it("est créé et publié pour le club", async () => {
    const r = await one<{ dims: number; crit: number }>(
      `select (select count(*)::int from public.evaluation_dimensions where version_id = $1) dims,
              (select count(*)::int from public.evaluation_criteria where version_id = $1) crit`, [v1]);
    expect(r).toEqual({ dims: 6, crit: 92 });
  });

  it("totalise 100 % par poste (dimensions et technique)", async () => {
    const dims = await db.query<{ k: string; t: string }>(`select framework_key k, sum(weight) t from public.position_dimension_weights where version_id = $1 group by 1`, [v1]);
    expect(dims.rows).toHaveLength(9);
    expect(dims.rows.every((r) => Number(r.t) === 100)).toBe(true);
    const tech = await db.query<{ k: string; t: string }>(
      `select w.framework_key k, sum(w.weight) t from public.position_criteria_weights w where w.version_id = $1 group by 1`, [v1]);
    expect(tech.rows).toHaveLength(9);
    expect(tech.rows.every((r) => Number(r.t) === 100)).toBe(true);
    const gb = await one<{ te: string; ta: string }>(`select max(weight) filter (where dimension_code='technique') te, max(weight) filter (where dimension_code='tactique') ta
      from public.position_dimension_weights where version_id = $1 and framework_key = 'GB'`, [v1]);
    expect([Number(gb.te), Number(gb.ta)]).toEqual([30, 25]);
  });
});

describe("Accès aux référentiels et évaluations", () => {
  it("lecture réservée à evaluations.read", async () => {
    expect(await as(db, u.coach, `select id from public.evaluation_criteria`)).toHaveLength(92);
    expect(await as(db, u.analyst, `select id from public.evaluation_criteria`)).toHaveLength(92);
    for (const k of ["comm", "admin", "player", "nobody"]) {
      expect(await as(db, u[k], `select id from public.evaluation_criteria`)).toHaveLength(0);
      expect(await as(db, u[k], `select id from public.evaluation_scores`)).toHaveLength(0);
    }
    expect(await tryAs(db, null, `select id from public.evaluation_sessions`)).toMatch(/permission denied/);
  });

  it("gestion réservée à frameworks.manage", async () => {
    expect(await tryAs(db, u.assistant, `select public.clone_framework_version($1, 'x')`, [v1])).toMatch(/réservée/);
    expect(await as(db, u.assistant, `update public.framework_versions set label = 'pirate' where id = $1 returning id`, [v1])).toHaveLength(0);
  });
});

describe("Versionnage : une version publiée est figée", () => {
  let v2 = "";

  it("refuse toute modification d'une version publiée", async () => {
    expect(await tryAs(db, u.coach, `update public.evaluation_criteria set label = 'Autre' where version_id = $1 and code = 'dribble'`, [v1])).toMatch(/figé/);
    expect(await tryAs(db, u.coach, `update public.position_dimension_weights set weight = 40 where version_id = $1 and framework_key = 'GB' and dimension_code = 'technique'`, [v1])).toMatch(/figé/);
    expect(await tryAs(db, u.coach, `delete from public.framework_versions where id = $1`, [v1])).toMatch(/ne se supprime pas/);
    expect(await tryAs(db, u.coach, `update public.framework_versions set label = 'X' where id = $1`, [v1])).toMatch(/figé/);
  });

  it("copie une version en brouillon modifiable (un seul brouillon à la fois)", async () => {
    v2 = (await as<{ id: string }>(db, u.coach, `select public.clone_framework_version($1, 'Version 2') as id`, [v1]))[0].id;
    const r = await one<{ crit: number; w: number; d: number; no: number }>(
      `select (select count(*)::int from public.evaluation_criteria where version_id = $1) crit,
              (select count(*)::int from public.position_criteria_weights where version_id = $1) w,
              (select count(*)::int from public.position_dimension_weights where version_id = $1) d,
              (select version_no from public.framework_versions where id = $1) no`, [v2]);
    expect(r).toEqual({ crit: 92, w: 78, d: 54, no: 2 });
    expect(await tryAs(db, u.coach, `select public.clone_framework_version($1, 'Version 3')`, [v1])).toMatch(/duplicate|unique/);
    expect(await tryAs(db, u.coach, `update public.position_dimension_weights set weight = 34 where version_id = $1 and framework_key = 'DC' and dimension_code = 'tactique'`, [v2])).toBeNull();
  });

  it("refuse la publication si un poste ne totalise pas 100 %", async () => {
    expect(await tryAs(db, u.coach, `select public.publish_framework_version($1)`, [v2])).toMatch(/DC : total 99/);
    await as(db, u.coach, `update public.position_dimension_weights set weight = 35 where version_id = $1 and framework_key = 'DC' and dimension_code = 'tactique'`, [v2]);
    expect(await tryAs(db, u.coach, `select public.publish_framework_version($1)`, [v2])).toBeNull();
    const st = await db.query<{ id: string; status: string }>(`select id, status from public.framework_versions where id in ($1, $2)`, [v1, v2]);
    expect(Object.fromEntries(st.rows.map((r) => [r.id, r.status]))).toEqual({ [v1]: "archive", [v2]: "publie" });
    expect(await tryAs(db, u.coach, `update public.framework_versions set status = 'publie' where id = $1`, [v1])).toMatch(/archivée/);
  });
});

describe("Évaluations : circuit de validation et verrouillage", () => {
  let session = "";
  let ie = "";
  let crit = "";

  it("crée une évaluation sur la version publiée, jamais sur un brouillon ou une version archivée", async () => {
    expect(await tryAs(db, u.assistant,
      `insert into public.evaluation_sessions (club_id, framework_version_id, context, evaluated_on, title) values ($1, $2, 'match', '2026-11-20', 'Ancienne version')`, [CLUB, v1])).toMatch(/pas publié/);
    const pub = (await one<{ id: string }>(`select id from public.framework_versions where club_id = $1 and status = 'publie'`, [CLUB])).id;
    expect(await tryAs(db, u.assistant,
      `insert into public.evaluation_sessions (club_id, framework_version_id, context, evaluated_on, title, status) values ($1, $2, 'match', '2026-11-20', 'Auto-validée', 'valide')`, [CLUB, pub])).toMatch(/réservée/);
    session = (await as<{ id: string }>(db, u.assistant,
      `insert into public.evaluation_sessions (club_id, framework_version_id, context, evaluated_on, title) values ($1, $2, 'match', '2026-11-20', 'Match test') returning id`, [CLUB, pub]))[0].id;
    ie = (await as<{ id: string }>(db, u.assistant,
      `insert into public.individual_evaluations (club_id, evaluation_session_id, player_id, framework_key) values ($1, $2, $3, 'DC') returning id`, [CLUB, session, player]))[0].id;
    crit = (await one<{ id: string }>(`select id from public.evaluation_criteria where version_id = $1 and code = 'passe_verticale'`, [pub])).id;
    expect(await tryAs(db, u.assistant,
      `insert into public.evaluation_scores (club_id, individual_evaluation_id, criterion_id, score, fact, interpretation) values ($1, $2, $3, 4, 'Passe cassant deux lignes à la 23e', 'Bonne lecture')`, [CLUB, ie, crit])).toBeNull();
  });

  it("n'accepte ni une note hors échelle ni un critère d'une autre version", async () => {
    const other = (await one<{ id: string }>(`select id from public.evaluation_criteria where version_id = $1 and code = 'dribble'`, [v1])).id;
    expect(await tryAs(db, u.assistant, `insert into public.evaluation_scores (club_id, individual_evaluation_id, criterion_id, score) values ($1, $2, $3, 3)`, [CLUB, ie, other])).toMatch(/hors du référentiel/);
    expect(await tryAs(db, u.assistant, `update public.evaluation_scores set score = 6 where individual_evaluation_id = $1`, [ie])).toMatch(/check/);
    // N/E = note nulle, acceptée.
    const pubCrit = (await one<{ id: string }>(
      `select c.id from public.evaluation_criteria c join public.framework_versions v on v.id = c.version_id where v.status = 'publie' and c.code = 'placement'`)).id;
    expect(await tryAs(db, u.assistant, `insert into public.evaluation_scores (club_id, individual_evaluation_id, criterion_id, score) values ($1, $2, $3, null)`, [CLUB, ie, pubCrit])).toBeNull();
  });

  it("validation réservée, historisée, puis verrouillage pour l'adjoint", async () => {
    expect(await tryAs(db, u.assistant, `update public.evaluation_sessions set status = 'valide' where id = $1`, [session])).toMatch(/réservée/);
    await as(db, u.assistant, `update public.evaluation_sessions set status = 'soumis' where id = $1`, [session]);
    await as(db, u.coach, `update public.evaluation_sessions set status = 'valide' where id = $1`, [session]);
    const s = await one<{ validated_by: string }>(`select validated_by from public.evaluation_sessions where id = $1`, [session]);
    expect(s.validated_by).toBe(u.coach);
    const h = await db.query(`select to_status from public.approval_history where entity_id = $1 order by id`, [session]);
    expect(h.rows.map((r) => (r as { to_status: string }).to_status)).toEqual(["brouillon", "soumis", "valide"]);
    expect(await tryAs(db, u.assistant, `update public.evaluation_scores set score = 1 where individual_evaluation_id = $1`, [ie])).toMatch(/verrouill|validée/);
    expect(await tryAs(db, u.assistant, `delete from public.individual_evaluations where id = $1`, [ie])).toMatch(/validée/);
    expect(await as(db, u.assistant, `delete from public.evaluation_sessions where id = $1 returning id`, [session])).toHaveLength(0);
    // L'entraîneur principal (evaluations.validate) peut corriger.
    expect(await tryAs(db, u.coach, `update public.evaluation_scores set score = 5 where individual_evaluation_id = $1 and score is not null`, [ie])).toBeNull();
    const n = await one<{ c: number }>(`select count(*)::int c from public.notifications where kind = 'evaluation'`);
    expect(n.c).toBeGreaterThan(0);
  });

  it("une joueuse ne voit pas ses évaluations (portail en Phase 5)", async () => {
    expect(await as(db, u.player, `select id from public.individual_evaluations`)).toHaveLength(0);
  });
});
