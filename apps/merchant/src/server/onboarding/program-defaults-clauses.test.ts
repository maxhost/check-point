import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Spec 0080 §1 — **`clauses: []` NO ES LO MISMO QUE OMITIR `clauses`.**
 *
 * El contrato de la 0079 declara las dos mitades: un `clauses: []` explícito se va al 422
 * «Añade al menos una cláusula de términos.» —es lo que el cliente pidió al mandarlo
 * vacío— y un cuerpo SIN la clave recibe las semillas del país del negocio. Hasta esta spec
 * eso lo sostenía **un solo carácter** (`!== undefined` en `program-defaults.ts:177`):
 * cambiarlo a truthy hacía que un `clauses: []` recibiera las semillas y **creara** el
 * programa, y ningún test del repo se ponía rojo.
 *
 * **Va sobre `programInput` y NO sobre `composeProgramInput`**: cuando se llama al
 * compositor la decisión de sembrar ya está tomada (recibe los ids, o `null`), así que el
 * compositor no puede pinnear este invariante. Y va con dobles y no contra Neon porque las
 * dos únicas dependencias de base de `programInput` son `ownerBusiness` y la consulta de
 * `wizardClauseTemplateIds`.
 *
 * **LÍMITE MEDIDO —intentado, no supuesto— sobre la tercera aserción:** `programInput` llama
 * a `wizardClauseTemplateIds` por su binding **local** (las dos viven en el mismo módulo),
 * así que un `vi.mock` de ese export NO intercepta la llamada: el doble queda en cero
 * llamadas incluso cuando la función real corre, y un `not.toHaveBeenCalled()` sobre él
 * pasaría SIEMPRE. El espía que sí mide el corto-circuito es `getDb`, que es el único efecto
 * de esa función: cero consultas ⇒ no se llamó. Su control positivo es el caso de abajo, que
 * exige `getDb` llamado UNA vez.
 */
const world = vi.hoisted(() => ({
  ownerBusiness: vi.fn(),
  getDb: vi.fn(),
}));

vi.mock("../loyalty-program/owner", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../loyalty-program/owner")>()),
  ownerBusiness: world.ownerBusiness,
}));

vi.mock("../db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../db")>()),
  getDb: world.getDb,
}));

import { LoyaltyError } from "../loyalty-program/core";
import { validateProgramInput } from "../loyalty-program/validation";
import { composedAccrualMode, programInput } from "./program-defaults";

/**
 * Lo que la consulta doblada devuelve: un scope `EC` COMPLETO.
 *
 * **Las TRES claves desde la spec 0081 §2**: `earning` y `earning_per_amount` son las dos
 * cláusulas de acumulación posibles y el `accrual.mode` elige una. Con las tres puestas, el
 * segundo `describe` de este archivo puede distinguir cuál se eligió por el ID.
 */
const SEEDS = [
  { id: "seed-ec-earning", key: "earning", jurisdictionScope: "EC" },
  {
    id: "seed-ec-earning-monto",
    key: "earning_per_amount",
    jurisdictionScope: "EC",
  },
  { id: "seed-ec-redemption", key: "redemption", jurisdictionScope: "EC" },
];

const SELLOS_CORTO = {
  kind: "stamps",
  configuration: { target: 8 },
  rewards: [{ type: "custom", label: "Café gratis" }],
};

/**
 * El oráculo del 422 es el MENSAJE y no el status: con las semillas puestas por error el
 * cuerpo es válido y no hay status que mirar, y con otro 422 (el del premio, el del
 * `accrual`) el número sería el mismo. El mensaje es lo que distingue la causa.
 */
const messageOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return error instanceof LoyaltyError ? error.message : "no-LoyaltyError";
  }
  return "no tiró";
};

const compose = async (partial: Record<string, unknown>) =>
  (await programInput(partial, "user-0080")) as Record<string, unknown>;

