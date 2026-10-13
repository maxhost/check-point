import { beforeEach, describe, expect, it, vi } from "vitest";
import { ModuleError } from "./errors";

/**
 * Spec 0216 §Plan 6 — LA DECISION DEL DESPACHADOR DE PANTALLAS (`/backoffice/<id>/…`), sin Next ni
 * base: modulo del registro, pantalla para el path, modulo encendido y owner o permiso de la
 * entrada de menu. Cualquier «no» es `null` (la pagina contesta `notFound()`).
 *
 * Dobles: `requireModule` (encendido) y `ui-registry` (pantallas falsas). El registro es el real.
 */

const h = vi.hoisted(() => ({ requireModule: vi.fn() }));
vi.mock("./guard", () => ({ requireModule: h.requireModule }));
vi.mock("./ui-registry", () => ({
  UI_SCREENS: {
    stock: {
      screens: {
        "": function StockScreen() {
          return null;
        },
      },
    },
    recipes: {
      screens: {
        "": function RecipesScreen() {
          return null;
        },
      },
    },
  },
}));

const { moduleScreen } = await import("./screen");

const viewer = (role: string, permissions: string[]) => ({
  business: { id: "b1" },
  membership: { role, permissions },
});

beforeEach(() => {
  h.requireModule.mockReset();
  h.requireModule.mockResolvedValue(undefined);
});

describe("despachador de pantallas de modulos (spec 0216)", () => {
  it("el owner ve la pantalla principal de un modulo encendido", async () => {
    const screen = await moduleScreen(viewer("owner", []), "stock", []);
    expect(screen?.name).toBe("StockScreen");
    expect(h.requireModule).toHaveBeenCalledWith("b1", "stock");
  });

  it("modulo apagado → null, tambien para el owner", async () => {
    h.requireModule.mockRejectedValue(
      new ModuleError(403, "module_disabled", "apagado"),
    );
    expect(await moduleScreen(viewer("owner", []), "stock", [])).toBeNull();
  });

  it("un integrante necesita el permiso de la entrada (catalog ya no abre Stock)", async () => {
    expect(
      (await moduleScreen(viewer("staff", ["stock"]), "stock", []))?.name,
    ).toBe("StockScreen");
    expect(
      await moduleScreen(viewer("staff", ["catalog"]), "stock", []),
    ).toBeNull();
    expect(
      await moduleScreen(viewer("staff", ["stock"]), "recipes", []),
    ).toBeNull();
  });

  it("modulo inexistente o path sin pantalla → null sin consultar la base", async () => {
    expect(await moduleScreen(viewer("owner", []), "pos", [])).toBeNull();
    expect(
      await moduleScreen(viewer("owner", []), "constructor", []),
    ).toBeNull();
    expect(
      await moduleScreen(viewer("owner", []), "stock", ["nope"]),
    ).toBeNull();
    expect(h.requireModule).not.toHaveBeenCalled();
  });

  it("un error que no es ModuleError (la base caida) se propaga", async () => {
    h.requireModule.mockRejectedValue(new Error("db down"));
    await expect(
      moduleScreen(viewer("owner", []), "stock", []),
    ).rejects.toThrow("db down");
  });
});
