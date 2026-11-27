/**
 * Phase 3 · livraison 5 — Coups de pied arrêtés (migration 014) sur les VRAIES migrations (PGlite).
 * Confidentialité (staff technique), joueuses du club uniquement, rôle obligatoire, tireuses sans doublon.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { as, CLUB, createLocalDb, makeUser, tryAs, type Db } from "./pg-harness";

let db: Db;
const u: Record<string, string> = {};
let p1 = "";
let p2 = "";
let foreign = "";
let sp = "";

const one = async <T,>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];

beforeAll(async () => {
  db = await createLocalDb();
  for (const [k, role] of [["coach", "head_coach"], ["assistant", "assistant_coach"], ["kit", "kit_manager"], ["comm", "communication"], ["player", "player"]] as const) {
    u[k] = await makeUser(db, k, role);
  }
  p1 = (await one<{ id: string }>(`insert into public.players (club_id, first_name, last_name) values ($1, 'Awa', 'TIREUSE') returning id`, [CLUB])).id;
  p2 = (await one<{ id: string }>(`insert into public.players (club_id, first_name, last_name) values ($1, 'Mariam', 'BLOC') returning id`, [CLUB])).id;
  const club2 = (await one<{ id: string }>(`insert into public.clubs (name) values ('Autre club') returning id`)).id;
  foreign = (await one<{ id: string }>(`insert into public.players (club_id, first_name, last_name) values ($1, 'Hors', 'CLUB') returning id`, [club2])).id;
}, 60_000);

describe("Coups de pied arrêtés", () => {
  it("le staff technique crée une combinaison avec tireuses et responsabilités", async () => {
    const r = await as<{ id: string }>(db, u.assistant, `insert into public.set_piece_routines (club_id, category, name, side, signal, takers, responsibilities, diagram)
      values ($1, 'corner_off', 'Corner rentrant 1er poteau', 'droite', 'Main levée', array[$2, $3]::uuid[],
              jsonb_build_array(jsonb_build_object('player_id', $3::text, 'role', 'Bloc sur la gardienne'), jsonb_build_object('player_id', null, 'role', 'Zone entrée de surface')),
              '{"v":1}'::jsonb) returning id`, [CLUB, p1, p2]);
    expect(r).toHaveLength(1);
    sp = r[0].id;
  });

  it("refuse une joueuse d'un autre club, une tireuse en double et un rôle vide", async () => {
    expect(await tryAs(db, u.coach, `insert into public.set_piece_routines (club_id, category, name, takers) values ($1, 'penalty', 'Penalty', array[$2]::uuid[])`, [CLUB, foreign])).toMatch(/autre club/);
    expect(await tryAs(db, u.coach, `insert into public.set_piece_routines (club_id, category, name, takers) values ($1, 'penalty', 'Penalty', array[$2, $2]::uuid[])`, [CLUB, p1])).toMatch(/deux fois/);
    expect(await tryAs(db, u.coach, `update public.set_piece_routines set responsibilities = jsonb_build_array(jsonb_build_object('player_id', $2::text, 'role', '')) where id = $1`, [sp, p1])).toMatch(/Responsabilité invalide/);
    expect(await tryAs(db, u.coach, `update public.set_piece_routines set responsibilities = jsonb_build_array(jsonb_build_object('player_id', $2::text, 'role', 'Zone')) where id = $1`, [sp, foreign])).toMatch(/Responsabilité invalide/);
    expect(await tryAs(db, u.coach, `insert into public.set_piece_routines (club_id, category, name) values ($1, 'corner', 'Mauvaise catégorie')`, [CLUB])).toMatch(/check constraint|contrainte/);
  });

  it("confidentiel : invisible et non modifiable pour l'intendance, la communication et les joueuses", async () => {
    for (const k of ["kit", "comm", "player"]) expect(await as(db, u[k], `select id from public.set_piece_routines`)).toHaveLength(0);
    expect(await tryAs(db, u.kit, `insert into public.set_piece_routines (club_id, category, name) values ($1, 'cf_off', 'Essai')`, [CLUB])).toMatch(/row-level security/);
    expect(await as(db, u.comm, `update public.set_piece_routines set name = 'Piraté' where id = $1 returning id`, [sp])).toHaveLength(0);
    expect(await as(db, u.player, `delete from public.set_piece_routines where id = $1 returning id`, [sp])).toHaveLength(0);
    expect(await as(db, u.coach, `select id from public.set_piece_routines`)).toHaveLength(1);
  });

  it("archivage puis suppression par le staff technique ; chaque modification est journalisée", async () => {
    await as(db, u.assistant, `update public.set_piece_routines set archived_at = now() where id = $1`, [sp]);
    const audit = await one<{ c: number }>(`select count(*)::int c from public.audit_logs where table_name = 'set_piece_routines' and record_id = $1`, [sp]);
    expect(audit.c).toBeGreaterThanOrEqual(2);
    expect(await as(db, u.assistant, `delete from public.set_piece_routines where id = $1 returning id`, [sp])).toHaveLength(1);
  });
});
