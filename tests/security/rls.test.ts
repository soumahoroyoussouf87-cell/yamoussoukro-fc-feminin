/**
 * Tests d'intégration des politiques de sécurité (RLS + stockage) contre une
 * instance Supabase LOCALE (`npx supabase start`). Les comptes et fiches créés
 * ici sont des fixtures de test, préfixées « TEST », supprimées en fin de suite.
 *
 * Variables : SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 * (lues depuis `npx supabase status -o env`, voir scripts/test-security.sh).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON = process.env.SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CLUB = "6f1d6a3e-0000-4000-8000-000000000001";
const PASSWORD = "TestPass1234";
const RUN = Date.now().toString(36);

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

type Account = { id: string; email: string; client: SupabaseClient };
const accounts: Record<string, Account> = {};
const createdPlayers: string[] = [];

async function makeAccount(key: string, roleCode: string | null, metadata: Record<string, unknown> = {}) {
  const email = `test-${key}-${RUN}@yfc.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: `TEST ${key}`, ...metadata },
  });
  if (error) throw error;
  const id = data.user.id;
  if (roleCode) {
    const { data: role } = await admin.from("roles").select("id").eq("code", roleCode).single();
    const { error: e2 } = await admin.from("user_roles").insert({ user_id: id, club_id: CLUB, role_id: role!.id });
    if (e2) throw e2;
  }
  const client = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error: e3 } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (e3) throw e3;
  accounts[key] = { id, email, client };
  return accounts[key];
}

beforeAll(async () => {
  if (!ANON || !SERVICE) throw new Error("Variables SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY manquantes");
  await makeAccount("admin", "admin");
  await makeAccount("coach", "head_coach");
  await makeAccount("tm", "team_manager");
  await makeAccount("comm", "communication");
  await makeAccount("kit", "kit_manager");
  await makeAccount("nobody", null, { role: "admin", permissions: ["users.manage"] }); // métadonnées piégées
  await makeAccount("player", "player");
  await makeAccount("player2", "player");
}, 60_000);

afterAll(async () => {
  if (createdPlayers.length) await admin.from("players").delete().in("id", createdPlayers);
  for (const a of Object.values(accounts)) {
    await admin.from("user_roles").delete().eq("user_id", a.id);
    await admin.auth.admin.deleteUser(a.id);
  }
  await admin.from("audit_logs").delete().like("new_data->>last_name", `TEST-${RUN}%`);
});

describe("Accès anonyme", () => {
  it("ne voit ni club, ni joueuse, ni rôle", async () => {
    const anon = createClient(URL, ANON, { auth: { persistSession: false } });
    for (const table of ["clubs", "players", "staff_members", "user_roles", "audit_logs"]) {
      const { data } = await anon.from(table).select("id").limit(1);
      expect(data ?? []).toHaveLength(0);
    }
  });
});

describe("Effectif", () => {
  let playerId = "";
  let player2Id = "";

  it("le Team Manager crée une fiche joueuse", async () => {
    const { data, error } = await accounts.tm.client
      .from("players")
      .insert({ club_id: CLUB, first_name: "Fixture", last_name: `TEST-${RUN}-A` })
      .select("id")
      .single();
    expect(error).toBeNull();
    playerId = data!.id;
    createdPlayers.push(playerId);
    const { data: d2 } = await admin
      .from("players")
      .insert({ club_id: CLUB, first_name: "Fixture", last_name: `TEST-${RUN}-B`, profile_id: accounts.player2.id })
      .select("id")
      .single();
    player2Id = d2!.id;
    createdPlayers.push(player2Id);
    await admin.from("players").update({ profile_id: accounts.player.id }).eq("id", playerId);
  });

  it("l'entraîneur principal et la communication lisent l'effectif", async () => {
    for (const key of ["coach", "comm"]) {
      const { data } = await accounts[key].client.from("players").select("id").eq("id", playerId);
      expect(data).toHaveLength(1);
    }
  });

  it("l'intendant et la communication ne peuvent pas modifier une fiche", async () => {
    for (const key of ["kit", "comm"]) {
      const { data } = await accounts[key].client
        .from("players").update({ nationality: "X" }).eq("id", playerId).select("id");
      expect(data ?? []).toHaveLength(0);
    }
    const { error } = await accounts.kit.client
      .from("players").insert({ club_id: CLUB, first_name: "X", last_name: `TEST-${RUN}-X` });
    expect(error).not.toBeNull();
  });

  it("un compte sans rôle ne voit rien, même avec des métadonnées « admin »", async () => {
    const { data } = await accounts.nobody.client.from("players").select("id");
    expect(data ?? []).toHaveLength(0);
    const { data: perms } = await accounts.nobody.client.rpc("my_permissions", { p_club: CLUB });
    expect(perms ?? []).toHaveLength(0);
  });

  it("une joueuse ne voit que sa propre fiche", async () => {
    const { data } = await accounts.player.client.from("players").select("id");
    expect((data ?? []).map((r) => r.id)).toEqual([playerId]);
    const { data: other } = await accounts.player.client.from("players").select("id").eq("id", player2Id);
    expect(other ?? []).toHaveLength(0);
  });

  it("la communication n'accède pas aux documents administratifs", async () => {
    await admin.from("player_documents").insert({
      club_id: CLUB, player_id: playerId, kind: "licence", title: "TEST", storage_path: `${CLUB}/${playerId}/test-${RUN}.pdf`,
    });
    const { data: comm } = await accounts.comm.client.from("player_documents").select("id").eq("player_id", playerId);
    expect(comm ?? []).toHaveLength(0);
    const { data: tm } = await accounts.tm.client.from("player_documents").select("id").eq("player_id", playerId);
    expect(tm).toHaveLength(1);
  });

  it("le stockage photo respecte les permissions", async () => {
    const file = new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });
    const pathA = `${CLUB}/${playerId}/photo-${RUN}.png`;
    const pathB = `${CLUB}/${player2Id}/photo-${RUN}.png`;
    const up = await accounts.tm.client.storage.from("player-photos").upload(pathA, file);
    expect(up.error).toBeNull();
    await accounts.tm.client.storage.from("player-photos").upload(pathB, file);
    const denied = await accounts.comm.client.storage.from("player-photos").upload(`${CLUB}/${playerId}/x-${RUN}.png`, file);
    expect(denied.error).not.toBeNull();
    const own = await accounts.player.client.storage.from("player-photos").createSignedUrl(pathA, 60);
    expect(own.error).toBeNull();
    const other = await accounts.player.client.storage.from("player-photos").createSignedUrl(pathB, 60);
    expect(other.error).not.toBeNull();
    await admin.storage.from("player-photos").remove([pathA, pathB]);
  });
});

describe("Rôles et anti-escalade", () => {
  it("personne ne peut s'attribuer un rôle, même un administrateur", async () => {
    const { data: role } = await admin.from("roles").select("id").eq("code", "medical_staff").single();
    const { error } = await accounts.admin.client
      .from("user_roles").insert({ user_id: accounts.admin.id, club_id: CLUB, role_id: role!.id });
    expect(error).not.toBeNull();
  });

  it("un non-administrateur ne peut pas attribuer de rôle", async () => {
    const { data: role } = await admin.from("roles").select("id").eq("code", "admin").single();
    const { error } = await accounts.coach.client
      .from("user_roles").insert({ user_id: accounts.nobody.id, club_id: CLUB, role_id: role!.id });
    expect(error).not.toBeNull();
  });

  it("l'administrateur attribue puis révoque un rôle", async () => {
    const { data: role } = await admin.from("roles").select("id").eq("code", "kit_manager").single();
    const { data, error } = await accounts.admin.client
      .from("user_roles").insert({ user_id: accounts.nobody.id, club_id: CLUB, role_id: role!.id })
      .select("id, granted_by").single();
    expect(error).toBeNull();
    expect(data!.granted_by).toBe(accounts.admin.id);
    const { error: e2 } = await accounts.admin.client
      .from("user_roles").update({ revoked_at: new Date().toISOString() }).eq("id", data!.id);
    expect(e2).toBeNull();
  });

  it("l'administrateur n'a pas accès aux permissions médicales", async () => {
    const { data } = await accounts.admin.client.rpc("my_permissions", { p_club: CLUB });
    expect(data).toContain("users.manage");
    expect(data).not.toContain("medical.read");
  });

  it("une joueuse ne peut pas modifier l'adresse e-mail de son profil", async () => {
    const { error } = await accounts.player.client
      .from("profiles").update({ email: "pirate@x.test" }).eq("id", accounts.player.id);
    expect(error).not.toBeNull();
    const { error: ok } = await accounts.player.client
      .from("profiles").update({ theme: "light" }).eq("id", accounts.player.id);
    expect(ok).toBeNull();
  });
});

describe("Journal d'audit", () => {
  it("trace les modifications et reste en lecture seule", async () => {
    const { data: logs } = await accounts.admin.client
      .from("audit_logs").select("id, action, actor_id").eq("table_name", "players")
      .eq("actor_id", accounts.tm.id).limit(5);
    expect((logs ?? []).length).toBeGreaterThan(0);
    const { data: deleted } = await accounts.admin.client.from("audit_logs").delete().eq("id", logs![0].id).select("id");
    expect(deleted ?? []).toHaveLength(0);
    const { data: comm } = await accounts.comm.client.from("audit_logs").select("id").limit(1);
    expect(comm ?? []).toHaveLength(0);
  });
});
