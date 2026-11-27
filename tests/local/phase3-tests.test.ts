/**
 * Phase 3 · livraison 2 — Tests techniques (migration 011) sur les VRAIES migrations (PGlite).
 * Protocoles du cahier des charges, versionnage, copie du protocole dans chaque résultat,
 * calcul de l'indice, circuit de validation, verrouillage et RLS par rôle.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { as, CLUB, createLocalDb, makeUser, tryAs, type Db } from "./pg-harness";

let db: Db;
const u: Record<string, string> = {};
let player = "";
const prot: Record<string, string> = {};
let session = "";

const one = async <T,>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];

beforeAll(async () => {
  db = await createLocalDb();
  for (const [k, role] of [["coach", "head_coach"], ["assistant", "assistant_coach"], ["comm", "communication"], ["admin", "admin"], ["player", "player"]] as const) {
    u[k] = await makeUser(db, k, role);
  }
  player = (await one<{ id: string }>(`insert into public.players (club_id, first_name, last_name) values ($1, 'Test', 'TECH') returning id`, [CLUB])).id;
  for (const r of (await db.query<{ id: string; code: string }>(`select id, code from public.technical_test_protocols where club_id = $1`, [CLUB])).rows) prot[r.code] = r.id;
}, 60_000);

describe("Protocoles du cahier des charges (§21)", () => {
  it("12 protocoles créés pour le club, dont 2 chronométrés sans barème", async () => {
    expect(Object.keys(prot)).toHaveLength(12);
    const t = await db.query<{ code: string; ref_best: string | null }>(`select code, ref_best from public.technical_test_protocols where measure = 'temps' order by code`);
    expect(t.rows).toEqual([{ code: "conduite_chrono", ref_best: null }, { code: "slalom", ref_best: null }]);
  });

  it("chaque protocole alimente des critères techniques existants du référentiel", async () => {
    const r = await one<{ missing: number }>(`
      select count(*)::int missing from public.technical_test_protocols p, unnest(p.criterion_codes) x(cc)
      where not exists (select 1 from public.evaluation_criteria c join public.evaluation_dimensions d on d.id = c.dimension_id
                        where c.club_id = p.club_id and c.code = x.cc and d.code = 'technique')`);
    expect(r.missing).toBe(0);
  });

  it("lecture réservée à evaluations.read, gestion à frameworks.manage, aucune suppression", async () => {
    expect(await as(db, u.assistant, `select id from public.technical_test_protocols`)).toHaveLength(12);
    for (const k of ["comm", "admin", "player"]) expect(await as(db, u[k], `select id from public.technical_test_protocols`)).toHaveLength(0);
    expect(await as(db, u.assistant, `update public.technical_test_protocols set name = 'Pirate' where id = $1 returning id`, [prot.slalom])).toHaveLength(0);
    expect(await as(db, u.coach, `delete from public.technical_test_protocols where id = $1 returning id`, [prot.slalom])).toHaveLength(0);
  });

  it("modifier les conditions ou le barème crée une nouvelle version ; le nom seul non", async () => {
    await as(db, u.coach, `update public.technical_test_protocols set name = 'Slalom 6 plots' where id = $1`, [prot.slalom]);
    expect((await one<{ v: number }>(`select version_no v from public.technical_test_protocols where id = $1`, [prot.slalom])).v).toBe(1);
    await as(db, u.coach, `update public.technical_test_protocols set ref_best = 8, ref_limit = 12 where id = $1`, [prot.slalom]);
    expect((await one<{ v: number }>(`select version_no v from public.technical_test_protocols where id = $1`, [prot.slalom])).v).toBe(2);
    expect(await tryAs(db, u.coach, `update public.technical_test_protocols set ref_best = 12, ref_limit = 8 where id = $1`, [prot.slalom])).toMatch(/check/);
  });
});

describe("Séances et résultats", () => {
  it("crée une séance, refuse un protocole d'un autre club", async () => {
    session = (await as<{ id: string }>(db, u.assistant,
      `insert into public.technical_test_sessions (club_id, tested_on, title, conditions, protocol_ids, player_ids) values ($1, '2026-11-20', 'Tests novembre', 'Synthétique, sec', $2, $3) returning id`,
      [CLUB, [prot.passe_courte_cible, prot.slalom], [player]]))[0].id;
    expect(await tryAs(db, u.assistant,
      `insert into public.technical_test_sessions (club_id, tested_on, title, protocol_ids) values ($1, '2026-11-20', 'X', array[gen_random_uuid()])`, [CLUB])).toMatch(/autre club/);
    expect(await tryAs(db, u.comm,
      `insert into public.technical_test_sessions (club_id, tested_on, title) values ($1, '2026-11-20', 'Comm')`, [CLUB])).toMatch(/row-level security/);
  });

  it("copie le protocole dans le résultat et calcule l'indice", async () => {
    await as(db, u.assistant, `insert into public.technical_test_results (club_id, test_session_id, protocol_id, player_id, attempts, successes, errors)
      values ($1, $2, $3, $4, 10, 7, 2)`, [CLUB, session, prot.passe_courte_cible, player]);
    await as(db, u.assistant, `insert into public.technical_test_results (club_id, test_session_id, protocol_id, player_id, attempts, value_seconds)
      values ($1, $2, $3, $4, 3, 10)`, [CLUB, session, prot.slalom, player]);
    const r = await db.query<{ measure: string; index_value: string; protocol_version: number; criterion_codes: string[] }>(
      `select measure, index_value, protocol_version, criterion_codes from public.technical_test_results where test_session_id = $1 order by measure`, [session]);
    expect(r.rows.map((x) => [x.measure, Number(x.index_value), x.protocol_version])).toEqual([["reussite", 70, 1], ["temps", 50, 2]]);
    expect(r.rows[0].criterion_codes).toEqual(["passe_courte", "qualite_passe"]);
    expect(await tryAs(db, u.assistant, `update public.technical_test_results set successes = 11 where test_session_id = $1 and measure = 'reussite'`, [session])).toMatch(/check/);
  });

  it("validation réservée, historisée, puis verrouillage ; la copie du protocole ne bouge plus", async () => {
    expect(await tryAs(db, u.assistant, `update public.technical_test_sessions set status = 'valide' where id = $1`, [session])).toMatch(/réservée/);
    await as(db, u.assistant, `update public.technical_test_sessions set status = 'soumis' where id = $1`, [session]);
    await as(db, u.coach, `update public.technical_test_sessions set status = 'valide' where id = $1`, [session]);
    const h = await db.query<{ to_status: string }>(`select to_status from public.approval_history where entity_id = $1 order by id`, [session]);
    expect(h.rows.map((r) => r.to_status)).toEqual(["brouillon", "soumis", "valide"]);
    expect(await tryAs(db, u.assistant, `update public.technical_test_results set successes = 9 where test_session_id = $1`, [session])).toMatch(/validée/);
    expect(await as(db, u.assistant, `delete from public.technical_test_sessions where id = $1 returning id`, [session])).toHaveLength(0);
    // Nouveau barème : l'historique validé garde son indice et sa version.
    await as(db, u.coach, `update public.technical_test_protocols set ref_best = 6, ref_limit = 10 where id = $1`, [prot.slalom]);
    await as(db, u.coach, `update public.technical_test_results set notes = 'Revu' where test_session_id = $1 and measure = 'temps'`, [session]);
    const t = await one<{ index_value: string; protocol_version: number }>(`select index_value, protocol_version from public.technical_test_results where test_session_id = $1 and measure = 'temps'`, [session]);
    expect([Number(t.index_value), t.protocol_version]).toEqual([50, 2]);
    const n = await one<{ c: number }>(`select count(*)::int c from public.notifications where link = '/performance/tests/' || $1`, [session]);
    expect(n.c).toBeGreaterThan(0);
  });

  it("une joueuse ne voit pas ses résultats (portail en Phase 5)", async () => {
    expect(await as(db, u.player, `select id from public.technical_test_results`)).toHaveLength(0);
  });
});
