"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, setPassword, signIn, type AuthState } from "@/app/connexion/actions";
import { Button } from "@/components/ui/button";

const input =
  "h-11 w-full rounded-md border border-white/15 bg-white/5 px-3 text-sm text-white placeholder:text-white/40 focus-visible:outline-2 focus-visible:outline-fuchsia";

function Feedback({ state }: { state: AuthState }) {
  if (state.error) return <p role="alert" className="rounded-md bg-red-500/15 px-3 py-2 text-sm text-red-200">{state.error}</p>;
  if (state.message) return <p role="status" className="rounded-md bg-emerald-500/15 px-3 py-2 text-sm text-emerald-200">{state.message}</p>;
  return null;
}

export function SignInForm({ suite, linkError }: { suite?: string; linkError?: boolean }) {
  const [state, action, pending] = useActionState(signIn, linkError ? { error: "Lien invalide ou expiré." } : {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="suite" value={suite ?? ""} />
      <label className="flex flex-col gap-1.5 text-sm">
        Adresse e-mail
        <input className={input} type="email" name="email" autoComplete="email" required />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        Mot de passe
        <input className={input} type="password" name="password" autoComplete="current-password" required />
      </label>
      <Feedback state={state} />
      <Button type="submit" size="lg" disabled={pending}>{pending ? "Connexion…" : "Se connecter"}</Button>
      <Link href="/mot-de-passe-oublie" className="text-center text-xs text-white/70 underline-offset-4 hover:underline">
        Mot de passe oublié ?
      </Link>
      <p className="text-center text-xs text-white/50">
        Accès réservé au personnel et aux joueuses du club. Les comptes sont créés par l&apos;administrateur.
      </p>
    </form>
  );
}

export function ResetRequestForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        Adresse e-mail du compte
        <input className={input} type="email" name="email" autoComplete="email" required />
      </label>
      <Feedback state={state} />
      <Button type="submit" size="lg" disabled={pending}>Envoyer le lien</Button>
      <Link href="/connexion" className="text-center text-xs text-white/70 hover:underline">Retour à la connexion</Link>
    </form>
  );
}

export function SetPasswordForm() {
  const [state, action, pending] = useActionState(setPassword, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        Nouveau mot de passe
        <input className={input} type="password" name="password" autoComplete="new-password" required minLength={10} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        Confirmer le mot de passe
        <input className={input} type="password" name="confirm" autoComplete="new-password" required />
      </label>
      <p className="text-xs text-white/60">10 caractères minimum, avec majuscule, minuscule et chiffre.</p>
      <Feedback state={state} />
      <Button type="submit" size="lg" disabled={pending}>Enregistrer</Button>
    </form>
  );
}
