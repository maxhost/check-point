/**
 * Spec 0067 §1 — el slug del negocio. Modulo **PURO**: no importa la base ni la sesion,
 * y por eso se puede probar sin Neon (protocolo de verificacion §3: si la propiedad es de
 * comportamiento, se extrae la decision a una funcion pura).
 *
 * El mismo identificador sirve para el login del staff (`handle@slug`) y para la URL
 * publica futura (`checkpass.club/es/<slug>`) — ADR 0070 §5.
 *
 * Lo que este modulo NO hace, a proposito: no consulta disponibilidad. La unicidad la
 * garantiza el indice unico de `core.business.slug`, no un chequeo previo (TOCTOU); el
 * `insert` que choca se traduce a 409 con `nextSuggestion` como sugerencia.
 */

/** Forma normativa de la spec §1: 3 a 30 caracteres, sin guion al principio ni al final. */
const SLUG_SHAPE = /^[a-z0-9]([a-z0-9-]{1,28}[a-z0-9])$/;

export const SLUG_MIN_LENGTH = 3;
export const SLUG_MAX_LENGTH = 30;

/**
 * Lista versionada en el repo (spec §1): los segmentos de ruta que existen hoy, mas los
 * seis genericos que el owner no puede quedarse. Es un piso: agregar entradas es seguro,
 * **quitar una deja libre una ruta que ya sirve otra cosa**, y por eso el test asevera la
 * lista entera.
 *
 * `c`, `en`, `es` y `_next` no pasan `isValidSlug` (largo o `_`), asi que hoy son
 * inalcanzables por esa via; quedan igual porque la lista documenta el espacio reservado,
 * no el subconjunto que la forma ya rechaza — el dia que la forma cambie, siguen valiendo.
 */
export const RESERVED_SLUGS: readonly string[] = [
  "api",
  "backoffice",
  "login",
  "onboarding",
  "forgot-password",
  "c",
  "enroll",
  "recover",
  "wallet",
  "_next",
  "es",
  "en",
  "admin",
  "app",
  "www",
  "static",
  "public",
  "health",
];

const RESERVED = new Set(RESERVED_SLUGS);

/**
 * Deriva un slug de un nombre. **Siempre devuelve una forma que `isValidSlug` acepta**:
 * esa es la propiedad portante, porque el wizard no expone ningun campo de slug (decision
 * del owner, spec §1) y el servidor tiene que poder resolverlo solo.
 *
 * Normalizacion Unicode NFD + descarte de diacriticos → minusculas → todo lo que no es
 * `[a-z0-9]` pasa a `-` → colapso de guiones → recorte a 30 (y otro recorte de guiones,
 * porque cortar en 30 puede dejar uno al final).
 *
 * El relleno con `0` cuando quedan menos de 3 caracteres es la unica decision no obvia:
 * un negocio llamado «A» tiene que poder darse de alta igual, y devolver algo invalido
 * seria trasladarle al comerciante un problema que el no puede resolver (no ve el campo).
 */
export function slugify(name: string): string {
  const withoutDiacritics = name.normalize("NFD").replace(/[̀-ͯ]/g, "");
  const dashed = withoutDiacritics.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const trimmed = dashed.replace(/^-+|-+$/g, "");
  const cut = trimmed.slice(0, SLUG_MAX_LENGTH).replace(/-+$/g, "");
  return cut.padEnd(SLUG_MIN_LENGTH, "0");
}

/** Valida la forma de la spec §1. No dice nada de reservadas ni de disponibilidad. */
export function isValidSlug(value: string): boolean {
  return SLUG_SHAPE.test(value);
}

/**
 * Sugerencia ante colision: sufijo numerico incremental (`la-farmacia-2`). **Solo es una
 * sugerencia** — el usuario la puede reemplazar (spec §1).
 *
 * `taken` son los slugs ya ocupados; las reservadas cuentan como ocupadas, asi que esta
 * funcion nunca sugiere una. El bucle termina siempre: `taken` es finito y los candidatos
 * no lo son.
 */
export function nextSuggestion(base: string, taken: Iterable<string>): string {
  const root = isValidSlug(base) ? base : slugify(base);
  const used = new Set(taken);
  const isFree = (candidate: string) =>
    !used.has(candidate) && !RESERVED.has(candidate);

  if (isFree(root)) return root;

  let attempt = 2;
  let candidate = withSuffix(root, attempt);
  while (!isFree(candidate)) {
    attempt += 1;
    candidate = withSuffix(root, attempt);
  }
  return candidate;
}

/**
 * Pega `-<n>` respetando el largo maximo: **recorta la raiz, no el sufijo**, porque el
 * sufijo es lo que distingue la sugerencia. La raiz entra con al menos 3 caracteres
 * (`slugify` lo garantiza), asi que el recorte nunca la deja vacia.
 */
function withSuffix(root: string, attempt: number): string {
  const suffix = `-${attempt}`;
  const head = root
    .slice(0, SLUG_MAX_LENGTH - suffix.length)
    .replace(/-+$/g, "");
  return `${head}${suffix}`;
}
