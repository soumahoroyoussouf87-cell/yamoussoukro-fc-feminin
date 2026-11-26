import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage({ searchParams }: PageProps<"/connexion">) {
  const sp = await searchParams;
  const suite = typeof sp.suite === "string" ? sp.suite : undefined;
  return (
    <AuthShell title="Connexion sécurisée">
      <SignInForm suite={suite} linkError={sp.erreur === "lien"} />
    </AuthShell>
  );
}
