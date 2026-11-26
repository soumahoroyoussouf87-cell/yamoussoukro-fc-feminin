import { AuthShell } from "@/components/auth/auth-shell";
import { SetPasswordForm } from "@/components/auth/auth-forms";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Choisir un mot de passe" };

export default async function SetPasswordPage() {
  await requireUser();
  return (
    <AuthShell title="Choisir votre mot de passe">
      <SetPasswordForm />
    </AuthShell>
  );
}
