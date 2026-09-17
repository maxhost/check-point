import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getMerchantAuth } from "../../../../server/auth";
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
const unauthorized = () =>
  NextResponse.json(
    { error: "No autorizado.", code: "unauthorized" },
    { status: 401 },
  );

export async function GET(request: Request) {
  const session = await getMerchantAuth().api.getSession({
    headers: request.headers,
  });
  if (!session) return unauthorized();
  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "png" ? "png" : "svg";
  const download = url.searchParams.get("download") === "1";
  try {
    const context = await programForOwner(session.user.id);
    if (!context) {
      return NextResponse.json(
        { error: "Sin negocio.", code: "not_owner" },
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
