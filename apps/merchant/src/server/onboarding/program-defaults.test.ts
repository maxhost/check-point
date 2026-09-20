import { describe, expect, it } from "vitest";
import { LoyaltyError } from "../loyalty-program/core";
import { validateProgramInput } from "../loyalty-program/validation";
import {
  DEFAULT_STAMP_UNIT_NAME,
  DEFAULT_STAMP_UNIT_PLURAL,
  composeProgramInput,
  programInput,
  resolveWizardClauseIds,
} from "./program-defaults";

/**
 * Spec 0079 §3 — EL COMPOSITOR: cuerpo corto adentro, `ProgramInput` completo afuera.
 *
 * El oraculo mas fuerte de este archivo no es contar claves: es pasarle lo compuesto a
 * **`validateProgramInput`, el validador real de `saveProgram`**. Si la composicion se
 * olvidara de las clausulas, del `unitName` o del premio, ese validador tira 422 y el
 * test se pone rojo por la propiedad correcta, no por una forma que inventamos aca.
 *
 * Y su espejo, que es la mitad que la 0079 agrega: **lo que el servidor NO puede completar
 * con seguridad tiene que seguir faltando**. El `accrual` de Puntos lleva un monto de
 * dinero y no tiene default posible; si el compositor lo inventara, el 422 desaparece y el
 * comercio se encuentra con una mecanica que nadie eligio.
 */
const TEMPLATE_IDS = [
  "9d4a3a05-2a87-4d12-8a99-e1a59e3cf101",
  "9d4a3a05-2a87-4d12-8a99-e1a59e3cf102",
];

const statusOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return error instanceof LoyaltyError ? error.status : "no-LoyaltyError";
  }
  return "no tiró";
};

const SELLOS_CORTO = {
  kind: "stamps",
  configuration: { target: 8 },
  rewards: [{ type: "custom", label: "Café gratis" }],
};

const PUNTOS = {
  kind: "points",
  configuration: { unitSingular: "punto", unitPlural: "puntos" },
  accrual: { mode: "per_amount", grant: 10, blockAmount: 5 },
  rewards: [{ type: "custom", label: "Café gratis", pointsCost: 100 }],
};

const messageOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return error instanceof LoyaltyError ? error.message : "no-LoyaltyError";
  }
  return "no tiró";
};

describe("composeProgramInput — SELLOS (spec 0079 §2)", () => {
  const composed = composeProgramInput(SELLOS_CORTO, TEMPLATE_IDS);

  it("completa cláusulas, el par de la unidad y «un sello por compra»", () => {
    expect(composed.clauses).toEqual([
      { templateId: TEMPLATE_IDS[0] },
      { templateId: TEMPLATE_IDS[1] },
    ]);
    expect(composed.configuration).toEqual({
      unitName: DEFAULT_STAMP_UNIT_NAME,
      unitPlural: DEFAULT_STAMP_UNIT_PLURAL,
      target: 8,
    });
    expect(composed.accrual).toEqual({
      mode: "per_purchase",
      grant: 1,
      blockAmount: null,
    });
    // El premio NO se inventa: viaja tal cual vino.
    expect(composed.rewards).toEqual(SELLOS_CORTO.rewards);
  });

  it("lo compuesto PASA el validador real de saveProgram", () => {
    const validated = validateProgramInput(composed);
    expect(validated.kind).toBe("stamps");
    expect(validated.clauses).toHaveLength(2);
    expect(validated.rewards).toHaveLength(1);
    expect(validated.rewards[0].label).toBe("Café gratis");
    expect(validated.rewards[0].pointsCost).toBeNull();
    // El plural SOBREVIVE a `normalizeConfiguration`: si se cayera ahi, el TOS
    // volveria a decir «Los sello» sin que nada mas se ponga rojo (spec 0078).
    expect(validated.configuration).toEqual({
      unitName: DEFAULT_STAMP_UNIT_NAME,
      unitPlural: DEFAULT_STAMP_UNIT_PLURAL,
      target: 8,
    });
    expect(validated.accrual).toEqual({
      mode: "per_purchase",
      grant: 1,
      blockAmount: null,
    });
    // El wizard no sube imagen: de acá sale el placeholder (spec 0069 §D5).
    expect(validated.stampAction).toBe("keep");
  });

  it("sin cláusulas, el validador real lo RECHAZA (por eso las semillas son obligatorias)", () => {
    expect(
      statusOf(() =>
        validateProgramInput(composeProgramInput(SELLOS_CORTO, [])),
      ),
    ).toBe(422);
  });
});

