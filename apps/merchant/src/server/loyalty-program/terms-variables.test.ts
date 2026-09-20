import { describe, expect, it } from "vitest";
import type { ProgramInput } from "./core";
import { earningClauseKey } from "./terms-scope";
import { termsVariables } from "./terms";

/**
 * Spec 0081 §1 y §2 — EL DICCIONARIO DE VARIABLES DEL TOS, y la clave de la cláusula de
 * acumulación. Puros los dos, así que esto no necesita base.
 *
 * **POR QUÉ ESTE ARCHIVO EXISTE y no alcanza con el markdown de un test de integración:**
 * `renderTermsText` **no distingue una variable AUSENTE de una VACÍA** — la condición es
 * `!allowedVariables.includes(key) || !variables[key]`, y `undefined` y `""` son las dos
 * falsy, así que las dos tiran el mismo 422. Desde el markdown resultante, «no emitir
 * `business_locations`» y «emitirla vacía» son **indistinguibles**. El único lugar donde esa
 * decisión es observable es el diccionario mismo, y por eso `termsVariables` es pura y
 * exportada.
 */
const base = (
  kind: ProgramInput["kind"],
  configuration: Record<string, unknown>,
  accrual: ProgramInput["accrual"],
): ProgramInput => ({
  kind,
  configuration,
  clauses: [],
  stampAction: "keep",
  stampCropped: false,
  cardDesign: null,
  accrual,
  rewards: [],
  redeemAllowInsufficient: false,
});

const negocio = {
  id: "00000081-0000-4000-8000-000000000001",
  name: "Bodega Las Peñas",
  countryCode: "EC",
  currencyCode: "USD",
};

const SELLOS_POR_COMPRA = base(
  "stamps",
  { unitName: "sello", unitPlural: "sellos", target: 6 },
  { mode: "per_purchase", grant: 1, blockAmount: null },
);
const SELLOS_POR_MONTO = base(
  "stamps",
  { unitName: "sello", unitPlural: "sellos", target: 10 },
  { mode: "per_amount", grant: 1, blockAmount: "5.00" },
);
const PUNTOS = base(
  "points",
  { unitSingular: "punto", unitPlural: "puntos" },
  { mode: "per_amount", grant: 10, blockAmount: "1.00" },
);

const LOCAL_A = {
  name: "Sucursal Centro",
  addressLabel: "Av. 9 de Octubre 123",
};
const LOCAL_B = {
  name: "Sucursal Norte",
  addressLabel: "Av. Francisco de Orellana 45",
};

