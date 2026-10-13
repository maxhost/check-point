import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Spec 0210 §Frontera / ADR 0138 §1 — EL CORE NUNCA IMPORTA DE UN MODULO.
 *
 * 1. En `apps/merchant/src`, ningun archivo fuera de `src/modules/**` y `src/app/api/modules/**`
 *    importa de `src/modules/` salvo `src/modules/registry` y `src/modules/guard` (las puertas).
 * 2. En `packages/db/src`, ningun archivo fuera de `schema/modules/` importa de `schema/modules/`,
 *    salvo el barril `schema.ts` (drizzle lee un solo archivo).
 * 3. En `apps/merchant/src`, fuera de las mismas dos carpetas, nadie importa del barril
 *    `@mi-pasaporte/db/schema` una tabla de un modulo (ni `@mi-pasaporte/db/schema/modules/*`):
 *    sin esto, el core leeria `stock.item` por el barril sin pasar nunca por `schema/modules/`.
 *
 * Barrido estatico (como `tools/app-boundary.test.ts`): ve `from "<literal>"`, `import "<literal>"`
 * e `import("<literal>")`. Un especificador armado en una variable no lo ve, y eso se declara.
 */

const SRC = join(import.meta.dirname, "..");
const MODULES_DIR = join(SRC, "modules");
const MODULES_API = join(SRC, "app", "api", "modules");
const DB_SRC = join(SRC, "..", "..", "..", "packages", "db", "src");
const DB_MODULES = join(DB_SRC, "schema", "modules");
const DB_BARREL = join(DB_SRC, "schema.ts");
const GATES = [join(MODULES_DIR, "registry.ts"), join(MODULES_DIR, "guard.ts")];

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      sourceFiles(full, found);
    } else if (/\.tsx?$/.test(entry.name)) {
      found.push(full);
    }
  }
  return found;
}

const SPECIFIER = [
  /\bfrom\s*(["'])([^"'\n]+)\1/g,
  /\bimport\s*(["'])([^"'\n]+)\1/g,
  /\bimport\(\s*(["'])([^"'\n]+)\1/g,
];

function specifiers(source: string): string[] {
  return SPECIFIER.flatMap((re) => [...source.matchAll(re)].map((m) => m[2]));
}

const isFile = (path: string) => existsSync(path) && statSync(path).isFile();

/** Como resuelve el bundler un relativo sin extension. Si no resuelve, la ruta base (igual cuenta). */
function resolveRelative(fromFile: string, specifier: string): string {
  const base = join(dirname(fromFile), specifier);
  for (const candidate of [
    `${base}.ts`,
    `${base}.tsx`,
    base,
    join(base, "index.ts"),
  ]) {
    if (isFile(candidate)) return candidate;
  }
  return base;
}

const inside = (file: string, dir: string) =>
  file === dir || file.startsWith(dir + sep);

/** Los imports relativos de `file` que caen dentro de `dir`. */
function importsInto(file: string, dir: string): string[] {
  return specifiers(readFileSync(file, "utf8"))
    .filter((s) => s.startsWith("."))
    .map((s) => resolveRelative(file, s))
    .filter((target) => inside(target, dir));
}

/** Los nombres que exportan los esquemas de los modulos (`export const stockItems = …`). */
function moduleSchemaExports(): string[] {
  return sourceFiles(DB_MODULES).flatMap((file) =>
    [...readFileSync(file, "utf8").matchAll(/export\s+const\s+(\w+)/g)].map(
      (m) => m[1],
    ),
  );
}

const IMPORT_FROM_SCHEMA =
  /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["']@mi-pasaporte\/db\/schema["']/g;

const coreMerchantFiles = () =>
  sourceFiles(SRC).filter(
    (f) => !inside(f, MODULES_DIR) && !inside(f, MODULES_API),
  );

describe("frontera core → modulos (ADR 0138 §1)", () => {
  it("el barrido ve archivos de las tres zonas (piso: un barrido vacio no prueba nada)", () => {
    expect(coreMerchantFiles().length).toBeGreaterThan(500);
    expect(sourceFiles(MODULES_DIR).length).toBeGreaterThan(5);
    expect(sourceFiles(DB_MODULES).length).toBeGreaterThanOrEqual(2);
    expect(moduleSchemaExports()).toEqual(
      expect.arrayContaining(["stockItems", "stockMovements", "recipeLines"]),
    );
  });

  it("el core de merchant solo importa de src/modules/ el registro y el guard", () => {
    const offenders = coreMerchantFiles().flatMap((file) =>
      importsInto(file, MODULES_DIR)
        .filter((target) => !GATES.includes(target))
        .map((target) => `${relative(SRC, file)} → ${relative(SRC, target)}`),
    );
    expect(offenders).toEqual([]);
  });

  it("ningun archivo de packages/db/src fuera de schema/modules/ importa de ahi, salvo schema.ts", () => {
    const offenders = sourceFiles(DB_SRC)
      .filter((f) => !inside(f, DB_MODULES) && f !== DB_BARREL)
      .flatMap((file) =>
        importsInto(file, DB_MODULES).map(
          (target) => `${relative(DB_SRC, file)} → ${relative(DB_SRC, target)}`,
        ),
      );
    expect(offenders).toEqual([]);
  });

  it("el core de merchant no importa tablas de un modulo por el barril de @mi-pasaporte/db", () => {
    const forbidden = new Set(moduleSchemaExports());
    const offenders = coreMerchantFiles().flatMap((file) => {
      const source = readFileSync(file, "utf8");
      const direct = specifiers(source)
        .filter((s) => s.startsWith("@mi-pasaporte/db/schema/modules"))
        .map((s) => `${relative(SRC, file)} → ${s}`);
      const viaBarrel = [...source.matchAll(IMPORT_FROM_SCHEMA)].flatMap((m) =>
        m[1]
          .split(",")
          .map(
            (name) =>
              name
                .trim()
                .replace(/^type\s+/, "")
                .split(/\s+as\s+/)[0],
          )
          .filter((name) => forbidden.has(name))
          .map((name) => `${relative(SRC, file)} → ${name}`),
      );
      return [...direct, ...viaBarrel];
    });
    expect(offenders).toEqual([]);
  });
});
