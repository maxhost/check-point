import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  APP_DIR,
  DB_BARREL,
  DB_MODULES,
  DB_SRC,
  MODULES_DIR,
  SRC,
  coreMerchantFiles,
  importsInto,
  inside,
  moduleSchemaExports,
  namesFromSchemaBarrel,
  sourceFiles,
  specifiers,
} from "./modules-boundary-support";
import { MODULES } from "./registry";
import { SERVER_MODULES } from "./server-registry";
import { UI_SCREENS } from "./ui-registry";
import { routePermission } from "./dispatch";
import { validPermissions } from "./permissions";

/**
 * Spec 0210 / 0216 — ADR 0138 §1 y ADR 0139 §7 — LA FRONTERA CORE → MODULOS. Reglas 1, 3, 5 y 6
 * (la 2, literales, en `modules-boundary-literals.test.ts`; la 4, FKs, en
 * `modules-fk.neon.integration.test.ts`: necesita la base).
 *
 * 1. Fuera de `src/modules/`, nadie importa de `src/modules/<carpeta>/…` (el codigo de un modulo),
 *    y de `src/modules/*.ts` solo el core de modulos (`CORE_OF_MODULES`): los tres registros, el
 *    guard, la navegacion, los permisos, la activacion, los errores y los dos despachadores.
 * 3. En `packages/db/src`, nada fuera de `schema/modules/` importa de ahi salvo el barril
 *    `schema.ts`; y el core de merchant no importa tablas de un modulo por el barril.
 * 5. Ningun id del registro es un directorio de `app/backoffice/`, `app/api/` o `app/api/modules/`
 *    (Next le da prioridad al segmento fijo y el despachador quedaria tapado).
 * 6. Cada modulo del registro esta en `server-registry` y en `ui-registry` (y nada sobra), toda
 *    ruta resuelve un permiso del catalogo valido, ninguna declara el `PUT` de la base (es el
 *    toggle) y toda entrada de menu tiene pantalla.
 *
 * 1b. Del core de modulos, solo los tres registros (la puerta) importan de la carpeta de un modulo:
 *    sin esta regla, un archivo permitido (p. ej. `navigation.ts`) podia re-exportar codigo de
 *    `stock/` y el core lo importaba en verde (revisor adversarial de la Fase 1, evasion E2).
 *
 * Barrido estatico de imports: un especificador armado en una variable no lo ve. La regla 7 (entre
 * modulos) vive en `modules-boundary-between.test.ts`.
 */

const CORE_OF_MODULES = [
  "registry.ts",
  "server-registry.ts",
  "ui-registry.ts",
  "guard.ts",
  "navigation.ts",
  "permissions.ts",
  "activation.ts",
  "errors.ts",
  "dispatch.ts",
  "screen.ts",
  // Spec 0220 / ADR 0141 §2: la pagina de inicio (PWA e ingreso del personal).
  "start-page.ts",
].map((name) => join(MODULES_DIR, name));

/**
 * REGLA 5 — lista de directorios del core que todavia chocan con un id de modulo. Vacia desde la
 * Fase 1 (spec 0217: las pantallas de Stock y Recetas se mudaron a `modules/<id>/ui/`). Se deja
 * como lista EXACTA: si una migracion futura necesita convivir un tiempo con un directorio viejo,
 * se agrega aca y el test obliga a vaciarla.
 *
 * Spec 0220 (2a): las pantallas del POS siguen en `app/backoffice/pos/` hasta que GPT las mude a
 * `modules/pos/ui/` en la 2b, que baja esta lista a `[]`.
 */
const PENDING_GPT_DIRS: string[] = [];

/**
 * REGLA 1 — los imports del core a la carpeta de un modulo que quedan para la 2b (spec 0220): las
 * pantallas del POS, todavia en el core, importan la impresion que ya se mudo a
 * `modules/pos/ui/printing/`. Cuenta EXACTA; GPT la baja a `[]` al mudar las pantallas.
 */
const PENDING_GPT_IMPORTS: string[] = [];

/**
 * REGLA 6 — entradas de menu sin pantalla que quedan para la 2b (spec 0220): la del POS, que GPT
 * agrega a `ui-registry.ts` al mudar sus pantallas. Lista EXACTA, baja a `[]`.
 */
const PENDING_GPT_SCREENS: string[] = [];

const isDir = (path: string) =>
  existsSync(path) && statSync(path).isDirectory();

