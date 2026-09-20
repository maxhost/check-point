import { createHash } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { locations, termsTemplates } from "../schema";
import { LoyaltyError, type ProgramInput } from "./core";
import { renderTermsText } from "./validation";

/**
 * El negocio, como lo necesita el TOS (spec 0081 §1).
 *
 * **`ownerBusiness` NO se toca**: ya selecciona `id`, `name`, `countryCode` y
 * `currencyCode` (`loyalty-program/owner.ts`) y `saveProgram` ya le pasa ese objeto
 * entero. Lo unico que escondia la moneda y el id era este tipo, que declaraba dos
 * campos. Ampliarlo no cuesta una consulta.
 */
export type TermsBusiness = {
  id: string;
  name: string;
  countryCode: string;
  currencyCode: string;
} | null;

/** Un local, como lo nombra el texto legal: su rotulo y su direccion. */
export type TermsLocation = { name: string; addressLabel: string };

/**
 * EL DICCIONARIO DE VARIABLES DEL TOS. **Puro y exportado a proposito**: es el unico
 * oraculo posible de «que variables se emiten», porque `renderTermsText` no distingue una
 * variable AUSENTE de una VACIA (las dos son falsy → las dos son 422), asi que desde el
 * markdown resultante las dos decisiones son indistinguibles. Ver el docblock de
 * `renderedTerms`.
 *
 * **Las variables de local NO se emiten cuando no hay locales `active`** (spec 0081 §1):
 * un string vacio seria un 422 que impide guardar el programa. La proteccion real de ese
 * caso es que **ninguna plantilla del wizard las nombra** —`renderTermsText` solo mira las
 * variables que el texto usa—, y eso esta aseverado sobre las semillas.
 *
 * **Las variables de dinero solo tienen valor en `per_amount`**: en `per_purchase` el
 * `blockAmount` es `null` por CHECK de la base. De ahi la SEGUNDA plantilla de `earning`
 * (`earning_per_amount`, §2) en vez de un hueco opcional en la de siempre.
 */
export function termsVariables(
  input: ProgramInput,
  business: NonNullable<TermsBusiness>,
  businessLocations: readonly TermsLocation[],
): Record<string, string> {
  const names = businessLocations.map((item) => item.name).join(", ");
  const addresses = businessLocations
    .map((item) => item.addressLabel)
    .join(", ");
  return {
    // Es el nombre COMERCIAL (`core.business.name`): no hay columna de razon social.
    // Declarado como limite del texto legal en la spec 0081 §«No entra».
    business_legal_name: business.name,
    ...(names ? { business_locations: names } : {}),
    // La empresa NO tiene direccion propia: la direccion del TOS es la de sus locales.
    ...(addresses ? { business_address: addresses } : {}),
    country_code: business.countryCode,
    currency_code: business.currencyCode,
    // `program_name` SE CONSERVA tal cual, singular incluido: es la variable que usan
    // las plantillas del scope `global-draft`, y cambiarla les cambiaria el texto a los
    // programas que todavia las referencian. Lo que arregla el «Los sello se acumulan…»
    // es `program_unit_plural`, que es lo que usan las plantillas por pais (spec 0078).
    program_name:
      input.kind === "points"
        ? String(input.configuration.unitPlural)
        : String(input.configuration.unitName),
    // El literal CRUDO (`stamps`/`points`), en ingles. Se conserva porque lo permiten los
    // allowlists de hoy; lo que un texto en castellano tiene que usar es la etiqueta.
    program_kind: input.kind,
    program_kind_label: input.kind === "points" ? "Puntos" : "Sellos",
    program_unit_singular:
      input.kind === "points"
        ? String(input.configuration.unitSingular)
        : String(input.configuration.unitName),
    // Sellos acepta `unitPlural` OPCIONAL (`validation.ts`), asi que un programa viejo
    // —o uno creado por una puerta que no lo manda— cae al singular en vez de romper.
    program_unit_plural:
      input.kind === "points"
        ? String(input.configuration.unitPlural)
        : String(
            input.configuration.unitPlural ?? input.configuration.unitName,
          ),
    program_accrual_grant: String(input.accrual.grant),
    ...(input.accrual.blockAmount
      ? { program_accrual_block_amount: input.accrual.blockAmount }
      : {}),
  };
}

/** Los locales que el texto legal puede nombrar: los `active`, en orden estable. */
async function activeLocations(businessId: string): Promise<TermsLocation[]> {
  return await getDb()
    .select({ name: locations.name, addressLabel: locations.addressLabel })
    .from(locations)
    .where(
      and(eq(locations.businessId, businessId), eq(locations.status, "active")),
    )
    .orderBy(asc(locations.createdAt));
}

/**
 * El markdown del TOS del programa, con las variables ya interpoladas.
 *
 * **EL GOTCHA QUE MANDA EN TODO ESTE MODULO:** `renderTermsText` tira 422 cuando el valor
 * de la variable es **vacio**, no solo cuando la variable no esta en el allowlist
 * (`!allowedVariables.includes(key) || !variables[key]`, `validation.ts`). O sea que una
 * variable «que a veces no aplica» **impide guardar el programa**. Corolario medido: no
 * emitir una variable y emitirla vacia producen EXACTAMENTE el mismo 422, asi que la
 * decision de no emitirla no protege nada por si sola — lo que protege es que ninguna
 * plantilla del wizard la nombre.
 *
 * **UNA consulta nueva por escritura de programa** (los locales). Se declara como costo,
 * en la linea del hallazgo de round-trips que dejo abierto la spec 0079.
 */
export async function renderedTerms(
  input: ProgramInput,
  business: TermsBusiness,
) {
  if (!business)
    throw new LoyaltyError(403, "No tienes un negocio como owner.");
  const ids = input.clauses.flatMap((clause) =>
    clause.templateId ? [clause.templateId] : [],
  );
  const templates = ids.length
    ? await getDb()
        .select()
        .from(termsTemplates)
        .where(
          and(
            eq(termsTemplates.status, "published"),
            inArray(termsTemplates.id, ids),
          ),
        )
    : [];
  const variables = termsVariables(
    input,
    business,
    await activeLocations(business.id),
  );
  const markdown = input.clauses
    .map((clause) => {
      const template = clause.templateId
        ? templates.find((item) => item.id === clause.templateId)
        : null;
      if (clause.templateId && !template) {
        throw new LoyaltyError(
          422,
          "La plantilla seleccionada no está disponible.",
        );
      }
      const text = clause.text ?? template?.templateMarkdown;
      if (!text) throw new LoyaltyError(422, "Cada cláusula debe tener texto.");
      return renderTermsText(
        text,
        variables,
        Array.isArray(template?.variablesAllowlist)
          ? template.variablesAllowlist.filter(
              (item): item is string => typeof item === "string",
            )
          : [],
      );
    })
    .join("\n\n");
  return {
    markdown,
    hash: createHash("sha256").update(markdown).digest("hex"),
  };
}
