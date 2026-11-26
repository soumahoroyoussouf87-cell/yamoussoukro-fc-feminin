import { AuthShell } from "@/components/auth/auth-shell";
import { ResetRequestForm } from "@/components/auth/auth-forms";

export const metadata = { title: "Mot de passe oublié" };

export default function ForgotPage() {
  return (
    <AuthShell title="Mot de passe oublié">
      <ResetRequestForm />
    </AuthShell>
  );
}
