/**
 * Phase 2 — tests de sécurité et de workflow sur les VRAIES migrations
 * (PostgreSQL 17 embarqué, voir pg-harness.ts). Plusieurs comptes de rôles
 * différents sont simulés ; chaque assertion passe par la RLS.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { as, CLUB, createLocalDb, makeUser, TEAM, tryAs, type Db } from "./pg-harness";

let db: Db;
const u: Record<string, string> = {};
let season = "";
let match = "";
let p1 = "";
let p2 = "";
let p3 = "";

beforeAll(async () => {
  db = await createLocalDb();
  for (const [k, role] of [
    ["admin", "admin"], ["director", "sporting_director"], ["coach", "head_coach"], ["assistant", "assistant_coach"],
    ["tm", "team_manager"], ["comm", "communication"], ["kit", "kit_manager"], ["medical", "medical_staff"],
    ["player1", "player"], ["player2", "player"], ["nobody", null],
  ] as const) {
    u[k] = await makeUser(db, k, role);
  }
  // Fixtures (superutilisateur, hors RLS) : saison, joueuses, adversaire, match.
  season = (await db.query<{ id: string }>(
    `insert into public.seasons (club_id, label, starts_on, ends_on, is_active) values ($1, 'TEST 2026-2027', '2026-08-01', '2027-06-30', true) returning id`, [CLUB])).rows[0].id;
  const mk = async (first: string, profile: string | null) =>
    (await db.query<{ id: string }>(`insert into public.players (club_id, first_name, last_name, profile_id) values ($1, $2, 'TEST', $3) returning id`, [CLUB, first, profile])).rows[0].id;
  // Profils pour relier les comptes joueuses.
  await db.query(`insert into public.profiles (id) values ($1), ($2) on conflict do nothing`, [u.player1, u.player2]);
  p1 = await mk("Une", u.player1);
  p2 = await mk("Deux", u.player2);
  p3 = await mk("Trois", null);
  const opp = (await db.query<{ id: string }>(`insert into public.opponents (club_id, name) values ($1, 'TEST Adversaire') returning id`, [CLUB])).rows[0].id;
  match = (await db.query<{ id: string }>(
    `insert into public.matches (club_id, team_id, season_id, opponent_id, kickoff_at) values ($1, $2, $3, $4, '2026-12-06 15:00+00') returning id`,
    [CLUB, TEAM, season, opp])).rows[0].id;
}, 60_000);

describe("Accès anonyme et sans rôle", () => {
  it("ne voit aucune donnée de planification ni de compétition", async () => {
    for (const t of ["training_sessions", "exercises", "calendar_events", "microcycles", "lineups", "match_squads", "delegations", "match_events"]) {
      expect(await tryAs(db, null, `select id from public.${t}`)).toMatch(/permission denied/);
      expect(await as(db, u.nobody, `select id from public.${t}`)).toHaveLength(0);
    }
  });
});

describe("Séances et workflow Brouillon → Validé → Publié", () => {
  let session = "";
  let exercise = "";

  it("numérote automatiquement les séances par saison", async () => {
    const rows = await as<{ id: string; number: number }>(db, u.assistant,
      `insert into public.training_sessions (club_id, team_id, season_id, session_date, theme) values ($1, $2, $3, '2026-12-01', 'Conservation') returning id, number`,
      [CLUB, TEAM, season]);
    session = rows[0].id;
    expect(rows[0].number).toBe(1);
    const second = await as<{ number: number }>(db, u.assistant,
      `insert into public.training_sessions (club_id, team_id, season_id, session_date, theme) values ($1, $2, $3, '2026-12-02', 'Pressing') returning number`,
      [CLUB, TEAM, season]);
    expect(second[0].number).toBe(2);
  });

  it("refuse la validation à l'entraîneur adjoint", async () => {
    expect(await tryAs(db, u.assistant, `update public.training_sessions set status = 'valide' where id = $1`, [session])).toMatch(/Validation réservée/);
    expect(await tryAs(db, u.assistant, `update public.training_sessions set status = 'soumis' where id = $1`, [session])).toBeNull();
  });

  it("intègre un exercice de la bibliothèque dans la séance", async () => {
    exercise = (await as<{ id: string }>(db, u.assistant,
      `insert into public.exercises (club_id, title, category) values ($1, 'TEST Rondo 5v2', 'technique_offensive') returning id`, [CLUB]))[0].id;
    expect(await tryAs(db, u.assistant,
      `insert into public.session_exercises (club_id, session_id, exercise_id, block) values ($1, $2, $3, 'echauffement')`, [CLUB, session, exercise])).toBeNull();
  });

  it("l'entraîneur principal valide puis publie ; l'historique et les notifications suivent", async () => {
    expect(await tryAs(db, u.coach, `update public.training_sessions set status = 'valide' where id = $1`, [session])).toBeNull();
    const [row] = await as<{ validated_by: string }>(db, u.coach, `select validated_by from public.training_sessions where id = $1`, [session]);
    expect(row.validated_by).toBe(u.coach);
    expect(await tryAs(db, u.coach, `update public.training_sessions set status = 'publie' where id = $1`, [session])).toBeNull();
    const hist = await as<{ to_status: string; actor_id: string }>(db, u.coach,
      `select to_status, actor_id from public.approval_history where entity_id = $1 order by id`, [session]);
    expect(hist.map((h) => h.to_status)).toEqual(["brouillon", "soumis", "valide", "publie"]);
    const notifCoach = await as(db, u.coach, `select id from public.notifications where kind = 'seance'`);
    const notifAssistant = await as(db, u.assistant, `select id from public.notifications where kind = 'seance'`);
    expect(notifCoach).toHaveLength(0); // l'auteur n'est pas notifié
    expect(notifAssistant.length).toBe(1);
  });

  it("une séance validée n'est plus modifiable par l'adjoint (fiche et exercices)", async () => {
    expect(await tryAs(db, u.assistant, `update public.training_sessions set theme = 'Autre' where id = $1`, [session])).toMatch(/Élément validé/);
    expect(await tryAs(db, u.assistant, `delete from public.session_exercises where session_id = $1`, [session])).toMatch(/Séance validée/);
    const del = await as(db, u.assistant, `delete from public.training_sessions where id = $1 returning id`, [session]);
    expect(del).toHaveLength(0);
  });

  it("une joueuse voit les séances publiées, jamais les brouillons", async () => {
    const rows = await as<{ number: number }>(db, u.player1, `select number from public.training_sessions order by number`);
    expect(rows.map((r) => r.number)).toEqual([1]);
    expect(await as(db, u.player1, `select id from public.exercises`)).toHaveLength(0);
  });

  it("le responsable communication et l'intendant ne modifient pas la planification", async () => {
    expect(await tryAs(db, u.comm, `insert into public.exercises (club_id, title, category) values ($1, 'TEST X', 'pressing')`, [CLUB])).toMatch(/row-level security/);
    expect(await tryAs(db, u.kit, `insert into public.calendar_events (club_id, team_id, type, title, event_date) values ($1, $2, 'reunion', 'TEST', '2026-12-03')`, [CLUB, TEAM])).toMatch(/row-level security/);
  });
});

describe("Convocations", () => {
  let squad = "";

  it("respecte la limite de convoquées de la rencontre", async () => {
    squad = (await as<{ id: string }>(db, u.tm,
      `insert into public.match_squads (club_id, match_id, size_limit) values ($1, $2, 11) returning id`, [CLUB, match]))[0].id;
    await db.query(`update public.match_squads set size_limit = 11 where id = $1`, [squad]);
    // On réduit artificiellement la limite à 2 (superutilisateur) pour tester le garde-fou.
    await db.query(`alter table public.match_squads drop constraint match_squads_size_limit_check`);
    await db.query(`update public.match_squads set size_limit = 2 where id = $1`, [squad]);
    expect(await tryAs(db, u.tm, `insert into public.match_squad_players (club_id, squad_id, player_id, confidential_comment) values ($1, $2, $3, 'TEST commentaire')`, [CLUB, squad, p1])).toBeNull();
    expect(await tryAs(db, u.tm, `insert into public.match_squad_players (club_id, squad_id, player_id) values ($1, $2, $3)`, [CLUB, squad, p2])).toBeNull();
    expect(await tryAs(db, u.tm, `insert into public.match_squad_players (club_id, squad_id, player_id) values ($1, $2, $3)`, [CLUB, squad, p3])).toMatch(/Liste complète/);
    expect(await tryAs(db, u.tm, `insert into public.match_squad_players (club_id, squad_id, player_id, status) values ($1, $2, $3, 'reserviste')`, [CLUB, squad, p3])).toBeNull();
  });

  it("les commentaires confidentiels sont réservés aux personnes habilitées", async () => {
    expect(await tryAs(db, u.tm, `select confidential_comment from public.match_squad_players`)).toMatch(/permission denied/);
    expect(await as(db, u.tm, `select * from public.squad_confidential_comments($1) where confidential_comment is not null`, [squad])).toHaveLength(0);
    expect(await as(db, u.coach, `select * from public.squad_confidential_comments($1) where confidential_comment is not null`, [squad])).toHaveLength(1);
  });

  it("le team manager ne peut pas valider ; une joueuse ne voit sa convocation qu'une fois publiée", async () => {
    expect(await tryAs(db, u.tm, `update public.match_squads set status = 'publie' where id = $1`, [squad])).toMatch(/Validation réservée/);
    expect(await as(db, u.player1, `select id from public.match_squad_players`)).toHaveLength(0);
    expect(await tryAs(db, u.coach, `update public.match_squads set status = 'publie' where id = $1`, [squad])).toBeNull();
    const mine = await as<{ player_id: string }>(db, u.player1, `select player_id from public.match_squad_players`);
    expect(mine.map((r) => r.player_id)).toEqual([p1]);
    const notif = await as(db, u.player1, `select id from public.notifications where kind = 'convocation'`);
    expect(notif).toHaveLength(1);
    expect(await tryAs(db, u.tm, `delete from public.match_squad_players where squad_id = $1`, [squad])).toMatch(/Convocation validée/);
  });
});

describe("Onze de départ — confidentialité et validation", () => {
  let lineup = "";
  let variant = "";

  it("une composition provisoire est invisible du responsable communication et des joueuses", async () => {
    lineup = (await as<{ id: string }>(db, u.assistant,
      `insert into public.lineups (club_id, match_id, system) values ($1, $2, '4-3-3') returning id`, [CLUB, match]))[0].id;
    await as(db, u.assistant,
      `insert into public.lineup_players (club_id, lineup_id, player_id, slot, x, y, is_captain) values ($1, $2, $3, 'titulaire', 50, 90, true)`, [CLUB, lineup, p1]);
    expect(await as(db, u.comm, `select id from public.lineups`)).toHaveLength(0);
    expect(await as(db, u.player1, `select id from public.lineup_players`)).toHaveLength(0);
    expect(await as(db, u.tm, `select id from public.lineups`)).toHaveLength(0);
    expect(await as(db, u.coach, `select id from public.lineups`)).toHaveLength(1);
  });

  it("seul un valideur rend une composition officielle, et une seule par match", async () => {
    expect(await tryAs(db, u.assistant, `update public.lineups set status = 'validee' where id = $1`, [lineup])).toMatch(/réservée/);
    expect(await tryAs(db, u.coach, `update public.lineups set status = 'validee' where id = $1`, [lineup])).toBeNull();
    variant = (await as<{ id: string }>(db, u.assistant,
      `insert into public.lineups (club_id, match_id, label, system) values ($1, $2, 'Variante bloc bas', '4-5-1') returning id`, [CLUB, match]))[0].id;
    expect(await tryAs(db, u.coach, `update public.lineups set status = 'validee' where id = $1`, [variant])).toMatch(/lineups_one_official|duplicate/);
  });

  it("une composition validée n'est plus modifiable par l'adjoint", async () => {
    expect(await tryAs(db, u.assistant, `update public.lineup_players set x = 10 where lineup_id = $1`, [lineup])).toMatch(/Composition officielle/);
    expect(await tryAs(db, u.assistant, `update public.lineups set system = '3-5-2' where id = $1`, [lineup])).toMatch(/Composition officielle/);
  });

  it("après communication, la composition officielle devient visible ; la variante reste confidentielle", async () => {
    expect(await as(db, u.comm, `select id from public.lineups`)).toHaveLength(0);
    expect(await tryAs(db, u.coach, `update public.lineups set status = 'communiquee' where id = $1`, [lineup])).toBeNull();
    const comm = await as<{ id: string }>(db, u.comm, `select id from public.lineups`);
    expect(comm.map((r) => r.id)).toEqual([lineup]);
    expect(await as(db, u.player2, `select player_id from public.lineup_players`)).toHaveLength(1);
  });
});

describe("Délégations et événements de match", () => {
  let delegation = "";

  it("le team manager prépare, ne valide pas ; la direction sportive valide", async () => {
    delegation = (await as<{ id: string }>(db, u.tm,
      `insert into public.delegations (club_id, match_id, transport, budget_planned) values ($1, $2, 'Car du club', 450000) returning id`, [CLUB, match]))[0].id;
    expect(await tryAs(db, u.tm, `insert into public.delegation_members (club_id, delegation_id, member_group, player_id, room) values ($1, $2, 'joueuse', $3, '101')`, [CLUB, delegation, p1])).toBeNull();
    expect(await tryAs(db, u.tm, `update public.delegations set status = 'soumis' where id = $1`, [delegation])).toBeNull();
    expect(await as(db, u.director, `select id from public.notifications where kind = 'delegation'`)).toHaveLength(1);
    expect(await tryAs(db, u.tm, `update public.delegations set status = 'valide' where id = $1`, [delegation])).toMatch(/Validation réservée/);
    expect(await tryAs(db, u.director, `update public.delegations set status = 'valide' where id = $1`, [delegation])).toBeNull();
    expect(await tryAs(db, u.tm, `insert into public.delegation_members (club_id, delegation_id, member_group, external_name) values ($1, $2, 'logistique', 'TEST Chauffeur')`, [CLUB, delegation])).toMatch(/Délégation validée/);
  });

  it("seules les personnes gérant les rencontres saisissent les événements", async () => {
    expect(await tryAs(db, u.tm, `insert into public.match_events (club_id, match_id, minute, type, player_id) values ($1, $2, 23, 'but', $3)`, [CLUB, match, p1])).toBeNull();
    expect(await tryAs(db, u.kit, `insert into public.match_events (club_id, match_id, minute, type, player_id) values ($1, $2, 30, 'but', $3)`, [CLUB, match, p2])).toMatch(/row-level security/);
    expect(await tryAs(db, u.tm, `insert into public.match_events (club_id, match_id, minute, type) values ($1, $2, 40, 'but')`, [CLUB, match])).toMatch(/check constraint/);
  });

  it("le staff médical n'accède à aucune composition provisoire", async () => {
    expect(await as(db, u.medical, `select id from public.lineups where status = 'provisoire'`)).toHaveLength(0);
  });
});
