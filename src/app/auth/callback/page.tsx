"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/browser";

const ALLOWED_NEXT = ["/definir-mot-de-passe", "/tableau-de-bord"];

/**
 * Finalise les liens des modèles d'e-mail PAR DÉFAUT de Supabase ({{ .ConfirmationURL }}) :
 * après vérification, Supabase renvoie ici les jetons dans le fragment (#access_token=…),
 * invisible côté serveur. On ouvre la session dans le navigateur (cookies), puis on redirige.
 */
export default function AuthCallbackPage() {
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const query = new URLSearchParams(window.location.search);
    const nextParam = query.get("next") ?? "";
    const type = hash.get("type");
    const fallbackNext = type === "invite" || type === "recovery" ? "/definir-mot-de-passe" : "/tableau-de-bord";
    const next = ALLOWED_NEXT.includes(nextParam) ? nextParam : fallbackNext;

    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    if (!accessToken || !refreshToken || hash.get("error") || query.get("error")) {
      window.location.replace("/connexion?erreur=lien");
      return;
    }
    createClient()
      .auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        window.location.replace(error ? "/connexion?erreur=lien" : next);
      });
  }, []);

  return (
    <main className="grid min-h-dvh place-items-center bg-[#07162E] p-6 text-sm text-white/80">
      Ouverture de votre session…
    </main>
  );
}
