import { isStaffHost } from "@mi-pasaporte/domain/server/hosts";

// Depende del header `host` del request: no se puede prerenderizar.
export const dynamic = "force-dynamic";

/**
 * `robots.txt` POR HOST (spec 0218 / ADR 0140 §2). Una sola app sirve `business.`, `my.` y
 * `staff.`, asi que el archivo estatico de Next (`app/robots.txt`) no alcanza: el host del
 * equipo se prohibe entero y los demas quedan como hoy, que no tenian `robots.txt` (sin
 * archivo = todo permitido). El host se decide con `isStaffHost`, la misma regla que pone el
 * `X-Robots-Tag` en `proxy.ts`.
 */
export function GET(request: Request) {
  const staff = isStaffHost({
    host: request.headers.get("host"),
    staffOrigin: process.env.STAFF_ORIGIN,
    merchantOrigin: process.env.MERCHANT_ORIGIN,
    consumerOrigin: process.env.CONSUMER_ORIGIN,
  });
  return new Response(robotsTxt(staff), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

function robotsTxt(staff: boolean): string {
  return `User-agent: *\n${staff ? "Disallow: /" : "Allow: /"}\n`;
}
