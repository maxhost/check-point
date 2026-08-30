import Link from "next/link";
import { eq } from "drizzle-orm";
import { SignOutButton } from "../components/sign-out-button";
import { requireOwner } from "../../server/auth-guards";
import { getDb } from "../../server/db";
import { subscriptions } from "../../server/schema";

export const dynamic = "force-dynamic";

export default async function BackofficePage() {
  // Owner-only home (ADR 0044): a staff member is redirected to the counter console.
  const { business: owned } = await requireOwner();
  const [subscription] = await getDb()
    .select({ plan: subscriptions.plan, status: subscriptions.status })
    .from(subscriptions)
    .where(eq(subscriptions.businessId, owned.id))
    .limit(1);
  const business = {
    id: owned.id,
    name: owned.name,
    plan: subscription?.plan ?? "free",
    status: subscription?.status ?? "active",
  };

  const modules = [
    ["Mostrador", "Escanea el QR del cliente y acredita su compra.", "counter"],
    [
      "Campañas",
      "Crea beneficios y experiencias para tus clientes.",
      "campaigns",
    ],
    [
      "Programa de fidelización",
      "Configura puntos o sellos para tus visitantes.",
      "loyalty",
    ],
    ["Catálogo", "Declara los productos que vende tu negocio.", "catalog"],
    ["Locales", "Gestiona las sucursales de tu negocio.", "locations"],
    ["Staff", "Organiza el equipo que opera tus locales.", "staff"],
    ["Marca", "Personaliza cómo se ve tu negocio.", "brand"],
    ["Analíticas", "Entiende visitas, beneficios y actividad.", "analytics"],
  ];
  return (
    <main className="merchant-shell">
      <div className="backoffice-home">
        <header className="owner-header">
          <div>
            <p className="eyebrow">Backoffice</p>
            <h1>{business.name}</h1>
            <p>
              Plan {business.plan === "plus" ? "Plus" : "Free"} ·{" "}
              {business.status === "active" ? "activo" : "confirmando pago"}
            </p>
          </div>
          <SignOutButton />
        </header>
        <section className="active-campaign">
          <p className="eyebrow">Siguiente paso</p>
          <h2>Configura tu programa de fidelización</h2>
          <p>Con Free puedes empezar a premiar visitas en tu primer local.</p>
          <Link href="/backoffice/loyalty">Configurar programa →</Link>
        </section>
        <section className="owner-modules">
          <h2>Gestiona tu negocio</h2>
          <div className="module-grid">
            {modules.map(([title, description, slug]) => (
              <Link
                className="module-card"
                href={
                  slug === "loyalty"
                    ? "/backoffice/loyalty"
                    : slug === "brand"
                      ? "/backoffice/brand"
                      : slug === "catalog"
                        ? "/backoffice/catalog"
                        : slug === "counter"
                          ? "/backoffice/counter"
                          : slug === "staff"
                            ? "/backoffice/staff"
                            : `/backoffice/demo/${slug}`
                }
                key={slug}
              >
                <strong>{title}</strong>
                <span>{description}</span>
                <small>Ver sección →</small>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
