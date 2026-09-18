import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { getMerchantAuth } from "../../../../server/auth";
import { getDb } from "../../../../server/db";
import {
  businesses,
  loyaltyPrograms,
  memberships,
} from "../../../../server/schema";
import {
  NOT_AUTHENTICATED,
  toOnboardingView,
} from "../../../../server/session-view";

export const dynamic = "force-dynamic";

/**
 * Spec 0074 §D3 — `GET /api/onboarding/state`, RETOMAR EL WIZARD.
 *
 * **Lleva sesion pero NO lleva el gate de email, a proposito, y es precedente ya
 * establecido:** el wizard corre ANTES de la verificacion (ADR 0070 §11), que es exactamente
 * por lo que `POST /api/onboarding/program` tampoco lo lleva (0072, cierre de F1). Un gate de
 * email aca volveria irretomable el unico flujo que ocurre antes de verificar. Es la
 * mutacion M5.
 *
 * **Devuelve HECHOS, nunca un numero de paso** — ver {@link toOnboardingView}.
 *
 * **Alcance minimo a proposito:** es «que falta para terminar el alta», NO el checklist del
 * negocio derivado del ADR 0070 §9 (logo, colores, costos, staff, wallet), que esta diferido
 * con seis decisiones del owner abiertas. Los tres hechos de aca si son derivables sin
 * ambiguedad y sin migracion.
 */
export async function GET(request: Request) {
  const session = await getMerchantAuth().api.getSession({
    headers: request.headers,
  });
  if (!session) return NextResponse.json(NOT_AUTHENTICATED);

  // El MISMO `orderBy(asc(...))` + `limit(1)` que `/api/merchant/session` y que
  // `requireBackofficeSession`: las tres superficies tienen que resolver el mismo negocio.
  const [row] = await getDb()
    .select({
      id: businesses.id,
      name: businesses.name,
      slug: businesses.slug,
      membershipStatus: memberships.status,
    })
    .from(memberships)
    .innerJoin(businesses, eq(businesses.id, memberships.businessId))
    .where(eq(memberships.userId, session.user.id))
    .orderBy(asc(businesses.createdAt))
    .limit(1);

  const business = row && row.membershipStatus === "active" ? row : null;
  if (!business) return NextResponse.json(toOnboardingView(null, null));

  // Sin negocio no se consulta el programa: no hay `business_id` con el que preguntar, y una
  // consulta de mas en la sonda que la UI llama en cada carga del wizard no es gratis.
  //
  // `asc(createdAt)`: la spec 0074 adopta el orden ascendente de las cuatro superficies que
  // ya lo usan. La divergencia con el `desc` de `loyalty-program.ts:66` quedo DECLARADA en la
  // 0072 §D3 y sigue abierta; hoy es inalcanzable (un programa por negocio) y cerrarla toca
  // archivos que no estan en la tabla de esta spec.
  const [program] = await getDb()
    .select({
      id: loyaltyPrograms.id,
      kind: loyaltyPrograms.kind,
      stampImageObjectKey: loyaltyPrograms.stampImageObjectKey,
    })
    .from(loyaltyPrograms)
    .where(eq(loyaltyPrograms.businessId, business.id))
    .orderBy(asc(loyaltyPrograms.createdAt))
    .limit(1);

  return NextResponse.json(toOnboardingView(business, program));
}