/**
 * **NADA EXPLICITO SE PISA** (mutación M3 de la 0079). Es la propiedad que hace que «un
 * cuerpo completo de hoy siga dando el mismo resultado»: el compositor sólo rellena huecos.
 */
describe("composeProgramInput — un campo explícito nunca se pisa (spec 0079 §2)", () => {
  it("respeta el `accrual` que vino en el cuerpo", () => {
    const accrual = { mode: "per_amount", grant: 2, blockAmount: 10 };
    expect(
      composeProgramInput({ ...SELLOS_CORTO, accrual }, TEMPLATE_IDS).accrual,
    ).toEqual(accrual);
  });

  it("respeta las `clauses` del cuerpo: con `null` no hay semillas que poner", () => {
    const clauses = [{ text: "Cláusula propia del comercio." }];
    expect(
      composeProgramInput({ ...SELLOS_CORTO, clauses }, null).clauses,
    ).toEqual(clauses);
  });

  /**
   * **El par de la unidad se completa JUNTO, no campo por campo.** Un cuerpo que nombra su
   * unidad («visita») y omite el plural conserva el comportamiento de antes de la 0079 —el
   * TOS cae al singular— en vez de recibir «sellos», que sería el plural de OTRA unidad en
   * el texto legal que ve el consumidor.
   */
  it("con `unitName` propio, el plural NO se fuerza a «sellos»", () => {
    const configuration = { unitName: "visita", target: 8 };
    expect(
      composeProgramInput({ ...SELLOS_CORTO, configuration }, TEMPLATE_IDS)
        .configuration,
    ).toEqual(configuration);
  });

  it("con `unitPlural` propio y sin `unitName`, gana el del cuerpo", () => {
    expect(
      composeProgramInput(
        {
          ...SELLOS_CORTO,
          configuration: { target: 8, unitPlural: "visitas" },
        },
        TEMPLATE_IDS,
      ).configuration,
    ).toEqual({
      unitName: DEFAULT_STAMP_UNIT_NAME,
      unitPlural: "visitas",
      target: 8,
    });
  });
});

/**
 * PUNTOS (ADR 0076 §6, spec 0079 §2). La API no niega una modalidad que el dominio
 * soporta porque la pantalla no exista todavía.
 */
describe("composeProgramInput — PUNTOS (spec 0079 §2)", () => {
  it("no recibe NI UN default de Sellos, y pasa el validador real", () => {
    const composed = composeProgramInput(PUNTOS, TEMPLATE_IDS);
    expect(composed.configuration).toEqual(PUNTOS.configuration);
    expect(composed.accrual).toEqual(PUNTOS.accrual);
    const validated = validateProgramInput(composed);
    expect(validated.kind).toBe("points");
    expect(validated.accrual).toEqual({
      mode: "per_amount",
      grant: 10,
      blockAmount: "5.00",
    });
    expect(validated.rewards[0].pointsCost).toBe(100);
  });

  /**
   * **EL 422 DEL DINERO, y es la mutación M2.** `validateAccrual` fuerza `per_amount` para
   * Puntos, que exige un `blockAmount > 0`: un MONTO. «X puntos por cada $Y» no tiene
   * default seguro y el servidor no lo inventa.
   */
  it("SIN `accrual` el compositor no lo inventa y el validador tira 422", () => {
    const sinAccrual: Record<string, unknown> = { ...PUNTOS };
    delete sinAccrual.accrual;
    const composed = composeProgramInput(sinAccrual, TEMPLATE_IDS);
    expect(composed.accrual).toBeUndefined();
    expect(statusOf(() => validateProgramInput(composed))).toBe(422);
  });
});