describe("frontera core → modulos (ADR 0138 §1, ADR 0139 §7)", () => {
  it("el barrido ve archivos de las tres zonas (piso: un barrido vacio no prueba nada)", () => {
    expect(coreMerchantFiles().length).toBeGreaterThan(500);
    expect(sourceFiles(MODULES_DIR).length).toBeGreaterThan(5);
    expect(sourceFiles(DB_MODULES).length).toBeGreaterThanOrEqual(2);
    expect(moduleSchemaExports()).toEqual(
      expect.arrayContaining(["stockItems", "stockMovements", "recipeLines"]),
    );
    for (const file of CORE_OF_MODULES)
      expect(existsSync(file), file).toBe(true);
  });

  it("REGLA 1: el core solo importa de src/modules/ el core de modulos, nunca codigo de un modulo", () => {
    const offenders = coreMerchantFiles().flatMap((file) =>
      importsInto(file, MODULES_DIR)
        .filter((target) => !CORE_OF_MODULES.includes(target))
        .map((target) => `${relative(SRC, file)} → ${relative(SRC, target)}`),
    );
    expect(offenders.sort()).toEqual(PENDING_GPT_IMPORTS);
  });

  it("REGLA 1b: del core de modulos, solo los tres registros importan de la carpeta de un modulo", () => {
    const registries = [
      "registry.ts",
      "server-registry.ts",
      "ui-registry.ts",
    ].map((name) => join(MODULES_DIR, name));
    const offenders = CORE_OF_MODULES.filter(
      (f) => !registries.includes(f),
    ).flatMap((file) =>
      importsInto(file, MODULES_DIR)
        .filter((target) => relative(MODULES_DIR, target).includes("/"))
        .map((target) => `${relative(SRC, file)} → ${relative(SRC, target)}`),
    );
    expect(offenders).toEqual([]);
  });

  it("REGLA 3: ningun archivo de packages/db/src fuera de schema/modules/ importa de ahi, salvo schema.ts", () => {
    const offenders = sourceFiles(DB_SRC)
      .filter((f) => !inside(f, DB_MODULES) && f !== DB_BARREL)
      .flatMap((file) =>
        importsInto(file, DB_MODULES).map(
          (target) => `${relative(DB_SRC, file)} → ${relative(DB_SRC, target)}`,
        ),
      );
    expect(offenders).toEqual([]);
  });

  it("REGLA 3: el core de merchant no importa tablas de un modulo por el barril de @mi-pasaporte/db", () => {
    const forbidden = new Set(moduleSchemaExports());
    const offenders = coreMerchantFiles().flatMap((file) => {
      const source = readFileSync(file, "utf8");
      const direct = specifiers(source)
        .filter((s) => s.startsWith("@mi-pasaporte/db/schema/modules"))
        .map((s) => `${relative(SRC, file)} → ${s}`);
      const viaBarrel = namesFromSchemaBarrel(source)
        .filter((name) => forbidden.has(name))
        .map((name) => `${relative(SRC, file)} → ${name}`);
      return [...direct, ...viaBarrel];
    });
    expect(offenders).toEqual([]);
  });

  it("REGLA 5: ningun id del registro choca con un directorio de app/backoffice, app/api o app/api/modules", () => {
    const parents = ["backoffice", "api", join("api", "modules")];
    for (const parent of parents)
      expect(isDir(join(APP_DIR, parent))).toBe(true);
    const clashes = MODULES.flatMap(({ id }) =>
      parents
        .map((parent) => join(APP_DIR, parent, id))
        .filter(isDir)
        .map((dir) => relative(SRC, dir)),
    ).sort();
    expect(clashes).toEqual(PENDING_GPT_DIRS);
  });

  it("REGLA 5: los dos despachadores existen (sin ellos no hay a quien tapar)", () => {
    const pages = join(APP_DIR, "backoffice", "[module]", "[[...path]]");
    const api = join(APP_DIR, "api", "modules", "[moduleId]", "[[...path]]");
    expect(existsSync(join(pages, "page.tsx"))).toBe(true);
    expect(existsSync(join(api, "route.ts"))).toBe(true);
    expect(basename(dirname(pages))).toBe("[module]");
  });

  it("REGLA 6: cada modulo del registro esta en server-registry y en ui-registry, y nada sobra", () => {
    const ids = MODULES.map((m) => m.id).sort();
    expect(Object.keys(SERVER_MODULES).sort()).toEqual(ids);
    expect(Object.keys(UI_SCREENS).sort()).toEqual(ids);
  });

  it("REGLA 6: toda ruta resuelve un permiso valido (o es solo del owner) y ninguna declara el PUT de la base (el toggle)", () => {
    const valid = new Set(validPermissions());
    let ownerRoutes = 0;
    for (const manifest of MODULES) {
      for (const route of SERVER_MODULES[manifest.id].routes) {
        const where = `${manifest.id} ${route.method} ${route.path}`;
        expect(route.method === "PUT" && route.path === "", where).toBe(false);
        if (route.owner) {
          // ADR 0141 §7: `owner: true` cambia el permiso por el owner; las dos cosas a la vez
          // serian una declaracion ambigua.
          expect(route.permission, where).toBeUndefined();
          ownerRoutes += 1;
          continue;
        }
        const permission = routePermission(manifest, route);
        expect(permission, where).not.toBeNull();
        expect(valid.has(permission ?? ""), where).toBe(true);
      }
    }
    expect(ownerRoutes).toBeGreaterThan(0);
  });

  it("REGLA 6: toda entrada de menu tiene pantalla (salvo lo pendiente de GPT) y pide un permiso valido", () => {
    const valid = new Set(validPermissions());
    const withoutScreen: string[] = [];
    for (const manifest of MODULES) {
      for (const entry of manifest.navigation) {
        const where = `${manifest.id} /${entry.path}`;
        if (!Object.hasOwn(UI_SCREENS[manifest.id].screens, entry.path))
          withoutScreen.push(where);
        expect(valid.has(entry.permission), where).toBe(true);
      }
    }
    expect(withoutScreen.sort()).toEqual(PENDING_GPT_SCREENS);
  });
});
