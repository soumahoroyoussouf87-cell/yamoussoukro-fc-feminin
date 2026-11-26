import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { env } from "@/lib/env";

/**
 * Client « service_role » — CONTOURNE la RLS.
 * Réservé aux opérations d'administration côté serveur (invitations de comptes),
 * toujours APRÈS vérification explicite de la permission de l'appelant.
 * Ne jamais importer ce module dans un composant client.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY n'est pas configurée sur le serveur.");
  return createClient<Database>(env.supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