/**
 * `cashback` y `tiers` están en el CHECK del esquema pero NO en `enabledKinds`: habilitarlas
 * es trabajo de DOMINIO, no de contrato (ADR 0076 §6). Es la mutación M4, y el oráculo es
 * **el mensaje**: con `cashback` habilitado el status seguiría siendo 422 —por el `accrual`
 * que falta— y un test que sólo mirara el número quedaría verde.
 */
describe("composeProgramInput — las modalidades que NO están (spec 0079)", () => {
  it.each(["cashback", "tiers"])(
    "%s → 422 «modalidad no disponible»",
    (kind) => {
      const composed = composeProgramInput(
        { ...SELLOS_CORTO, kind },
        TEMPLATE_IDS,
      );
      expect(messageOf(() => validateProgramInput(composed))).toBe(
        "Esta modalidad todavía no está disponible.",
      );
    },
  );
});

/**
 * `programInput` con un cuerpo que NO es objeto: vuelve tal cual, **sin tocar la base**
 * (por eso este caso es unitario y no de integración). El 422 lo tira `validateProgramInput`
 * adentro de `saveProgram`; repetir ese chequeo acá serían dos reglas para lo mismo.
 */
describe("programInput — un cuerpo que no es objeto (spec 0079 §3)", () => {
  it.each([[null], [[]], ["target=8"], [42]])(
    "%j vuelve intacto y el validador real lo rechaza con 422",
    async (raw) => {
      expect(await programInput(raw, "user-1")).toBe(raw);
      expect(statusOf(() => validateProgramInput(raw))).toBe(422);
    },
  );
});

/**
 * El 503 sin base: `resolveWizardClauseIds` es la traduccion `null` → `LoyaltyError`, y
 * es lo que garantiza que NUNCA se componga un programa sin terminos.
 *
 * **Por que este caso NO tiene gemelo contra Neon:** `termsScopeCandidates` siempre
 * appendea `"default"` al final, asi que con las semillas puestas el 503 es inalcanzable
 * **por construccion** para cualquier pais. El contrato de la RUTA para ese 503 —el
 * `code` y que `saveProgram` no se llame— lo pinnea `onboarding-program-503.test.ts` con
 * dobles. Lo unico declarado afuera es «una base real sin semillas».
 */
describe("resolveWizardClauseIds (spec 0078 §3)", () => {
  const rows = [
    { id: "ec-1", key: "earning", jurisdictionScope: "EC" },
    { id: "ec-2", key: "redemption", jurisdictionScope: "EC" },
    { id: "def-1", key: "earning", jurisdictionScope: "default" },
    { id: "def-2", key: "redemption", jurisdictionScope: "default" },
  ];

  it("devuelve las dos del primer candidato COMPLETO", () => {
    expect(
      resolveWizardClauseIds(rows, ["EC", "default"], "per_purchase"),
    ).toEqual(["ec-1", "ec-2"]);
    expect(
      resolveWizardClauseIds(rows, ["MX", "default"], "per_purchase"),
    ).toEqual(["def-1", "def-2"]);
  });

  it("con el candidato del pais a medias, NO mezcla: las dos de `default`", () => {
    expect(
      resolveWizardClauseIds(
        rows.filter((row) => row.id !== "ec-2"),
        ["EC", "default"],
        "per_purchase",
      ),
    ).toEqual(["def-1", "def-2"]);
  });

  it("sin ningun candidato completo tira 503, no compone nada", () => {
    expect(
      statusOf(() =>
        resolveWizardClauseIds([], ["EC", "default"], "per_purchase"),
      ),
    ).toBe(503);
    expect(
      statusOf(() =>
        resolveWizardClauseIds(
          rows.filter((row) => row.key === "earning"),
          ["EC", "default"],
          "per_purchase",
        ),
      ),
    ).toBe(503);
  });
});
