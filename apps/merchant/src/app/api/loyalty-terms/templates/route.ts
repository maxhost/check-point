import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getMerchantAuth } from "../../../../server/auth";
import { getDb } from "../../../../server/db";
import { termsTemplates } from "../../../../server/schema";
import { ownerBusiness } from "../../../../server/loyalty-program";

export async function GET(request: Request) {
  const session = await getMerchantAuth().api.getSession({
    headers: request.headers,
  });
  if (!session)
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (!(await ownerBusiness(session.user.id)))
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
    .where(eq(termsTemplates.status, "published"));
  return NextResponse.json({ templates });
}
