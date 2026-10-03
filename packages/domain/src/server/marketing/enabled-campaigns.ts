import type { TemplateKey } from "./templates";

/**
 * QUÉ CAMPAÑAS EXISTEN HOY (ADR 0115 §1 y §4, spec 0138). Es lo ÚNICO que se edita para
 * encender o apagar una campaña: la API del merchant (catálogo, listado, por id, crear,
 * encender), el tick (pasos 1, 1b, el refresco de valle y el paso 4) y «Mis beneficios»
 * preguntan acá y no tienen listas propias. Los tests de lo apagado se saltean con estas
 * mismas condiciones (`describe.skipIf`), así que re-encender algo vuelve a correrlos solos.
 *
 * Lo apagado NO se borra: su código queda para reactivarlo (owner, ADR 0115).
 *
 * Es también la puerta donde vivirán los límites por comercio (ADR 0115 §5); hoy no los
 * implementa: los valores por comercio no están decididos.
 */

/** Las plantillas encendidas, en el orden del catálogo. */
export const ENABLED_TEMPLATE_KEYS: readonly TemplateKey[] = [
  "welcome",
  "cross",
];

/** El compositor libre (campaña sin plantilla, `template_key` nulo). */
export const COMPOSER_ENABLED: boolean = false;

/** El paso 4 del tick (proximidad del pase de Wallet, ADR 0065). */
export const PROXIMITY_PLACEMENT_ENABLED: boolean = false;

/** `null` = compositor. Una clave desconocida es `false`. */
export function campaignKindEnabled(templateKey: string | null): boolean {
  if (templateKey === null) return COMPOSER_ENABLED;
  return (ENABLED_TEMPLATE_KEYS as readonly string[]).includes(templateKey);
}
