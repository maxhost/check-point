import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { termsTemplates } from "../schema";
import { LoyaltyError } from "../loyalty-program/core";

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
 *   `core.terms_template` (`drizzle/0004_polite_turbo.sql:97-100`). `transition` NO
 *   entra: es la clausula del **cierre** del programa, que el wizard no agenda.
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
  configuration: { unitName: string; target: number };
  clauses: { templateId: string }[];
  accrual: { mode: "per_purchase"; grant: 1; blockAmount: null };
  rewards: { type: "custom"; label: string }[];
  stampAction: "keep";
};

/** La unidad del wizard es siempre «sello»: la pantalla no ofrece renombrarla. */
export const WIZARD_UNIT_NAME = "sello";

/** Las dos semillas que el wizard usa como terminos. `transition` es del cierre. */
export const WIZARD_CLAUSE_KEYS = ["earning", "redemption"] as const;

/**
 * Lee los ids de las dos semillas publicadas. Si faltaran —fueron excluidas a proposito
 * del truncate de produccion, pero una base sin ellas es posible— la ruta corta con
 * `503` en vez de escribir un programa **sin terminos**, que es el estado que ningun
 * comercio deberia poder alcanzar.
 */
export async function wizardClauseTemplateIds(): Promise<string[]> {
  const rows = await getDb()
    .select({ id: termsTemplates.id, key: termsTemplates.key })
    .from(termsTemplates)
    .where(
      and(
        eq(termsTemplates.status, "published"),
        eq(termsTemplates.locale, "es"),
        eq(termsTemplates.jurisdictionScope, "global-draft"),
        inArray(termsTemplates.key, [...WIZARD_CLAUSE_KEYS]),
      ),
    );
  // El orden de las clausulas es el del wizard (`earning` y despues `redemption`), no
  // el que devuelva Postgres: el markdown de los terminos se concatena en ese orden.
  const ids = WIZARD_CLAUSE_KEYS.map(
    (key) => rows.find((row) => row.key === key)?.id,
  ).filter((id): id is string => typeof id === "string");
  if (ids.length !== WIZARD_CLAUSE_KEYS.length) {
    throw new LoyaltyError(
      503,
      "Las plantillas de términos no están disponibles.",
    );
  }
  return ids;
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
    configuration: { unitName: WIZARD_UNIT_NAME, target },
    clauses: templateIds.map((templateId) => ({ templateId })),
    accrual: { mode: "per_purchase", grant: 1, blockAmount: null },
    rewards: [{ type: "custom", label }],
    stampAction: "keep",
  };
}

/** Lo que consume la ruta: valida, lee las semillas y devuelve el input completo. */
export async function wizardProgramInput(
  raw: unknown,
): Promise<WizardProgramInput> {
  const { target, label } = validateWizardRequest(raw);
  return composeWizardProgramInput(
    target,
    label,
    await wizardClauseTemplateIds(),
  );
}
