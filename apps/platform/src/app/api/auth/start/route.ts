import { NextResponse } from "next/server";
import { and, gt, sql } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { platformVerifications } from "@mi-pasaporte/db/schema";
import { EmailProviderError } from "@mi-pasaporte/domain/server/email/channel";
import { isAdminEmail } from "../../../../server/admin-emails";
import { getPlatformAuth } from "../../../../server/auth";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Un link por correo cada 60 s (spec 0190 §D2). */
const RESEND_WINDOW_MS = 60_000;

/**
 * POST /api/auth/start `{ email }` — pide el link del panel. La respuesta es la MISMA para un
 * correo de la lista y uno de afuera (no revela quien es admin); solo al de la lista le llega
 * el mail.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
  } | null;
  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { code: "invalid_email", message: "Escribe un correo válido." },
      { status: 400 },
    );
  }
  if (!isAdminEmail(email) || (await sentRecently(email))) {
    return NextResponse.json({ ok: true });
  }
  try {
    await getPlatformAuth().api.signInMagicLink({
      body: { email },
      headers: request.headers,
    });
  } catch (error) {
    if (error instanceof EmailProviderError || isWrappedProviderError(error)) {
      return NextResponse.json(
        {
          code: "email_unavailable",
          message: "No pudimos enviar el correo. Prueba en un rato.",
        },
        { status: 503 },
      );
    }
    throw error;
  }
  return NextResponse.json({ ok: true });
}

/** El plugin guarda `value = {"email": …}` (better-auth 1.7.6, `plugins/magic-link`). */
async function sentRecently(email: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: platformVerifications.id })
    .from(platformVerifications)
    .where(
      and(
        sql`(${platformVerifications.value}::jsonb ->> 'email') = ${email}`,
        gt(
          platformVerifications.createdAt,
          new Date(Date.now() - RESEND_WINDOW_MS),
        ),
      ),
    )
    .limit(1);
  return row !== undefined;
}

function isWrappedProviderError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "EmailProviderError" ||
      (error.cause instanceof Error &&
        error.cause.name === "EmailProviderError"))
  );
}
