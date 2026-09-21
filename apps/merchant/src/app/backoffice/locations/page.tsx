import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { requireBackofficeSession } from "../../../server/auth-guards";
import { getDb } from "../../../server/db";
import { businesses, subscriptions } from "../../../server/schema";
import {
  effectiveLocationLimit,
  listLocations,
} from "../../../server/locations";
import { LocationsConsole } from "./locations-console";

export const dynamic = "force-dynamic";

/**
 * **Gateada por el PERMISO `locations`, no por el rol** — enmienda de la spec 0061 §4, que la
 * hacia owner-only. La API ya delega estas cuatro rutas desde la spec 0086
 * (`api/locations/_auth.ts` → `requireApiPermission(request, "locations")`, decision del owner
 * en el ADR 0079 §2), asi que con la pantalla cerrada el permiso estaba **vivo en la API y
 * muerto en el producto**: un integrante con `locations` no tenia por donde ejercerlo.
 *
 * El owner entra siempre: `permissionsForRole` le devuelve los siete aunque su fila este vacia
 * (`auth-guards.ts:202`). Misma forma que `backoffice/staff/page.tsx`, y con el mismo oraculo.
 */
export default async function LocationsPage() {
  const session = await requireBackofficeSession();
  if (!session.membership.permissions.includes("locations"))
    redirect("/backoffice");
  const business = session.business;

  const [row] = await getDb()
    .select({
      countryCode: businesses.countryCode,
      plan: subscriptions.plan,
      pendingPlan: subscriptions.pendingPlan,
    })
    .from(businesses)
    .leftJoin(subscriptions, eq(subscriptions.businessId, businesses.id))
    .where(eq(businesses.id, business.id))
    .limit(1);

  return (
    <LocationsConsole
      initialLocations={await listLocations(business.id)}
      countryCode={row?.countryCode ?? "EC"}
      // Advisory only: it decides whether the "add" button is rendered. The cap that
      // holds is `createLocation`'s, under the business row lock. Spec 0063, D2: es el
      // tope EFECTIVO — con una baja ya programada el número que se muestra es el del plan
      // destino, no el del plan vigente.
      activeLimit={effectiveLocationLimit(row?.plan, row?.pendingPlan)}
    />
  );
}
