import { makeSignature } from "better-auth/crypto";
import { getMerchantAuth } from "./auth";

/**
 * Spec 0067 — abrir una sesion de `merchant_auth` para un `user_id` que el servidor YA
 * autentico por su cuenta.
 *
 * Por que existe: el staff entra con `handle@slug` + PIN (spec §4) y **no tiene
 * contraseña**, asi que no hay ningun endpoint de better-auth al que delegarle el login
 * (`signInEmail` pide una contraseña que nadie tiene, y el paso 3 apaga `emailAndPassword`
 * entero). El link magico del owner —paso 3— va a necesitar exactamente lo mismo.
 *
 * Lo que NO se reimplementa: la sesion la crea `internalAdapter.createSession`, o sea la
 * misma funcion que usa `/sign-in/email` (better-auth 1.6.26,
 * `dist/db/internal-adapter.mjs:176`), con el mismo `expiresAt` y el mismo token. El
 * nombre y los atributos de la cookie salen de `ctx.authCookies.sessionToken` — no se
 * eligen aca.
 *
 * Lo unico propio es serializar la cookie, porque `setSessionCookie` exige un
 * `GenericEndpointContext` de better-call que solo existe adentro de un endpoint de
 * better-auth, y esta es una ruta de Next. El formato se copia de la fuente medida:
 *
 * - firma: `makeSignature` de `better-auth/crypto` — HMAC-SHA256 + base64, **identica**
 *   byte a byte a la de `better-call/dist/crypto.mjs`, que es la que verifica
 *   `ctx.getSignedCookie` al leerla;
 * - valor: `encodeURIComponent("<token>.<firma>")`, tal cual `signCookieValue`;
 * - atributos: los de `ctx.authCookies.sessionToken.attributes`, sin reinterpretarlos.
 *
 * **El oraculo de que esto es correcto no es este docblock**: es la ida y vuelta completa
 * contra Neon en `staff-pin.neon.integration.test.ts` — se abre la sesion, la cookie viaja
 * en un `Request` y `auth.api.getSession` tiene que devolver al usuario. Si una version de
 * better-auth cambia el esquema de firma, ese test se pone rojo.
 */
export async function openMerchantSession(userId: string): Promise<string> {
  const ctx = await getMerchantAuth().$context;
  const session = await ctx.internalAdapter.createSession(userId, false);
  const { name, attributes } = ctx.authCookies.sessionToken;
  const signature = await makeSignature(session.token, ctx.secret);
  const value = encodeURIComponent(`${session.token}.${signature}`);
  return serializeCookie(name, value, attributes);
}

type CookieAttributes = {
  domain?: string;
  expires?: Date;
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None" | "strict" | "lax" | "none";
  partitioned?: boolean;
};

/** Mismo orden y mismas reglas que `_serialize` de better-call (`dist/cookies.mjs:42`). */
function serializeCookie(
  name: string,
  value: string,
  attributes: CookieAttributes,
): string {
  const parts = [`${name}=${value}`];
  if (typeof attributes.maxAge === "number" && attributes.maxAge >= 0) {
    parts.push(`Max-Age=${Math.floor(attributes.maxAge)}`);
  }
  if (attributes.domain) parts.push(`Domain=${attributes.domain}`);
  if (attributes.path) parts.push(`Path=${attributes.path}`);
  if (attributes.expires)
    parts.push(`Expires=${attributes.expires.toUTCString()}`);
  if (attributes.httpOnly) parts.push("HttpOnly");
  if (attributes.secure) parts.push("Secure");
  if (attributes.sameSite) {
    const value = attributes.sameSite;
    parts.push(`SameSite=${value.charAt(0).toUpperCase()}${value.slice(1)}`);
  }
  if (attributes.partitioned) parts.push("Partitioned");
  return parts.join("; ");
}
