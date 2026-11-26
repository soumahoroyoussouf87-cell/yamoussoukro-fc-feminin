/**
 * Banc de test LOCAL sans Docker : PostgreSQL 17 embarqué (PGlite) + stubs minimaux
 * de Supabase (auth.uid(), auth.users, storage, rôles anon/authenticated/service_role).
 * Les VRAIES migrations du dépôt sont appliquées telles quelles, puis chaque test
 * agit sous l'identité d'un compte simulé (claim « sub ») et du rôle `authenticated`,
 * exactement comme PostgREST. Aucune donnée réelle n'est utilisée.
 */
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";

const STUB = `
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create schema storage; create schema extensions;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
grant usage on schema auth, storage, public to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects to authenticated;
`;

export const CLUB = "6f1d6a3e-0000-4000-8000-000000000001";
export const TEAM = "6f1d6a3e-0000-4000-8000-000000000002";

export async function createLocalDb() {
  const db = new PGlite();
  await db.exec(STUB);
  const dir = path.resolve(__dirname, "../../supabase");
  for (const f of fs.readdirSync(path.join(dir, "migrations")).filter((f) => f.endsWith(".sql")).sort()) {
    const sql = fs.readFileSync(path.join(dir, "migrations", f), "utf8").replace(/create extension if not exists pgcrypto with schema extensions;/, "");
    try {
      await db.exec(sql);
    } catch (e) {
      throw new Error(`${f} : ${(e as Error).message}`);
    }
  }
  await db.exec(fs.readFileSync(path.join(dir, "seed.sql"), "utf8"));
  return db;
}

export type Db = Awaited<ReturnType<typeof createLocalDb>>;

/** Crée un compte simulé avec un rôle du club (ou aucun). */
export async function makeUser(db: Db, key: string, roleCode: string | null) {
  const { rows } = await db.query<{ id: string }>(`insert into auth.users (email) values ($1) returning id`, [`${key}@yfc.test`]);
  const id = rows[0].id;
  if (roleCode) {
    await db.query(
      `insert into public.user_roles (user_id, club_id, role_id) select $1, $2, id from public.roles where code = $3`,
      [id, CLUB, roleCode],
    );
  }
  return id;
}

/** Exécute une requête sous l'identité d'un compte (rôle authenticated + RLS). */
export async function as<T = Record<string, unknown>>(db: Db, userId: string | null, sql: string, params: unknown[] = []) {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId ?? ""]);
    await tx.exec(userId ? "set local role authenticated" : "set local role anon");
    const res = await tx.query<T>(sql, params);
    return res.rows;
  });
}

/** Comme `as`, mais renvoie le message d'erreur (ou null si succès). */
export async function tryAs(db: Db, userId: string | null, sql: string, params: unknown[] = []) {
  try {
    await as(db, userId, sql, params);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}
