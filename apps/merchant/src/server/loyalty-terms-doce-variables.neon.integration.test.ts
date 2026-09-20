import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.NEON_INTEGRATION_DATABASE_URL;
const enabled =
  Boolean(url) && process.env.NEON_INTEGRATION_ISOLATED === "true";
if (enabled) process.env.DATABASE_URL = url;

import { getDb } from "./db";
import { businesses, locations, termsTemplates } from "./schema";
import type { ProgramInput } from "./loyalty-program/core";
import { renderedTerms } from "./loyalty-program/terms";

/**
 * Spec 0081 §1 — **LAS DOCE VARIABLES RENDERIZADAS DE VERDAD, en un solo documento.**
 *
 * El unitario `loyalty-program/terms-variables.test.ts` asevera el DICCIONARIO (que claves
 * salen y con que valor); esto asevera el **markdown**, que es lo que ve el consumidor, y con
 * la plantilla y los locales en la base. Son dos oráculos distintos y ninguno reemplaza al
 * otro: el diccionario no ve el allowlist ni el 422 del valor vacío, y el markdown no ve la
 * diferencia entre una variable ausente y una vacía.
 *
 * Archivo aparte por el hook `file-size`: `loyalty-terms-negocio.neon…` está en **281** líneas
 * sobre un límite de 300, y esta plantilla con sus doce variables no entra — «dividir, no
 * extender».
 *
 * **El programa de este caso es `per_amount` y el negocio tiene un local**: es el único estado
 * en que las cuatro variables condicionales (las dos de local y las dos de dinero) tienen
 * valor a la vez, o sea el único en que las doce se pueden nombrar sin caer en el 422.
 */
const DOCE = "0081cc00-0000-4000-8000-0000000000bb";

/** Las doce, cada una una sola vez, en el orden de la tabla de la spec. */
const PLANTILLA_DOCE = [
  "empresa={{business_legal_name}}",
  "locales={{business_locations}}",
  "direccion={{business_address}}",
  "pais={{country_code}}",
  "moneda={{currency_code}}",
  "kind={{program_kind}}",
  "etiqueta={{program_kind_label}}",
  "nombre={{program_name}}",
  "singular={{program_unit_singular}}",
  "plural={{program_unit_plural}}",
  "grant={{program_accrual_grant}}",
  "monto={{program_accrual_block_amount}}",
].join(" | ");

const ALLOWLIST_DOCE = [
  "business_legal_name",
  "business_locations",
  "business_address",
  "country_code",
  "currency_code",
  "program_kind",
  "program_kind_label",
  "program_name",
  "program_unit_singular",
  "program_unit_plural",
  "program_accrual_grant",
  "program_accrual_block_amount",
];

describe.skipIf(!enabled)("las doce variables del TOS (spec 0081 §1)", () => {
  const businessId = randomUUID();
  const negocio = {
    id: businessId,
    name: "Bodega Doce",
    countryCode: "EC",
    currencyCode: "USD",
  };

  beforeAll(async () => {
    const db = getDb();
    await db.insert(businesses).values({
      id: businessId,
      name: negocio.name,
      slug: `doce-${businessId.slice(0, 12)}`,
      categoryGcid: "gcid:store",
      countryCode: "EC",
      timezone: "America/Guayaquil",
    });
    await db.insert(locations).values({
      businessId,
      name: "Sucursal Única",
      addressLabel: "Av. 9 de Octubre 123",
      countryCode: "EC",
      addressSnapshot: {},
    });
    await db.insert(termsTemplates).values({
      id: DOCE,
      key: "control-doce-0081",
      jurisdictionScope: "ZD",
      locale: "es",
      category: "acumulacion",
      title: "Control de las doce",
      templateMarkdown: PLANTILLA_DOCE,
      variablesAllowlist: ALLOWLIST_DOCE,
      version: "1",
      status: "published",
      publishedAt: new Date(),
    });
  }, 120_000);

  afterAll(async () => {
    const db = getDb();
    await db.delete(locations).where(eq(locations.businessId, businessId));
    await db.delete(businesses).where(eq(businesses.id, businessId));
    await db
      .delete(termsTemplates)
      .where(eq(termsTemplates.jurisdictionScope, "ZD"));
  }, 120_000);

  it("Sellos `per_amount`: las doce interpolan, y el markdown es exacto", async () => {
    const input: ProgramInput = {
      kind: "stamps",
      configuration: { unitName: "sello", unitPlural: "sellos", target: 10 },
      clauses: [{ templateId: DOCE }],
      stampAction: "keep",
      stampCropped: false,
      cardDesign: null,
      accrual: { mode: "per_amount", grant: 2, blockAmount: "5.00" },
      rewards: [],
      redeemAllowInsufficient: false,
    };
    const { markdown } = await renderedTerms(input, negocio);
    // `toBe` y no doce `toContain`: una variable de más, de menos o mal ubicada se ve acá.
    expect(markdown).toBe(
      "empresa=Bodega Doce | locales=Sucursal Única | " +
        "direccion=Av. 9 de Octubre 123 | pais=EC | moneda=USD | kind=stamps | " +
        "etiqueta=Sellos | nombre=sello | singular=sello | plural=sellos | " +
        "grant=2 | monto=5.00",
    );
    expect(markdown).not.toContain("{{");
  }, 90_000);

  it("Puntos `per_amount`: la etiqueta y las unidades cambian, el resto no", async () => {
    const input: ProgramInput = {
      kind: "points",
      configuration: { unitSingular: "punto", unitPlural: "puntos" },
      clauses: [{ templateId: DOCE }],
      stampAction: "keep",
      stampCropped: false,
      cardDesign: null,
      accrual: { mode: "per_amount", grant: 10, blockAmount: "1.00" },
      rewards: [],
      redeemAllowInsufficient: false,
    };
    const { markdown } = await renderedTerms(input, negocio);
    expect(markdown).toBe(
      "empresa=Bodega Doce | locales=Sucursal Única | " +
        "direccion=Av. 9 de Octubre 123 | pais=EC | moneda=USD | kind=points | " +
        "etiqueta=Puntos | nombre=puntos | singular=punto | plural=puntos | " +
        "grant=10 | monto=1.00",
    );
  }, 90_000);

  /**
   * **EL CONTROL NEGATIVO DEL 422, y es lo que le da sentido a las dos decisiones de diseño de
   * la spec.** La misma plantilla, el mismo allowlist, y un programa `per_purchase`: el
   * `blockAmount` es `null`, así que `{{program_accrual_block_amount}}` **no tiene valor** y el
   * guardado se corta. Es la prueba de que una plantilla que nombra el monto **rompe** todo
   * programa por compra — o sea por qué `earning_per_amount` tiene que ser una plantilla
   * APARTE y no una variable opcional de `earning`.
   */
  it("`per_purchase` contra esta plantilla es 422: el monto no tiene valor", async () => {
    const input: ProgramInput = {
      kind: "stamps",
      configuration: { unitName: "sello", unitPlural: "sellos", target: 10 },
      clauses: [{ templateId: DOCE }],
      stampAction: "keep",
      stampCropped: false,
      cardDesign: null,
      accrual: { mode: "per_purchase", grant: 1, blockAmount: null },
      rewards: [],
      redeemAllowInsufficient: false,
    };
    await expect(renderedTerms(input, negocio)).rejects.toThrow(
      "La variable {{program_accrual_block_amount}} no está permitida.",
    );
  }, 90_000);
});
