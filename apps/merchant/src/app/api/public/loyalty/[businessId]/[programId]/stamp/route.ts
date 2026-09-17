import { NextResponse } from "next/server";
import {
  getPrivateObject,
  objectBodyToWebStream,
} from "../../../../../../../server/r2";
import { stampForPublicProgram } from "../../../../../../../server/loyalty-program";
import { stampPlaceholderPng } from "../../../../../../../server/loyalty-program/stamp-placeholder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Lectura publica del sello de un programa.
 *
 * **Invariante que no se negocia (spec 0069 §D5): esta ruta NUNCA serializa
 * `stampImageObjectKey`.** Devuelve bytes de imagen, y la unica forma de que la clave
 * interna de R2 se escapara seria meterla en un header o en un cuerpo JSON de error.
 * No hay ninguno: el error es un 404 con cuerpo `null`.
 *
 * Tres desenlaces, y los tres son contrato:
 *  - sello vigente → los bytes de R2 (`webp` si el cliente lo acepta, si no `png`);
 *  - programa **sin** sello y `v` vigente → el PLACEHOLDER (`image/png`), generado en
 *    servidor con la inicial del negocio;
 *  - **version que no matchea** (con sello o sin el), programa inexistente, o un id que
 *    no es uuid → **404**. El placeholder NO tapa una version vieja: un sello real
 *    recien subido no puede verse reemplazado por una letra.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ businessId: string; programId: string }> },
) {
  const { businessId, programId } = await params;
  const version = new URL(request.url).searchParams.get("v");
  const webp = request.headers.get("accept")?.includes("image/webp") ?? false;
  try {
    // Inside the try so a regex-valid-but-invalid uuid (Postgres 22P02) is a 404.
    const resolved = await stampForPublicProgram(
      businessId,
      programId,
      version,
    );
    if (!resolved) return new NextResponse(null, { status: 404 });
    if (resolved.kind === "placeholder") {
      const png = await stampPlaceholderPng(resolved.businessName);
      return new NextResponse(new Uint8Array(png), {
        headers: {
          "content-type": "image/png",
          // Mismo cache que el sello real: el path lleva `?v=` y una subida posterior
          // incrementa la version, o sea que esta URL nunca cambia de contenido.
          "cache-control": "public, max-age=31536000, immutable",
          "x-content-type-options": "nosniff",
        },
      });
    }
    const object = await getPrivateObject(
      `${resolved.objectKey}/stamp.${webp ? "webp" : "png"}`,
    );
    return new NextResponse(
      objectBodyToWebStream(object.Body as AsyncIterable<Uint8Array>),
      {
        headers: {
          "content-type": webp ? "image/webp" : "image/png",
          "cache-control": "public, max-age=31536000, immutable",
          "x-content-type-options": "nosniff",
        },
      },
    );
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
