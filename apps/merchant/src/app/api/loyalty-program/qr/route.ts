import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { apiOwnerFailureResponse } from "../../../../server/api-owner";
import { requireApiPermissionSinGateDeEmail } from "../../../../server/api-permission";
import { getDb } from "../../../../server/db";
import { businesses } from "../../../../server/schema";
import { programForOwner } from "../../../../server/loyalty-program";
import { enrollUrl } from "../../../../server/brand-kit/enroll-url";
import {
  renderEnrollQr,
  renderEnrollQrPng,
} from "../../../../server/brand-kit/qr";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Spec 0069 §D6 — el QR del programa, descargable.
 *
 * **El `programId` NUNCA sale del query ni del cuerpo**: lo resuelve
 * `programForOwner(session.user.id)`, igual que el slug del staff sale de la sesion
 * (ADR 0070 §15.3). Es lo unico que impide que un owner pida el QR del programa de otro
 * negocio — con un `?programId=` cualquiera podria armar el codigo de enrolamiento
 * ajeno y repartirlo.
 *
 * `?format=svg` (default) → `image/svg+xml`; `?format=png` → `image/png` 1024×1024.
 * `?download=1` agrega `content-disposition: attachment` con el slug del negocio, que
 * es lo que le permite al comerciante guardarlo en el telefono.
 *
 * QR **pelado**, sin poster: en el wizard todavia no hay ni color ni logo.
 */
export async function GET(request: Request) {
  // Spec 0075 — el guard **sin el paso 3**, y el nombre lo dice. Spec 0086: la escalera es
  // ahora la de permisos (sesion → membresia activa → alcance `loyalty` → eje `status`) y
  // pierde igual SOLO el paso 3. Esta
  // pantalla es la CUARTA del wizard (ADR 0070 §1) y la verificacion de email bloquea «todo
  // lo que venga DESPUES del wizard» (ADR 0070 §11): con el paso 3 puesto, una cuenta recien
  // creada —cuyo `email_verified` nace `false`— no podia ver el resultado de su propia alta.
  // La 0072 la habia barrido adentro de las 12 entradas gateadas porque nacio con la 0069,
  // DESPUES de que se censaran las superficies sin gate de email.
  const auth = await requireApiPermissionSinGateDeEmail(request, "loyalty", {
    missingPermission: "No tienes permiso para gestionar el programa.",
  });
  if ("failure" in auth) return apiOwnerFailureResponse(auth.failure);
  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "png" ? "png" : "svg";
  const download = url.searchParams.get("download") === "1";
  try {
    // Spec 0086 §10: el negocio sale del guard. Sin esto, un integrante con `loyalty` pasaba
    // la escalera y recibia el 403 `not_member` de la linea de abajo, que es la del
    // resolvedor owner-only y no la del guard.
    const context = await programForOwner(auth.userId, auth.business.id);
    if (!context) {
      return NextResponse.json(
        { error: "Sin negocio.", code: "not_member" },
        { status: 403 },
      );
    }
    if (!context.program) {
      return NextResponse.json(
        { error: "Todavía no tienes un programa.", code: "no_program" },
        { status: 404 },
      );
    }
    const [row] = await getDb()
      .select({ slug: businesses.slug })
      .from(businesses)
      .where(eq(businesses.id, context.business.id))
      .limit(1);
    const target = enrollUrl(url.origin, context.program.id);
    const headers: Record<string, string> = {
      "content-type": format === "png" ? "image/png" : "image/svg+xml",
      // El QR codifica una URL publica y estable, pero la respuesta depende de la
      // sesion: `private` evita que un proxy compartido la reparta.
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    };
    if (download) {
      headers["content-disposition"] =
        `attachment; filename="qr-${row?.slug ?? "negocio"}.${format}"`;
    }
    if (format === "png") {
      const png = await renderEnrollQrPng(target);
      return new NextResponse(new Uint8Array(png), { headers });
    }
    return new NextResponse(await renderEnrollQr(target), { headers });
  } catch {
    return NextResponse.json(
      { error: "No pudimos generar el código QR.", code: "qr_unavailable" },
      { status: 503 },
    );
  }
}
