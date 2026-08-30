import Link from "next/link";
import { recoveryEnabled } from "../../server/recovery/merchant-recovery";
import { ForgotForm } from "./forgot-form";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  // Same gate as the API routes: with the feature off the page stays dark on
  // purpose, so an unconfigured deploy never shows a form that cannot work.
  if (!recoveryEnabled())
    return (
      <main className="merchant-shell">
        <section className="panel login-panel">
          <p className="eyebrow">CheckPass Club · Negocios</p>
          <h1>Recuperación no disponible</h1>
          <p>
            La recuperación de contraseña no está habilitada. Escribinos para
            que te ayudemos a recuperar el acceso.
          </p>
          <p>
            <Link href="/login">Volver a iniciar sesión</Link>
          </p>
        </section>
      </main>
    );
  return <ForgotForm />;
}
