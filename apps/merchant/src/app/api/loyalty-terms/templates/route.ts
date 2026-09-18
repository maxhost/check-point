import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import {
  apiOwnerFailureResponse,
  requireApiOwner,
} from "../../../../server/api-owner";
import { getDb } from "../../../../server/db";
import { termsTemplates } from "../../../../server/schema";

/** Spec 0072 §D3: el guard es `requireApiOwner`, no el resolvedor ad hoc del dominio — que
 * no filtraba `memberships.status='active'` ni miraba el email verificado. */
export async function GET(request: Request) {
  const auth = await requireApiOwner(request, {
    notOwner: "Solo el owner puede ver las plantillas.",
    emailNotVerified: "Verificá tu email para ver las plantillas.",
  });
  if ("failure" in auth) return apiOwnerFailureResponse(auth.failure);
  const templates = await getDb()
    .select({
      id: termsTemplates.id,
      title: termsTemplates.title,
      category: termsTemplates.category,
      templateMarkdown: termsTemplates.templateMarkdown,
      version: termsTemplates.version,
    })
    .from(termsTemplates)
    .where(eq(termsTemplates.status, "published"));
  return NextResponse.json({ templates });
}
