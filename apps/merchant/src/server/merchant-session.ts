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
/**
 * Spec 0077 §3 — el segundo parámetro es EL PERMISO DE ALTA, y es EXPLÍCITO Y OPCIONAL a
 * propósito: el invariante de autorización de la spec es **quién lo pasa y quién no**.
 *
 * | Llamador | Permiso |
 * |---|---|
 * | `api/merchant/auth/start`, rama del email DESCONOCIDO (crea la cuenta) | SÍ, `now() + 60 min` |
 * | `api/merchant/auth/start`, rama del email conocido | no abre sesión: no aplica |
 * | `api/merchant/auth/staff` (login por PIN) | **NUNCA** |
 *
 * La firma real, medida en la fuente (better-auth 1.6.26,
 * `dist/db/internal-adapter.mjs:176-206`), es
 * `createSession(userId, dontRememberMe, override, overrideAll)`.
 *
 * **`overrideAll: true` es REDUNDANTE hoy, y se conserva a propósito.** La spec 0077 §3
 * afirmaba que `defaultAdditionalFields` pisa al `override` y que «por eso» hacía falta: es
 * FALSO, y lo cazó el revisor. `getSessionDefaultFields`
 * (`better-auth/dist/db/schema.mjs:141-146`) hace
 * `if (fields[key].defaultValue !== void 0)` — sólo emite campos **con `defaultValue`**, y
 * `onboardingGrantUntil` no tiene, así que sale `{}` y el `...rest` de la línea 193 sobrevive
 * solo. Se deja el `true` como defensa por si alguien le pone un `defaultValue` al campo.
 *
 * **Lo que el `true` SÍ cambia, y es el motivo de que el tipo del parámetro sea angosto:**
 * reubica `...rest` DESPUÉS de `expiresAt`, `userId`, `token`, `createdAt` y `updatedAt`
 * (línea 205), así que un llamador que trajera alguna de esas claves las pisaría. Hoy lo
 * impide `options: { onboardingGrantUntil?: Date }`. **Ese tipo no se relaja.**
 */
export async function openMerchantSession(
  userId: string,
  options: { onboardingGrantUntil?: Date } = {},
): Promise<string> {
  const ctx = await getMerchantAuth().$context;
  const session = await ctx.internalAdapter.createSession(
    userId,
    false,
    options.onboardingGrantUntil
      ? { onboardingGrantUntil: options.onboardingGrantUntil }
      : {},
    true,
  );
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
