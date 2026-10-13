import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MODULES_DIR,
  SRC,
  directSchemaModules,
  importsInto,
  moduleLiteralPatterns,
  namesFromSchemaBarrel,
  schemaExportOwners,
  sourceFiles,
} from "./modules-boundary-support";
import { MODULES } from "./registry";

/**
 * Spec 0220 / ADR 0141 §5 y §9 — REGLA 7, LA FRONTERA ENTRE MODULOS: un modulo importa solo del
 * core y de los modulos de su `requires` (codigo de `modules/<id>/` y tablas de
 * `schema/modules/<id>.ts` por el barril); nombra como id solo a los de `requires` y `optional`.
 * Con el POS y Mesas: Mesas importa del POS (lo requiere); el POS nombra a Mesas (opcional) pero no
 * importa nada de su carpeta. Se barre `modules/<id>/**` de cada modulo del registro, tests incluidos.
 *
 * Es un barrido SINTACTICO (`gotchas-del-repo` §barridos). Imports: lo mismo que la regla 1 (no ve un
 * especificador armado). Nombres: un literal que es EXACTAMENTE el id de otro modulo (`"tables"`,
 * `'stock'`, `` `recipes` ``) o una de sus rutas / comparaciones de la regla 2; no ve un id armado ni
 * uno dentro de un texto mas largo (`"las tables"`). Un id en un comentario entre backticks SI cuenta:
 * es el precio de ver los literales de plantilla.
 */

const IDS = MODULES.map((m) => m.id);
const q = "[\"'`]";
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Cuantas veces `source` nombra al modulo `id`: literal exacto o las formas de la regla 2. */
function namesModule(source: string, id: string): number {
  const exact = new RegExp(`${q}${escape(id)}${q}`, "g");
  return [exact, ...moduleLiteralPatterns(id)].reduce(
    (total, re) => total + [...source.matchAll(re)].length,
    0,
  );
}

/** El modulo dueño de una ruta dentro de `modules/`, o `null` si es el core de modulos. */
function folderOf(target: string): string | null {
  const rel = relative(MODULES_DIR, target);
  return rel.includes("/") ? rel.split("/")[0] : null;
}

describe("regla 7: entre modulos (ADR 0141 §9)", () => {
  it("el barrido mira: cada modulo del registro tiene archivos y el barril reparte tablas", () => {
    for (const { id } of MODULES)
      expect(sourceFiles(join(MODULES_DIR, id)).length, id).toBeGreaterThan(0);
    const owners = schemaExportOwners();
    expect(owners.get("posOrders")).toBe("pos");
    expect(owners.get("diningTables")).toBe("pos");
    expect(owners.get("stockItems")).toBe("stock");
  });

  it("CONTROL: el literal exacto de otro id cuenta; un texto mas largo no", () => {
    expect(namesModule('isModuleEnabled(id, "tables")', "tables")).toBe(1);
    expect(namesModule("fetch(`/api/modules/stock/items`)", "stock")).toBe(1);
    expect(namesModule('const label = "las tables";', "tables")).toBe(0);
    expect(namesModule('const x = "stocks";', "stock")).toBe(0);
  });

  it("un modulo importa codigo solo del core y de su `requires`", () => {
    const offenders = MODULES.flatMap((m) =>
      sourceFiles(join(MODULES_DIR, m.id)).flatMap((file) =>
        importsInto(file, MODULES_DIR)
          .filter((target) => {
            const owner = folderOf(target);
            return (
              owner !== null && owner !== m.id && !m.requires.includes(owner)
            );
          })
          .map((target) => `${relative(SRC, file)} → ${relative(SRC, target)}`),
      ),
    );
    expect(offenders).toEqual([]);
  });

  it("un modulo importa tablas (por el barril) solo de las suyas y de su `requires`", () => {
    const owners = schemaExportOwners();
    const offenders = MODULES.flatMap((m) =>
      sourceFiles(join(MODULES_DIR, m.id)).flatMap((file) =>
        namesFromSchemaBarrel(readFileSync(file, "utf8"))
          .filter((name) => {
            const owner = owners.get(name);
            return (
              owner !== undefined &&
              owner !== m.id &&
              !m.requires.includes(owner)
            );
          })
          .map((name) => `${relative(SRC, file)} → ${name}`),
      ),
    );
    expect(offenders).toEqual([]);
  });

  it("un modulo importa tablas DIRECTO (`@mi-pasaporte/db/schema/modules/<id>`, o por ruta relativa) solo de las suyas y de su `requires`", () => {
    const offenders = MODULES.flatMap((m) =>
      sourceFiles(join(MODULES_DIR, m.id)).flatMap((file) =>
        directSchemaModules(file)
          .filter((owner) => owner !== m.id && !m.requires.includes(owner))
          .map((owner) => `${relative(SRC, file)} → schema/modules/${owner}`),
      ),
    );
    expect(offenders).toEqual([]);
  });

  it("CONTROL de tablas: el especificador directo y el re-export del barril se ven", () => {
    const owners = schemaExportOwners();
    expect(
      namesFromSchemaBarrel(
        'export { stockItems } from "@mi-pasaporte/db/schema";',
      ).map((name) => owners.get(name)),
    ).toEqual(["stock"]);
    const file = join(MODULES_DIR, "pos", "server", "best-sellers.ts");
    expect(directSchemaModules(file)).toEqual([]);
  });

  it("un modulo nombra como id solo a los de `requires` y `optional`", () => {
    const found: Record<string, number> = {};
    for (const m of MODULES) {
      const allowed = new Set([m.id, ...m.requires, ...(m.optional ?? [])]);
      const others = IDS.filter((id) => !allowed.has(id));
      for (const file of sourceFiles(join(MODULES_DIR, m.id))) {
        const source = readFileSync(file, "utf8");
        const count = others.reduce(
          (total, id) => total + namesModule(source, id),
          0,
        );
        if (count > 0) found[relative(SRC, file)] = count;
      }
    }
    expect(found).toEqual({});
  });
});