describe("programInput — `clauses: []` no es omitir `clauses` (spec 0080 §1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    world.ownerBusiness.mockResolvedValue({ countryCode: "EC" });
    world.getDb.mockReturnValue({
      select: () => ({ from: () => ({ where: async () => SEEDS }) }),
    });
  });

  it("un `clauses: []` explícito NO recibe semillas, y el validador real lo manda al 422", async () => {
    const composed = await compose({ ...SELLOS_CORTO, clauses: [] });
    expect(composed.clauses).toEqual([]);
    expect(messageOf(() => validateProgramInput(composed))).toBe(
      "Añade al menos una cláusula de términos.",
    );
  });

  /**
   * CONTROL POSITIVO, y es lo que le da valor al caso de arriba: sin él, un compositor que
   * nunca sembrara nada dejaría ese `toEqual([])` en verde. Y es también el control del
   * espía: prueba que `getDb` está cableado y que el camino de semillas lo usa.
   */
  it("SIN la clave `clauses`, el cuerpo corto recibe las semillas del país", async () => {
    const composed = await compose({ ...SELLOS_CORTO });
    expect(composed.clauses).toEqual([
      { templateId: "seed-ec-earning" },
      { templateId: "seed-ec-redemption" },
    ]);
    expect(world.ownerBusiness).toHaveBeenCalledWith("user-0080");
    expect(world.getDb).toHaveBeenCalledTimes(1);
  });

  /**
   * **LO QUE EL CARÁCTER `!== undefined` SOSTIENE DE VERDAD, y no es el `[]`** (hallazgo
   * medido de la 0080: la spec —y el revisor de la 0079— afirmaban que cambiar la línea 177
   * a `if (partial.clauses)` hacía que un `clauses: []` recibiera las semillas. **Es FALSO:
   * un array vacío es TRUTHY en JS**, así que para `[]` las dos formas deciden lo mismo y esa
   * mutación es un no-op — medido, ver la bitácora). Lo que sí distingue `!== undefined` de
   * un truthy es un `clauses` **FALSY pero PRESENTE**: con `null`, el truthy se va a buscar
   * las semillas y **crea el programa** que el cliente no pidió; con `!== undefined` el `null`
   * viaja intacto y muere en el 422 del validador. Este es el caso que muerde esa mutación.
   */
  it("un `clauses: null` tampoco se reemplaza por semillas: viaja intacto al 422", async () => {
    const composed = await compose({ ...SELLOS_CORTO, clauses: null });
    expect(composed.clauses).toBeNull();
    expect(messageOf(() => validateProgramInput(composed))).toBe(
      "Las cláusulas deben ser una lista de hasta 12 textos.",
    );
    expect(world.getDb).not.toHaveBeenCalled();
  });

  /**
   * LA ASERCIÓN FUERTE: prueba que el corto-circuito EXISTE, no sólo que la salida coincide.
   * Y de paso documenta el ahorro que el contrato promete: con `clauses` en el cuerpo, el
   * `PUT` no paga ninguna de las dos lecturas del compositor.
   */
  it("con `clauses: []` no hay NI UNA consulta: ni el negocio ni las semillas", async () => {
    await compose({ ...SELLOS_CORTO, clauses: [] });
    expect(world.ownerBusiness).not.toHaveBeenCalled();
    expect(world.getDb).not.toHaveBeenCalled();
  });
});

/**
 * Spec 0081 §2 — **QUÉ CLÁUSULA DE ACUMULACIÓN LE TOCA AL PROGRAMA, decidido por el
 * `accrual.mode` que el compositor deja puesto** (no por el del cuerpo crudo).
 *
 * Los dos casos son la misma propiedad por sus dos lados, y hace falta el par: con un solo
 * caso, una implementación que devolviera siempre la misma clave pasaría la mitad.
 *
 * **Por qué el modo EFECTIVO y no el del cuerpo:** el cuerpo corto de Sellos **no manda
 * `accrual`** —lo completa el compositor con `per_purchase`—, así que leer el cuerpo crudo
 * daría `undefined` para el caso más común del alta. `composedAccrualMode` deriva el valor
 * del compositor mismo para que no puedan divergir.
 */
describe("programInput — la cláusula de acumulación por modo (spec 0081 §2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    world.ownerBusiness.mockResolvedValue({ countryCode: "EC" });
    world.getDb.mockReturnValue({
      select: () => ({ from: () => ({ where: async () => SEEDS }) }),
    });
  });

  it("el cuerpo corto (sin `accrual`) recibe la cláusula SIN monto", async () => {
    const composed = await compose({ ...SELLOS_CORTO });
    expect(composed.accrual).toEqual({
      mode: "per_purchase",
      grant: 1,
      blockAmount: null,
    });
    expect(composed.clauses).toEqual([
      { templateId: "seed-ec-earning" },
      { templateId: "seed-ec-redemption" },
    ]);
  });

  it("un `accrual` `per_amount` explícito recibe la cláusula DEL MONTO", async () => {
    const composed = await compose({
      ...SELLOS_CORTO,
      accrual: { mode: "per_amount", grant: 1, blockAmount: "5.00" },
    });
    // El `accrual` explícito no se pisa (spec 0079) y ADEMÁS mueve el TOS.
    expect(composed.accrual).toEqual({
      mode: "per_amount",
      grant: 1,
      blockAmount: "5.00",
    });
    expect(composed.clauses).toEqual([
      { templateId: "seed-ec-earning-monto" },
      { templateId: "seed-ec-redemption" },
    ]);
  });
});

/**
 * `composedAccrualMode` suelta: es lo que traduce «lo que mandó el cliente» a «el modo con el
 * que se elige la cláusula», y su caso raro es Puntos — que NO recibe default y por eso queda
 * en `null` (su 422 lo tira el validador, no el TOS).
 */
describe("composedAccrualMode (spec 0081 §2)", () => {
  it("Sellos corto → `per_purchase`; explícito → el del cuerpo; Puntos corto → null", () => {
    expect(composedAccrualMode({ ...SELLOS_CORTO })).toBe("per_purchase");
    expect(
      composedAccrualMode({
        ...SELLOS_CORTO,
        accrual: { mode: "per_amount", grant: 2, blockAmount: "3.00" },
      }),
    ).toBe("per_amount");
    expect(composedAccrualMode({ kind: "points" })).toBeNull();
  });
});
