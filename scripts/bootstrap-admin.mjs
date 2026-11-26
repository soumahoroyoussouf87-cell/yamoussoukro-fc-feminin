// Amorçage du PREMIER administrateur (à exécuter une seule fois, côté serveur).
// Usage : node --env-file=.env.local scripts/bootstrap-admin.mjs <email> "<Nom complet>"
// Envoie une invitation (le mot de passe est choisi par la personne via le lien reçu),
// puis attribue le rôle admin via la fonction protégée app.bootstrap_first_admin.
import { createClient } from "@supabase/supabase-js";

const [email, fullName = ""] = process.argv.slice(2);
if (!email) { console.error("Usage : bootstrap-admin.mjs <email> [nom]"); process.exit(1); }
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: club, error: e1 } = await admin.from("clubs").select("id, name").limit(1).single();
if (e1) { console.error("Aucun club : exécutez d'abord la création du club (seed)."); process.exit(1); }

const { data: existing } = await admin.from("profiles").select("id").eq("email", email.toLowerCase()).maybeSingle();
if (!existing) {
  const { error } = await admin.auth.admin.inviteUserByEmail(email, { data: { full_name: fullName }, redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/definir-mot-de-passe` });
  if (error) { console.error("Invitation impossible :", error.message); process.exit(1); }
}
const { error } = await admin.rpc("bootstrap_first_admin", { p_email: email, p_club: club.id });
if (error) { console.error(error.message); process.exit(1); }
console.log(`Administrateur créé pour ${club.name} : ${email}. Le lien d'activation a été envoyé par e-mail.`);
