import { NextResponse, type NextRequest } from "next/server";
import {
  ConsumerError,
  SESSION_COOKIE,
  membershipResponse,
} from "@mi-pasaporte/domain/server/consumer/core";
import { enrollAccount } from "@mi-pasaporte/domain/server/consumer/enrollment";
import { resolveSession } from "@mi-pasaporte/domain/server/consumer/session";
import { issueWelcomeGiftsSafely } from "@mi-pasaporte/domain/server/marketing/welcome-issue";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Spec 0119 / ADR 0111 §7 — EL ALTA DE UN TOQUE: el cliente con sesion se suma a otro programa
 * («Sumarme como <nombre>»). Sin datos en el cuerpo: la cuenta es la de la sesion. La cookie de
 * sesion es `SameSite=Lax`, asi que un POST de otro sitio no la lleva y el toque no se puede
 * forzar desde afuera. Sin sesion → 401 sin escribir nada. El cuerpo solo trae `loc` (ADR 0042).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> },
) {
  const { programId } = await params;
  const account = await resolveSession(
    request.cookies.get(SESSION_COOKIE)?.value,
  );
  if (!account) {
    return NextResponse.json(
      { error: "No autorizado.", code: "unauthenticated" },
      { status: 401 },
    );
  }
  let body: unknown = {};
  const text = await request.text().catch(() => "");
  if (text.trim()) {
    try {
      body = JSON.parse(text);
    } catch {
      return NextResponse.json(
        {
          error: "El cuerpo de la solicitud no es válido.",
          code: "invalid_body",
        },
        { status: 400 },
      );
    }
  }
  const bodyLoc = (body as { loc?: unknown } | null)?.loc;
  const loc =
    typeof bodyLoc === "string"
      ? bodyLoc
      : request.nextUrl.searchParams.get("loc");
  try {
    const membership = await enrollAccount(programId, account.id, loc);
    // Spec 0107: un cliente con el pase YA instalado (de otro negocio) recibe la Bienvenida
    // ahora; best-effort, nunca cambia esta respuesta.
    await issueWelcomeGiftsSafely(account.id);
    return NextResponse.json(
      { membership: membershipResponse(membership) },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ConsumerError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { error: "No pudimos completar el enrolamiento.", code: "enroll_failed" },
      { status: 503 },
    );
  }
}
