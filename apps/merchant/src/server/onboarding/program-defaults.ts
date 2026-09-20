import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { termsTemplates } from "../schema";
import { LoyaltyError } from "../loyalty-program/core";
import { ownerBusiness } from "../loyalty-program/owner";
import {
  earningClauseKey,
  type ScopedTemplate,
  scopedTemplateIds,
  termsScopeCandidates,
} from "../loyalty-program/terms-scope";

/**
 * Spec 0079 §3 — LOS DEFAULTS DEL PROGRAMA (antes: «los defaults del wizard»).
 *
 * Desde la 0079 hay **una sola** ruta de escritura (`PUT /api/loyalty-program`) y acepta
 * cuerpo corto o completo. Este modulo es lo que hace posible el corto: **completa** lo
 * que el servidor puede completar con seguridad y **no inventa** lo que no puede.
 *
 * **El principio del contrato, y es lo unico que hay que recordar (spec 0079 §2): todo lo
 * que el servidor puede completar con seguridad es OPCIONAL; lo que no puede —el dinero—
 * es OBLIGATORIO.**
 *
 * Lo que completa, y por que cada cosa:
 *
 * - `clauses`: los `templateId` de las SEMILLAS `earning` y `redemption` de
 *   `core.terms_template`, **del scope del pais del negocio** con caida a `default`
 *   (spec 0078; antes era el unico `global-draft` hardcodeado). `transition` NO entra:
 *   es la clausula del **cierre** del programa, que el alta no agenda.
 * - `configuration.unitName`/`unitPlural` **solo en Sellos**: «sello»/«sellos».
 * - `accrual` **solo en Sellos**: `per_purchase`, `grant: 1` — «un sello por compra», que
 *   es la unica lectura posible de la pregunta del alta. **En PUNTOS no se completa
 *   NUNCA**: `validateAccrual` fuerza `per_amount` para Puntos (`accrual.ts:22-27`), que
 *   exige un `blockAmount > 0` — un **monto de dinero**, y «X puntos por cada $Y» no
 *   tiene default seguro. Faltando, el 422 de `validateProgramInput`.
 * - `stampAction` **no se completa aca**: `validateProgramInput` ya hace `?? "keep"`.
 *   Duplicarlo serian dos reglas para lo mismo.
 *
 * **NADA DE LO QUE VIENE EXPLICITO SE PISA.** Es la mutacion M3 de la spec: un cuerpo
 * completo de hoy tiene que dar exactamente el mismo resultado que antes de la 0079.
 *
 * **Y ESTE MODULO NO VALIDA.** Devuelve el cuerpo completado **sin validar**: el unico
 * que dice si es valido sigue siendo `validateProgramInput`, adentro de `saveProgram`
 * (spec 0079 §3: «no se duplica ni una regla»).
 *
 * El `status: 'active'` **no se construye aca**: `loyalty_program.status` ya nace
 * `'active'` por default de columna (`schema/loyalty.ts`). Es una propiedad a
 * **verificar**, no trabajo nuevo.
 */

/**
 * La unidad por defecto de Sellos. **`unitName` y `unitPlural` se completan como UN par,
 * no como dos campos sueltos**: un cuerpo que nombra su unidad («visita») y omite el
 * plural conserva el comportamiento de hoy —`renderedTerms` cae al singular— en vez de
 * recibir «sellos», que seria el plural de OTRA unidad en el texto legal del consumidor.
 */
export const DEFAULT_STAMP_UNIT_NAME = "sello";

/**
 * Y su plural, que es lo que el TOS por pais interpola en `{{program_unit_plural}}`.
 * Sin esto el texto que ve el consumidor dice «Los sello se acumulan…» (spec 0078).
 */
export const DEFAULT_STAMP_UNIT_PLURAL = "sellos";

/**
 * Las dos semillas que el wizard usa como terminos. `transition` es del cierre.
 *
 * **Spec 0081 §2: la clave de acumulacion depende del `accrual.mode`** — `earning` para
 * «una unidad por compra», `earning_per_amount` para «N unidades cada $X». Las CLAVES
 * POSIBLES (para el `IN` de la consulta) son las tres; el par que se resuelve son dos.
 */
export const WIZARD_CLAUSE_KEYS = [
  "earning",
  "earning_per_amount",
  "redemption",
] as const;

/** El par de claves que le toca a un programa, en el orden del markdown. */
export function wizardClauseKeys(
  accrualMode: string | null | undefined,
): readonly string[] {
  return [earningClauseKey(accrualMode), "redemption"];
}

/**
 * Traduce las filas leidas al par de ids del wizard. PURA, para que el 503 tenga oraculo
 * sin base: `scopedTemplateIds` elige **un solo scope completo** (nunca media clausula de
 * cada uno) y devuelve `null` si ningun candidato tiene las dos claves. Ese `null` es el
 * `503` — la ruta corta ANTES de escribir un programa **sin terminos**, que es el estado
 * que ningun comercio deberia poder alcanzar.
 */
