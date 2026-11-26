import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_NEXT = ["/definir-mot-de-passe", "/tableau-de-bord"];

/** Vérifie un lien d'invitation / de réinitialisation et ouvre la session. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next") ?? "/tableau-de-bord";
  const next = ALLOWED_NEXT.includes(nextParam) ? nextParam : "/tableau-de-bord";

  const code = searchParams.get("code");
  if (code) {
    // Flux PKCE (lien par défaut de Supabase avec redirect_to).
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  } else if (tokenHash && type && ["invite", "recovery", "email"].includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  return NextResponse.redirect(new URL("/connexion?erreur=lien", request.url));
}