describe("termsVariables — las variables del negocio (spec 0081 §1)", () => {
  it("con DOS locales activos los lista a todos, separados por `, `", () => {
    const vars = termsVariables(SELLOS_POR_COMPRA, negocio, [LOCAL_A, LOCAL_B]);
    expect(vars.business_locations).toBe("Sucursal Centro, Sucursal Norte");
    expect(vars.business_address).toBe(
      "Av. 9 de Octubre 123, Av. Francisco de Orellana 45",
    );
  });

  it("con UN local, las dos variables son ese local, sin separador", () => {
    const vars = termsVariables(SELLOS_POR_COMPRA, negocio, [LOCAL_A]);
    expect(vars.business_locations).toBe("Sucursal Centro");
    expect(vars.business_address).toBe("Av. 9 de Octubre 123");
  });

  /**
   * **EL CASO TRAMPA DE LA SPEC.** Las dos claves tienen que estar AUSENTES, no vacías. La
   * aserción es `not.toHaveProperty` y no `toBe("")` a propósito: es lo único que separa las
   * dos decisiones, porque `renderTermsText` las trata igual.
   */
  it("SIN locales activos las dos variables NO se emiten (ausentes, no vacías)", () => {
    const vars = termsVariables(SELLOS_POR_COMPRA, negocio, []);
    expect(vars).not.toHaveProperty("business_locations");
    expect(vars).not.toHaveProperty("business_address");
  });

  it("el país, la moneda y el nombre comercial salen del negocio", () => {
    const vars = termsVariables(SELLOS_POR_COMPRA, negocio, []);
    expect(vars.country_code).toBe("EC");
    expect(vars.currency_code).toBe("USD");
    // Es el nombre COMERCIAL: no hay columna de razón social (límite declarado en la spec).
    expect(vars.business_legal_name).toBe("Bodega Las Peñas");
  });

  it("Sellos: la etiqueta en castellano, el literal crudo, y el singular y el plural", () => {
    const vars = termsVariables(SELLOS_POR_COMPRA, negocio, []);
    expect(vars.program_kind_label).toBe("Sellos");
    expect(vars.program_kind).toBe("stamps");
    expect(vars.program_unit_singular).toBe("sello");
    expect(vars.program_unit_plural).toBe("sellos");
    // `program_name` se conserva: en Sellos es el SINGULAR, y no cambió desde la 0078.
    expect(vars.program_name).toBe("sello");
  });

  it("Puntos: la etiqueta es «Puntos» y el singular sale de `unitSingular`", () => {
    const vars = termsVariables(PUNTOS, negocio, []);
    expect(vars.program_kind_label).toBe("Puntos");
    expect(vars.program_kind).toBe("points");
    expect(vars.program_unit_singular).toBe("punto");
    expect(vars.program_unit_plural).toBe("puntos");
    expect(vars.program_name).toBe("puntos");
  });

  /** Sellos acepta `unitPlural` OPCIONAL: sin él el plural CAE al singular (spec 0078). */
  it("Sellos sin `unitPlural`: el plural cae al singular, no a «sellos»", () => {
    const vars = termsVariables(
      base(
        "stamps",
        { unitName: "visita", target: 6 },
        { mode: "per_purchase", grant: 1, blockAmount: null },
      ),
      negocio,
      [],
    );
    expect(vars.program_unit_plural).toBe("visita");
    expect(vars.program_unit_singular).toBe("visita");
  });

  it("`per_purchase`: el monto NO se emite, pero la cantidad otorgada SÍ", () => {
    const vars = termsVariables(SELLOS_POR_COMPRA, negocio, []);
    expect(vars).not.toHaveProperty("program_accrual_block_amount");
    expect(vars.program_accrual_grant).toBe("1");
  });

  it("`per_amount`: el monto viaja como el string `numeric(12,2)` de la base", () => {
    const vars = termsVariables(SELLOS_POR_MONTO, negocio, []);
    expect(vars.program_accrual_block_amount).toBe("5.00");
    expect(vars.program_accrual_grant).toBe("1");
    expect(termsVariables(PUNTOS, negocio, []).program_accrual_grant).toBe(
      "10",
    );
  });

  /**
   * LA TABLA COMPLETA, que es el DoD «las doce variables se emiten». Con un programa
   * `per_amount` y con locales, **ninguna** de las doce queda afuera: es el único estado en
   * que las cuatro condicionales (los dos locales y los dos de dinero) tienen valor.
   */
  it("con `per_amount` y locales, el diccionario tiene las DOCE claves", () => {
    const vars = termsVariables(SELLOS_POR_MONTO, negocio, [LOCAL_A, LOCAL_B]);
    expect(Object.keys(vars).sort()).toEqual([
      "business_address",
      "business_legal_name",
      "business_locations",
      "country_code",
      "currency_code",
      "program_accrual_block_amount",
      "program_accrual_grant",
      "program_kind",
      "program_kind_label",
      "program_name",
      "program_unit_plural",
      "program_unit_singular",
    ]);
    // Ninguna con valor vacío: un valor vacío es un 422 al guardar (ver el docblock).
    for (const [key, value] of Object.entries(vars)) {
      expect(value, `la variable ${key} quedó vacía`).not.toBe("");
    }
  });
});

describe("earningClauseKey — la clave por modo (spec 0081 §2)", () => {
  it("`per_amount` elige la plantilla del monto; `per_purchase` la de siempre", () => {
    expect(earningClauseKey("per_amount")).toBe("earning_per_amount");
    expect(earningClauseKey("per_purchase")).toBe("earning");
  });

  /** Fail-safe: cualquier cosa que no sea `per_amount` cae al texto sin dinero, que es el
   * único que no puede tirar el 422 del valor vacío. */
  it("nulo, vacío o desconocido caen a `earning`", () => {
    expect(earningClauseKey(null)).toBe("earning");
    expect(earningClauseKey(undefined)).toBe("earning");
    expect(earningClauseKey("")).toBe("earning");
    expect(earningClauseKey("per_amount_x")).toBe("earning");
  });
});
