import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { SignOutButton } from "../components/sign-out-button";
import { getMerchantAuth } from "../../server/auth";
import { getDb } from "../../server/db";
import { businesses, memberships, subscriptions } from "../../server/schema";

export const dynamic = "force-dynamic";

export default async function BackofficePage() {
  const session = await getMerchantAuth().api.getSession({
    headers: await headers(),
  });
  if (!session) redirect("/login");
  const [business] = await getDb()
    .select({
      id: businesses.id,
      name: businesses.name,
      plan: subscriptions.plan,
      status: subscriptions.status,
    })
    .from(memberships)
    .innerJoin(businesses, eq(businesses.id, memberships.businessId))
    .leftJoin(subscriptions, eq(subscriptions.businessId, businesses.id))
    .where(eq(memberships.userId, session.user.id))
    .orderBy(desc(businesses.createdAt))
    .limit(1);
  if (!business) redirect("/onboarding");

  const modules = [
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
