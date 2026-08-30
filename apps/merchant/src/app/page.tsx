import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getMerchantAuth } from "../server/auth";

export const dynamic = "force-dynamic";

export default async function MerchantEntryPage() {
  const session = await getMerchantAuth().api.getSession({
    headers: await headers(),
  });
  // A logged-in owner goes straight to the backoffice; everyone else sees the landing.
  if (session) redirect("/backoffice");

  // Minimal landing — structure only, no visual design yet (spec 0045). Two actions:
  // access (login) and create a business (registration wizard).
  return (
    <main className="merchant-shell">
      <section className="panel login-panel">
        <p className="eyebrow">CheckPass Club · Negocios</p>
        <h1>Fidelización simple para tu negocio</h1>
        <p>
          Sumá clientes con tu programa de puntos o sellos, acreditá desde el mostrador
          y llegá a tus clientes por su billetera.
        </p>
        <Link className="button" href="/login">
          Acceder
        </Link>
        <p>
          ¿Aún no tienes cuenta? <Link href="/onboarding">Crea tu negocio</Link>.
        </p>
      </section>
    </main>
  );
}
