import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { termsTemplates } from "../schema";
import { LoyaltyError } from "../loyalty-program/core";
import { ownerBusiness } from "../loyalty-program/owner";
import {
  type ScopedTemplate,
  scopedTemplateIds,
  termsScopeCandidates,
} from "../loyalty-program/terms-scope";

/**
 * Spec 0069 §D4 — dos campos adentro, un `ProgramInput` COMPLETO afuera.
 *
 * La pantalla 3 del wizard pregunta dos cosas: cada cuantos sellos, y que premio.
 * `saveProgram` exige bastante mas (`validateProgramInput`: `kind`, `configuration`
 * con `unitName` + `target` 2..50, **al menos una clausula de terminos**, exactamente
 * un premio para `stamps`, y la mecanica de acumulacion). Sin esta capa, quien
 * construye la UI por fuera tendria que **inventar los terminos legales** del comercio.
 *
 * Lo que compone, y por que cada cosa:
 *
 * - `clauses`: los `templateId` de las SEMILLAS `earning` y `redemption` de
 *   `core.terms_template`, **del scope del pais del negocio** con caida a `default`
 *   (spec 0078; antes era el unico `global-draft` hardcodeado). `transition` NO entra:
 *   es la clausula del **cierre** del programa, que el wizard no agenda.
 * - `accrual`: `per_purchase`, `grant: 1` — «un sello por compra», que es la unica
 *   lectura de «cada cuantos sellos» que el wizard pregunta. **Este default lo eligio
 *   el implementador, no el owner**: la spec no lo fija y `validateAccrual` no acepta
 *   que falte.
 * - `stampAction: "keep"` — el wizard no sube imagen; de ahi sale el placeholder (§D5).
 *
 * El `status: 'active'` **no se construye aca**: `loyalty_program.status` ya nace
 * `'active'` por default de columna (`schema/loyalty.ts`). Es una propiedad a
 * **verificar**, no trabajo nuevo.
 */
export type WizardProgramRequest = {
  target?: unknown;
  reward?: unknown;
};

/** El `ProgramInput` crudo que consume `saveProgram` (lo valida el de siempre). */
export type WizardProgramInput = {
  kind: "stamps";
  configuration: { unitName: string; unitPlural: string; target: number };
  clauses: { templateId: string }[];
  accrual: { mode: "per_purchase"; grant: 1; blockAmount: null };
  rewards: { type: "custom"; label: string }[];
  stampAction: "keep";
};

/** La unidad del wizard es siempre «sello»: la pantalla no ofrece renombrarla. */
export const WIZARD_UNIT_NAME = "sello";

/**
 * Y su plural, que es lo que el TOS por pais interpola en `{{program_unit_plural}}`.
 * Sin esto el texto que ve el consumidor dice «Los sello se acumulan…» (spec 0078).
 */
export const WIZARD_UNIT_PLURAL = "sellos";

/** Las dos semillas que el wizard usa como terminos. `transition` es del cierre. */
export const WIZARD_CLAUSE_KEYS = ["earning", "redemption"] as const;

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
): string[] {
  // El orden de las clausulas es el del wizard (`earning` y despues `redemption`), no
  // el que devuelva Postgres: el markdown de los terminos se concatena en ese orden.
  const ids = scopedTemplateIds(rows, candidates, WIZARD_CLAUSE_KEYS);
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
  return resolveWizardClauseIds(rows, candidates);
}

/** Valida los dos campos del wizard. Puro: no toca la base. */
export function validateWizardRequest(raw: unknown): {
  target: number;
  label: string;
} {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new LoyaltyError(422, "El programa debe ser un objeto válido.");
  }
  const input = raw as WizardProgramRequest;
  const target = input.target;
  if (
    !Number.isInteger(target) ||
    (target as number) < 2 ||
    (target as number) > 50
  ) {
    throw new LoyaltyError(
      422,
      "El objetivo debe ser un entero entre 2 y 50 sellos.",
    );
  }
  const reward = input.reward;
  if (!reward || typeof reward !== "object" || Array.isArray(reward)) {
    throw new LoyaltyError(422, "Define el premio del programa.");
  }
  const { type, label } = reward as { type?: unknown; label?: unknown };
  if (type !== "custom") {
    throw new LoyaltyError(422, "El premio del wizard es de tipo libre.");
  }
  const trimmed = typeof label === "string" ? label.trim() : "";
  if (!trimmed) {
    throw new LoyaltyError(422, "El premio libre necesita un nombre.");
  }
  return { target: target as number, label: trimmed };
}

/** Compone el `ProgramInput` completo a partir de los dos campos y las dos semillas. */
export function composeWizardProgramInput(
  target: number,
  label: string,
  templateIds: string[],
): WizardProgramInput {
  return {
    kind: "stamps",
    configuration: {
      unitName: WIZARD_UNIT_NAME,
      unitPlural: WIZARD_UNIT_PLURAL,
      target,
    },
    clauses: templateIds.map((templateId) => ({ templateId })),
    accrual: { mode: "per_purchase", grant: 1, blockAmount: null },
    rewards: [{ type: "custom", label }],
    stampAction: "keep",
  };
}

/**
 * Lo que consume la ruta: valida, lee las semillas del PAIS del negocio y devuelve el
 * input completo.
 *
 * Recibe el `userId` y no el pais porque el pais no puede venir del cliente: se resuelve
 * con el mismo `ownerBusiness` que usa `saveProgram`, o sea de la sesion. Si el usuario
 * no tiene negocio como owner, cae a `default` y `saveProgram` corta despues con el 403
 * de siempre — el TOS no es quien decide eso.
 */
export async function wizardProgramInput(
  raw: unknown,
  userId: string,
): Promise<WizardProgramInput> {
  const { target, label } = validateWizardRequest(raw);
  const business = await ownerBusiness(userId);
  return composeWizardProgramInput(
    target,
    label,
    await wizardClauseTemplateIds(business?.countryCode ?? null),
  );
}
