import { and, eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getMerchantAuth } from "../../../../server/auth";
import { getDb } from "../../../../server/db";
import { ownerBusiness } from "../../../../server/loyalty-program";
import { termsTemplates } from "../../../../server/schema";

export async function GET(request: Request) {
  const session = await getMerchantAuth().api.getSession({
    headers: request.headers,
  });
  if (!session)
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const business = await ownerBusiness(session.user.id);
  if (!business)
    return NextResponse.json({ error: "Sin negocio." }, { status: 403 });
  const templates = await getDb()
    .select({
      id: termsTemplates.id,
      title: termsTemplates.title,
      category: termsTemplates.category,
      templateMarkdown: termsTemplates.templateMarkdown,
      version: termsTemplates.version,
    })
    .from(termsTemplates)
    .where(
      and(
        eq(termsTemplates.status, "published"),
        or(
          eq(termsTemplates.jurisdictionScope, "global-draft"),
          eq(termsTemplates.jurisdictionScope, business.countryCode),
        ),
      ),
    );
  return NextResponse.json({ templates });
}
