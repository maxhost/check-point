import Link from "next/link";
import { eq } from "drizzle-orm";
import { SignOutButton } from "../components/sign-out-button";
import { requireOwner } from "../../server/auth-guards";
import { planLabel, statusLabel } from "../../server/billing";
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

  // Modules with a REAL screen, and WHERE it lives. Anything not listed here still falls
  // back to the sessionStorage mock of spec 0015 (`/backoffice/demo/<slug>`) — today only
  // `analytics`. `locations` left that list in spec 0061, `subscription` in spec 0063,
  // `campaigns` in spec 0065 (B3), and the spec 0017 mock is superseded.
  //
  // It is a Map and no longer a Set because for the first time a slug and its path
  // DISAGREE: the tile is «Campañas» / `campaigns` and the section the spec asks for is
  // `/backoffice/marketing`. DECISION OF THE ORCHESTRATOR, not the owner: the path
  // moves, the slug stays. Renaming the slug instead would touch the demo route, its
  // sessionStorage key and the mock screens of spec 0015 for a cosmetic win.
  const realModules = new Map([
    ["counter", "/backoffice/counter"],
    ["loyalty", "/backoffice/loyalty"],
    ["catalog", "/backoffice/catalog"],
    ["locations", "/backoffice/locations"],
    ["staff", "/backoffice/staff"],
    ["brand", "/backoffice/brand"],
    ["subscription", "/backoffice/subscription"],
    ["campaigns", "/backoffice/marketing"],
  ]);
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
    [
      "Suscripción",
      "Tu plan, el período de facturación y los locales incluidos.",
      "subscription",
    ],
  ];
  return (
    <main className="merchant-shell">
      <div className="backoffice-home">
        <header className="owner-header">
          <div>
            <p className="eyebrow">Backoffice</p>
            <h1>{business.name}</h1>
            {/* Spec 0063, D7 — POR LA ALLOW-LIST COMPARTIDA (`server/billing/view.ts`), no
                por dos ternarios. Los dos que había mentían de formas que esta spec crea:
                `plan === "plus" ? "Plus" : "Free"` mostraba `none` como «Plan Free» —justo
                lo que `none` existe para no hacer (ADR 0058 §12)— y
                `status === "active" ? … : "confirmando pago"` decía «confirmando pago»
                PARA SIEMPRE sobre un `free` con `status='canceled'`. Se cae el prefijo
                «Plan» a propósito: con él, `none` leería «Plan Sin plan». */}
            <p>
              {planLabel(business.plan)} · {statusLabel(business.status)}
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
                href={realModules.get(slug) ?? `/backoffice/demo/${slug}`}
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
