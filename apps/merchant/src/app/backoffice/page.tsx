import { billingPlanName } from "./subscription/billing-state";
import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import {
  ArrowRight,
  CreditCard,
  Gift,
  Group,
  Megaphone,
  Package,
  Palette,
  Shop,
} from "iconoir-react";
import { requireBackofficeSession } from "../../server/auth-guards";
import { statusLabel } from "../../server/billing";
import { getDb } from "@mi-pasaporte/db";
import { subscriptions } from "@mi-pasaporte/db/schema";

import { AnalyticsInbox } from "./analytics/inbox";

export const dynamic = "force-dynamic";

const businessItems = [
  {
    title: "Marca",
    description: "Logo, colores y datos de tu negocio",
    href: "/backoffice/brand",
    icon: Palette,
  },
  {
    title: "Locales",
    description: "Direcciones y sucursales",
    href: "/backoffice/locations",
    icon: Shop,
  },
  {
    title: "Equipo",
    description: "Las personas que atienden contigo",
    href: null,
    icon: Group,
  },
  {
    title: "Catálogo",
    description: "Los productos que vendes",
    href: "/backoffice/catalog",
    icon: Package,
  },
];

const loyaltyItems = [
  {
    title: "Programa de fidelización",
    description: "Define cómo premias a tus clientes",
    href: "/backoffice/loyalty",
    icon: Gift,
  },
  {
    title: "Campañas",
    description: "Crea motivos para que vuelvan",
    href: "/backoffice/marketing",
    icon: Megaphone,
  },
];

function SectionItem({
  item,
}: {
  item: (typeof businessItems)[number] | (typeof loyaltyItems)[number];
}) {
  const Icon = item.icon;
  const content = (
    <>
      <span className="dashboard-item-icon">
        <Icon aria-hidden="true" width={23} height={23} strokeWidth={1.7} />
      </span>
      <span className="dashboard-item-copy">
        <strong>{item.title}</strong>
        <small>{item.description}</small>
      </span>
      {item.href ? (
        <ArrowRight aria-hidden="true" width={20} height={20} />
      ) : (
        <em>Próximamente</em>
      )}
    </>
  );

  return item.href ? (
    <Link className="dashboard-section-item" href={item.href}>
      {content}
    </Link>
  ) : (
    <div className="dashboard-section-item is-disabled" aria-disabled="true">
      {content}
    </div>
  );
}

export default async function BackofficePage() {
  const {
    business: owned,
    userName,
    membership,
  } = await requireBackofficeSession();
  const isOwner = membership.role === "owner";
  if (!isOwner && !membership.permissions.includes("analytics"))
    redirect("/backoffice/counter");
  const [subscription] = await getDb()
    .select({ plan: subscriptions.plan, status: subscriptions.status })
    .from(subscriptions)
    .where(eq(subscriptions.businessId, owned.id))
    .limit(1);
  const plan = subscription?.plan ?? "none";
  const status = subscription?.status ?? "active";
  const firstName = userName.trim().split(/\s+/)[0];
  const greeting = firstName ? `Hola, ${firstName}` : "Hola";

  return (
    <main className="merchant-shell dashboard-home">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Inicio</p>
          <h1>{greeting}</h1>
          <p>Este es el espacio de {owned.name}.</p>
        </div>
        {isOwner && (
          <Link className="dashboard-plan" href="/backoffice/subscription">
            <CreditCard aria-hidden="true" width={18} height={18} />
            <span>{billingPlanName(plan)}</span>
            <small>{statusLabel(status)}</small>
          </Link>
        )}
      </header>

      {membership.permissions.includes("analytics") && <AnalyticsInbox />}

      {isOwner && (
        <div className="dashboard-groups">
          <section
            className="dashboard-section"
            aria-labelledby="business-section-title"
          >
            <header>
              <div>
                <p className="eyebrow">Tu espacio</p>
                <h2 id="business-section-title">Mi negocio</h2>
              </div>
              <p>Todo lo que tus clientes ven y tu equipo necesita.</p>
            </header>
            <div className="dashboard-section-list">
              {businessItems.map((item) => (
                <SectionItem item={item} key={item.title} />
              ))}
            </div>
          </section>

          <section
            className="dashboard-section loyalty"
            aria-labelledby="loyalty-section-title"
          >
            <header>
              <div>
                <p className="eyebrow">Haz que vuelvan</p>
                <h2 id="loyalty-section-title">Fidelización</h2>
              </div>
              <p>Premia a tus clientes y mantén viva la relación.</p>
            </header>
            <div className="dashboard-section-list">
              {loyaltyItems.map((item) => (
                <SectionItem item={item} key={item.title} />
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
