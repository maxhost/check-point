import tzlookup from "@photostructure/tz-lookup";
import { isIanaTimezone } from "@mi-pasaporte/domain/server/timezone";

/**
 * Spec 0155 / ADR 0121 §7 — la zona IANA del negocio sale de las COORDENADAS del lugar,
 * offline (`@photostructure/tz-lookup`, CC0, sin dependencias). Sin Time Zone API de Google
 * y sin el `Intl` del navegador, que daba la zona de quien tipea, no la del local.
 *
 * Si la libreria devuelve algo que `Intl` no acepta (o tira por coordenadas invalidas), el
 * alta no inventa una zona: lanza, y la ruta responde 503.
 */
export function timezoneFor(latitude: number, longitude: number): string {
  const zone = tzlookup(latitude, longitude);
  if (!isIanaTimezone(zone)) {
    throw new Error("La zona horaria del lugar no es valida.");
  }
  return zone;
}
