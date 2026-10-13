import { redirect } from "next/navigation";
import { requireBackofficeSession } from "../../../server/auth-guards";
import { Card, PageHeader, Text } from "../../../ui";

export const dynamic = "force-dynamic";

export default async function RecipesPage() {
  const session = await requireBackofficeSession();
  if (!session.membership.permissions.includes("catalog"))
    redirect("/backoffice");
  return (
    <main className="merchant-shell">
      <div className="backoffice-home grid gap-6">
        <PageHeader title="Recetas" />
        <Card>
          <Text variant="muted">
            Aquí podrás consultar las recetas de tus productos. Estamos
            preparando esta pantalla.
          </Text>
        </Card>
      </div>
    </main>
  );
}
