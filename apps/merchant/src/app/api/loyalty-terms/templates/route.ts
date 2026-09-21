import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiOwnerFailureResponse } from "../../../../server/api-owner";
import { requireApiPermission } from "../../../../server/api-permission";
import { getDb } from "../../../../server/db";
import { termsScopeCandidates } from "../../../../server/loyalty-program/terms-scope";
import { termsTemplates } from "../../../../server/schema";

/** Spec 0072 §D3: el guard es el unico, no el resolvedor ad hoc del dominio — que no
 * filtraba `memberships.status='active'` ni miraba el email verificado.
 * **Spec 0086 §3: es `requireApiPermission` con el alcance `loyalty`**, y el `countryCode`
 * sigue saliendo de la MISMA fila que evaluo el guard.
 *
 * **Spec 0081 §4 — solo los scopes candidatos del negocio de la sesion, y el scope viaja en
 * el DTO.** Antes devolvia TODAS las publicadas: seis filas con titulos repetidos («Cómo se
 * acumula» ×3) y **sin forma de distinguirlas**, asi que un panel construido sobre ese
 * contrato podia escribirle a un comercio EC el texto deprecado de `global-draft`. El pais
 * sale de la MISMA fila que evaluo el guard (`auth.business`), no de un segundo resolvedor:
 * gatear con uno y filtrar con otro es la divergencia `asc`/`desc` que la 0072 §D3 declara
 * abierta.
 *
 * Su guard y sus `code` **no cambian** (declarado afuera, como la 0079 hizo con
 * `GET`/`DELETE`/`PATCH` del programa). */
export async function GET(request: Request) {
  const auth = await requireApiPermission(request, "loyalty", {
    missingPermission: "No tienes permiso para ver las plantillas.",
    emailNotVerified: "Verificá tu email para ver las plantillas.",
  });
  if ("failure" in auth) return apiOwnerFailureResponse(auth.failure);
  const templates = await getDb()
    .select({
      id: termsTemplates.id,
      title: termsTemplates.title,
      category: termsTemplates.category,
      jurisdictionScope: termsTemplates.jurisdictionScope,
      templateMarkdown: termsTemplates.templateMarkdown,
      version: termsTemplates.version,
    })
    .from(termsTemplates)
    .where(
      and(
        eq(termsTemplates.status, "published"),
        inArray(
          termsTemplates.jurisdictionScope,
          termsScopeCandidates(auth.business.countryCode),
        ),
      ),
    );
  return NextResponse.json({ templates });
}
