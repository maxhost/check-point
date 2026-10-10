import { PageHeader } from "../../ui";
import { LoginForm } from "./login-form";

const ERRORS: Record<string, string> = {
  link_invalid: "El enlace venció o ya se usó. Pide otro.",
  not_admin: "Ese correo no tiene acceso al panel.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string }>;
}) {
  const { e } = await searchParams;
  return (
    <div className="mx-auto grid w-full max-w-md gap-6">
      <PageHeader
        title="Panel de plataforma"
        description="Te enviamos un enlace al correo para entrar."
      />
      <LoginForm error={e ? (ERRORS[e] ?? null) : null} />
    </div>
  );
}
