/**
 * Spec 0078 (ADR 0076 §7) — QUE TOS le toca a un negocio, decidido SIN tocar la base.
 *
 * Modulo hoja: no importa nada del dominio, asi que la eleccion del scope se puede
 * testear con una tabla de casos en vez de con una rama Neon. Lo que consulta la base
 * vive en `onboarding/program-defaults.ts`; lo que DECIDE vive aca.
 */

/** El scope de caida: el TOS de todo pais que todavia no tiene el suyo. */
export const DEFAULT_TERMS_SCOPE = "default";

const ISO2 = /^[A-Za-z]{2}$/;

/**
 * El orden de preferencia de `jurisdiction_scope` para un pais.
 *
 * `["EC", "default"]` para un ISO-2 (normalizado a mayusculas, que es como se siembran
 * los scopes), y `["default"]` a secas cuando el pais es nulo, vacio o no son exactamente
 * dos letras. El scope de caida esta SIEMPRE al final: un negocio nunca se queda sin
 * candidatos, y por eso el 503 de «no hay plantillas» solo puede venir de una base sin
 * semillas, no de un pais raro.
 */
export function termsScopeCandidates(
  countryCode: string | null | undefined,
): string[] {
  const iso = typeof countryCode === "string" ? countryCode.trim() : "";
  return ISO2.test(iso)
    ? [iso.toUpperCase(), DEFAULT_TERMS_SCOPE]
    : [DEFAULT_TERMS_SCOPE];
}

/**
 * Spec 0081 §2 — LA CLAVE DE LA CLAUSULA DE ACUMULACION, elegida por el modo.
 *
 * `per_amount` («se otorgan N unidades por cada $X de compra») necesita nombrar el monto y
 * la moneda; `per_purchase` («una unidad por compra») no tiene monto —el `blockAmount` es
 * `null` por CHECK de la base—.
 *
 * **POR QUE DOS PLANTILLAS Y NO UNA VARIABLE OPCIONAL, medido y no supuesto:**
 * `renderTermsText` tira 422 cuando el valor de la variable es **vacio**, no solo cuando no
 * esta en el allowlist. Un `earning` unico que nombre `{{program_accrual_block_amount}}`
 * **rompe todo programa `per_purchase`**, que es justo el que crea el cuerpo corto del alta.
 *
 * Cualquier cosa que no sea `per_amount` cae a `earning`: fail-safe hacia el texto que no
 * depende de dinero.
 */
export function earningClauseKey(
  accrualMode: string | null | undefined,
): "earning" | "earning_per_amount" {
  return accrualMode === "per_amount" ? "earning_per_amount" : "earning";
}

export type ScopedTemplate = {
  id: string;
  key: string;
  jurisdictionScope: string;
};

/**
 * Los ids de `keys` resueltos contra UN SOLO scope, en el orden de `keys`.
 *
 * **LA CAIDA ES POR SCOPE COMPLETO, NO POR CLAVE**, y es la propiedad central de esta
 * spec: si a `EC` le falta `redemption`, el resultado son las DOS de `default`, nunca
 * `earning` de EC + `redemption` de default. Un TOS mezclado es un documento legal que
 * nadie escribio y que nadie reviso.
 *
 * Devuelve `null` si ningun candidato tiene todas las claves — quien llama decide que
 * hacer con eso (en el wizard es un 503, antes de escribir el programa).
 */
export function scopedTemplateIds(
  rows: readonly ScopedTemplate[],
  candidates: readonly string[],
  keys: readonly string[],
): string[] | null {
  for (const scope of candidates) {
    const ids = keys.map(
      (key) =>
        rows.find((row) => row.jurisdictionScope === scope && row.key === key)
          ?.id,
    );
    if (ids.every((id): id is string => typeof id === "string")) return ids;
  }
  return null;
}