export function resolveWizardClauseIds(
  rows: readonly ScopedTemplate[],
  candidates: readonly string[],
  accrualMode: string | null | undefined,
): string[] {
  // El orden de las clausulas es el del wizard (acumulacion y despues `redemption`), no
  // el que devuelva Postgres: el markdown de los terminos se concatena en ese orden.
  const ids = scopedTemplateIds(
    rows,
    candidates,
    wizardClauseKeys(accrualMode),
  );
  if (!ids) {
    throw new LoyaltyError(
      503,
      "Las plantillas de términos no están disponibles.",
    );
  }
  return ids;
}

/**
 * Los ids de las dos semillas publicadas **del pais del negocio**, con caida al scope
 * `default` (spec 0078 §3, ADR 0076 §7). Una sola consulta por los dos candidatos: la
 * eleccion entre ellos es de `resolveWizardClauseIds`, no del `ORDER BY`.
 */
export async function wizardClauseTemplateIds(
  countryCode: string | null | undefined,
  accrualMode: string | null | undefined,
): Promise<string[]> {
  const candidates = termsScopeCandidates(countryCode);
  const rows = await getDb()
    .select({
      id: termsTemplates.id,
      key: termsTemplates.key,
      jurisdictionScope: termsTemplates.jurisdictionScope,
    })
    .from(termsTemplates)
    .where(
      and(
        eq(termsTemplates.status, "published"),
        eq(termsTemplates.locale, "es"),
        inArray(termsTemplates.jurisdictionScope, candidates),
        inArray(termsTemplates.key, [...WIZARD_CLAUSE_KEYS]),
      ),
    );
  return resolveWizardClauseIds(rows, candidates, accrualMode);
}

/** Un objeto plano, o `null`. No valida nada: sólo decide si hay algo que completar. */
const asObject = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

/**
 * Completa el cuerpo parcial. **PURA** y sin validar (ver el docblock del modulo).
 *
 * `clauseTemplateIds` en `null` significa «el cuerpo ya trae `clauses`»: la lectura de
 * semillas la decide `programInput`, que es quien puede tocar la base.
 */
export function composeProgramInput(
  partial: Record<string, unknown>,
  clauseTemplateIds: readonly string[] | null,
): Record<string, unknown> {
  const composed: Record<string, unknown> = { ...partial };
  if (clauseTemplateIds) {
    // El orden de las clausulas es el de `WIZARD_CLAUSE_KEYS`, que es el del markdown.
    composed.clauses = clauseTemplateIds.map((templateId) => ({ templateId }));
  }
  // TODO LO QUE SIGUE ES SOLO DE SELLOS. Puntos no recibe un solo default: sus dos campos
  // propios (`unitSingular`/`unitPlural`) y su `accrual` con dinero son OBLIGATORIOS.
  if (partial.kind !== "stamps") return composed;
  const configuration = asObject(partial.configuration);
  if (configuration && configuration.unitName === undefined) {
    composed.configuration = {
      ...configuration,
      unitName: DEFAULT_STAMP_UNIT_NAME,
      unitPlural: configuration.unitPlural ?? DEFAULT_STAMP_UNIT_PLURAL,
    };
  }
  if (partial.accrual === undefined) {
    composed.accrual = { mode: "per_purchase", grant: 1, blockAmount: null };
  }
  return composed;
}

/**
 * Lo que consume la ruta unica: completa el cuerpo y, si hace falta, lee las semillas del
 * PAIS del negocio. Devuelve el cuerpo **sin validar** — lo valida `saveProgram`.
 *
 * Recibe el `userId` y no el pais porque el pais no puede venir del cliente: se resuelve
 * con el mismo `ownerBusiness` que usa `saveProgram`, o sea de la sesion. Si el usuario
 * no tiene negocio como owner, cae a `default` y `saveProgram` corta despues con el 403
 * de siempre — el TOS no es quien decide eso.
 *
 * Un cuerpo que **no es un objeto** vuelve tal cual: el 422 «El programa debe ser un
 * objeto válido.» lo tira `validateProgramInput`, y repetirlo aca serian dos reglas para
 * lo mismo.
 */
export async function programInput(
  raw: unknown,
  userId: string,
): Promise<unknown> {
  const partial = asObject(raw);
  if (!partial) return raw;
  // `!== undefined` y no un chequeo de contenido: un `clauses: []` explicito NO se
  // reemplaza por las semillas — se va al 422 «Añade al menos una cláusula de términos.»,
  // que es lo que el cliente pidió al mandarlo vacío.
  if (partial.clauses !== undefined) return composeProgramInput(partial, null);
  const business = await ownerBusiness(userId);
  return composeProgramInput(
    partial,
    await wizardClauseTemplateIds(
      business?.countryCode ?? null,
      composedAccrualMode(partial),
    ),
  );
}

/**
 * El modo de acumulacion **EFECTIVO**: el que el compositor va a dejar puesto, no el del
 * cuerpo crudo. Spec 0081 §2 — la clave de la clausula de acumulacion se elige con ESTE
 * valor, y el cuerpo corto de Sellos no manda `accrual`: lo completa el compositor.
 *
 * Se deriva **del compositor mismo** (y no de una copia de su regla) para que no puedan
 * divergir: si el default de Sellos cambiara, el TOS lo sigue solo.
 */
export function composedAccrualMode(
  partial: Record<string, unknown>,
): string | null {
  const accrual = asObject(composeProgramInput(partial, null).accrual);
  return typeof accrual?.mode === "string" ? accrual.mode : null;
}
