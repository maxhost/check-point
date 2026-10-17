import { notFound, redirect } from "next/navigation";
import { requireBackofficeSession } from "../../../../../server/auth-guards";
import { readAnalyticsCustomer } from "../../../../../server/customers/analytics-detail";
import { Card, Link, PageHeader, Text } from "../../../../../ui";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireBackofficeSession();
  if (!session.membership.permissions.includes("counter"))
    redirect("/backoffice");
  const customer = await readAnalyticsCustomer(
    session.business.id,
    (await params).id,
  );
  if (!customer) notFound();
  const date = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat("es", { dateStyle: "medium" }).format(
          new Date(value),
        )
      : "Sin visitas";
  return (
    <main className="merchant-shell grid gap-6">
      <PageHeader
        title={customer.name}
        description="Cliente de tu negocio"
        actions={
          <Link href="/backoffice/customers">Ver todos los clientes</Link>
        }
      />
      <Card className="grid gap-4">
        <Text>Primera alta: {date(customer.enrolledAt)}.</Text>
        <Text>Última visita: {date(customer.lastVisitAt)}.</Text>
        <Link href="/backoffice">Volver al inicio</Link>
      </Card>
    </main>
  );
}
