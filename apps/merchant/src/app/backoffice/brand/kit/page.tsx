import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getMerchantAuth } from "../../../../server/auth";
import { getDb } from "../../../../server/db";
import { businesses, memberships } from "../../../../server/schema";
import { getBrandKitData } from "../../../../server/brand-kit/data";
import { ModuleHeader } from "../../../components/ui";
import { BrandKitWizard } from "./brand-kit-wizard";

export const dynamic = "force-dynamic";

export default async function BrandKitPage() {
  const headerList = await headers();
  const session = await getMerchantAuth().api.getSession({ headers: headerList });
  if (!session) redirect("/login");

  const [business] = await getDb()
    .select({ id: businesses.id })
    .from(memberships)
    .innerJoin(businesses, eq(businesses.id, memberships.businessId))
    .where(eq(memberships.userId, session.user.id))
    .orderBy(asc(businesses.createdAt))
    .limit(1);
  if (!business) redirect("/onboarding");

  // Absolute origin for the poster QR (the code must encode an absolute enroll URL).
  // Derived from the request — there is no env-based URL helper in this repo.
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "";
  const proto = headerList.get("x-forwarded-proto") ?? "https";
  const origin = `${proto}://${host}`;

  const data = await getBrandKitData(business.id, origin);

  if (data.status === "no_program") {
    return (
      <main className="merchant-shell">
        <div className="brand-kit">
          <ModuleHeader
            eyebrow="Marca"
            title="Afiche de enrolamiento"
            description="Generá el afiche imprimible con el QR para sumar clientes."
            closeHref="/backoffice/brand"
          />
          <div className="brand-kit-block">
            <h2>Todavía no tenés un programa</h2>
            <p>
              Creá tu programa de fidelización antes de generar el afiche: el QR necesita
              un programa al que sumar a tus clientes.
            </p>
            <a className="brand-kit-block-cta" href="/backoffice/loyalty">
              Ir a Fidelización
            </a>
          </div>
        </div>
      </main>
    );
  }

  return <BrandKitWizard data={data} />;
}
