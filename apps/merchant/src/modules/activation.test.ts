import { beforeEach, describe, expect, it, vi } from "vitest";
import { ModuleError } from "./errors";
import { MODULES } from "./registry";

/**
 * Spec 0220 / ADR 0141 §4 — EL TOGGLE CORRE `beforeDisable` SOLO AL APAGAR, bajo su lock y DESPUES
 * de `module_required_by`, sin base: la transaccion es un doble que devuelve los modulos encendidos
 * y registra el lock y la escritura. El registro de manifiestos es el real (pos ← tables); las
 * reglas de `server-registry` son espias. Contra Neon y con sus reglas reales:
 * `modules/pos/server/pos-disable.neon.integration.test.ts`.
 */

const h = vi.hoisted(() => ({
  enabled: [] as string[],
  calls: [] as string[],
  posRule: vi.fn(),
  tablesRule: vi.fn(),
  reads: vi.fn(),
}));

vi.mock("@mi-pasaporte/db", async (importOriginal) => {
  const tx = {
    execute: async () => {
      h.calls.push("lock");
      return { rows: [] };
    },
    select: () => {
      h.reads();
      return {
        from: () => ({
          where: () => {
            const rows = h.enabled.map((id) => ({ id, enabled: true }));
            return {
              limit: async () => [{ gcid: null }],
              then: (resolve: (value: unknown) => unknown) => resolve(rows),
            };
          },
        }),
      };
    },
    insert: () => ({
      values: () => ({
        onConflictDoUpdate: async () => {
          h.calls.push("write");
        },
      }),
    }),
  };
  return {
    ...(await importOriginal<typeof import("@mi-pasaporte/db")>()),
    getDb: () => tx,
    withDbTransaction: async (work: (t: unknown) => Promise<unknown>) =>
      work(tx),
  };
});

vi.mock("./server-registry", () => ({
  SERVER_MODULES: {
    stock: { routes: [] },
    recipes: { routes: [] },
    pos: {
      routes: [],
      beforeDisable: async (...args: unknown[]) => {
        h.calls.push("pos-rule");
        return h.posRule(...args);
      },
    },
    tables: { routes: [], beforeDisable: h.tablesRule },
  },
}));

const { setModuleEnabled, listModulesWithCategory, listModules } =
  await import("./activation");

const refusal = new ModuleError(409, "pos_has_open_orders", "x", {
  openCount: 2,
});

beforeEach(() => {
  h.reads.mockClear();
  h.enabled = [];
  h.calls = [];
  h.posRule.mockReset().mockResolvedValue(null);
  h.tablesRule.mockReset().mockResolvedValue(null);
});

describe("toggle con beforeDisable (ADR 0141 §4)", () => {
  it("apagar: la regla corre DESPUES del lock, con la transaccion y el negocio; su error es la respuesta y no escribe", async () => {
    h.enabled = ["pos"];
    h.posRule.mockResolvedValue(refusal);
    await expect(
      setModuleEnabled("b1", "pos", { enabled: false }),
    ).rejects.toBe(refusal);
    expect(h.posRule).toHaveBeenCalledWith(expect.anything(), "b1");
    expect(h.calls).toEqual(["lock", "pos-rule"]);
  });

  it("apagar sin nada que lo impida: la regla dice null y se escribe", async () => {
    h.enabled = ["pos"];
    const dto = await setModuleEnabled("b1", "pos", { enabled: false });
    expect(dto).toMatchObject({ id: "pos", enabled: false });
    expect(h.calls).toEqual(["lock", "pos-rule", "write"]);
  });

  it("`module_required_by` va ANTES: con Mesas encendido, apagar el POS no consulta su regla", async () => {
    h.enabled = ["pos", "tables"];
    h.posRule.mockResolvedValue(refusal);
    await expect(
      setModuleEnabled("b1", "pos", { enabled: false }),
    ).rejects.toMatchObject({
      code: "module_required_by",
      extra: { dependents: ["tables"] },
    });
    expect(h.posRule).not.toHaveBeenCalled();
  });

  it("encender no consulta la regla; apagar uno ya apagado tampoco (idempotente)", async () => {
    await setModuleEnabled("b1", "pos", { enabled: true });
    await setModuleEnabled("b1", "tables", { enabled: false });
    expect(h.posRule).not.toHaveBeenCalled();
    expect(h.tablesRule).not.toHaveBeenCalled();
  });

  it("cada modulo corre SU regla: apagar Mesas no llama a la del POS", async () => {
    h.enabled = ["pos", "tables"];
    await setModuleEnabled("b1", "tables", { enabled: false });
    expect(h.tablesRule).toHaveBeenCalledWith(expect.anything(), "b1");
    expect(h.posRule).not.toHaveBeenCalled();
  });
});

describe("preloaded module category", () => {
  it("uses the supplied category for suggestions without another category read", async () => {
    const category = MODULES.flatMap((m) => m.suggestedFor)[0];
    expect(category).toBeDefined();
    const modules = await listModulesWithCategory("b1", category!);
    expect(modules.map((m) => [m.id, m.suggested])).toEqual(
      MODULES.map((m) => [m.id, m.suggestedFor.includes(category!)]),
    );
    expect(h.reads).toHaveBeenCalledTimes(1);
  });
  it("keeps the legacy DTO and registry order with one read instead of two", async () => {
    h.enabled = ["pos"];
    const expected = await listModules("b1");
    expect(h.reads).toHaveBeenCalledTimes(2);
    h.reads.mockClear();
    expect(await listModulesWithCategory("b1", null)).toEqual(expected);
    expect(h.reads).toHaveBeenCalledTimes(1);
  });
});
