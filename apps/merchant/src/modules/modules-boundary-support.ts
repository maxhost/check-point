import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, sep } from "node:path";

/**
 * Spec 0210 / 0216 — LAS PIEZAS DEL BARRIDO ESTATICO de la frontera core → modulos (ADR 0138 §1,
 * ADR 0139 §7), compartidas por `modules-boundary.test.ts` y `modules-boundary-literals.test.ts`.
 * Sin `expect`: los oraculos viven en los tests.
 *
 * Es un barrido SINTACTICO: ve `from "<literal>"`, `import "<literal>"` e `import("<literal>")`, y
 * literales de texto. Un especificador o una ruta armados en una variable no los ve (declarado en
 * cada test).
 */

export const SRC = join(import.meta.dirname, "..");
export const MODULES_DIR = join(SRC, "modules");
export const APP_DIR = join(SRC, "app");
export const DB_SRC = join(SRC, "..", "..", "..", "packages", "db", "src");
export const DB_MODULES = join(DB_SRC, "schema", "modules");
export const DB_BARREL = join(DB_SRC, "schema.ts");

export function sourceFiles(dir: string, found: string[] = []): string[] {
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

export function specifiers(source: string): string[] {
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

export const inside = (file: string, dir: string) =>
  file === dir || file.startsWith(dir + sep);

/** Los imports relativos de `file` que caen dentro de `dir`. */
export function importsInto(file: string, dir: string): string[] {
  return specifiers(readFileSync(file, "utf8"))
    .filter((s) => s.startsWith("."))
    .map((s) => resolveRelative(file, s))
    .filter((target) => inside(target, dir));
}

/** Los nombres que exportan los esquemas de los modulos (`export const stockItems = …`). */
export function moduleSchemaExports(): string[] {
  return sourceFiles(DB_MODULES).flatMap((file) =>
    [...readFileSync(file, "utf8").matchAll(/export\s+const\s+(\w+)/g)].map(
      (m) => m[1],
    ),
  );
}

/** El core de merchant: todo `apps/merchant/src` fuera de `src/modules/`. */
export const coreMerchantFiles = () =>
  sourceFiles(SRC).filter((f) => !inside(f, MODULES_DIR));

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Los literales que nombran al modulo `id` como modulo (regla 2 del ADR 0139 §7):
 *
 * - una ruta suya entre comillas o backticks: `"/backoffice/<id>…"`, `"/api/modules/<id>…"`;
 * - una comparacion de `segment`, `moduleId` o `id` (tambien `x.id`) contra `"<id>"`, en los dos
 *   ordenes y con `===`, `!==`, `==`, `!=`;
 * - una propiedad `segment: "<id>"`, `moduleId: "<id>"` o `id: "<id>"`.
 *
 * Lo que NO ve (proxy sintactico, `gotchas-del-repo` §barridos): el id armado (`"st" + "ock"`), una
 * ruta construida con una variable que vale `"stock"`, un `switch (segment) { case "stock": … }`,
 * una comparacion contra un nombre distinto de esos tres (`kind === "stock"`) y el id en un
 * comentario. Lo que deja pasar a proposito: `"stock"` como valor que no es un modulo
 * (`image.action === "stock"`, la foto de stock del catalogo).
 */
export function moduleLiteralPatterns(id: string): RegExp[] {
  const q = "[\"'`]";
  const name = escape(id);
  const subject = "(?:[\\w$]+\\.)*(?:segment|moduleId|id)";
  return [
    new RegExp(`${q}/(?:backoffice|api/modules)/${name}(?=[/?#"'\`$])`, "g"),
    new RegExp(`\\b${subject}\\s*[!=]==?\\s*${q}${name}${q}`, "g"),
    new RegExp(`${q}${name}${q}\\s*[!=]==?\\s*${subject}\\b`, "g"),
    new RegExp(`\\b(?:segment|moduleId|id)\\s*:\\s*${q}${name}${q}`, "g"),
  ];
}

/** Cuantas veces `source` nombra a alguno de `ids` como modulo. */
export function moduleLiteralCount(
  source: string,
  ids: readonly string[],
): number {
  return ids
    .flatMap(moduleLiteralPatterns)
    .reduce((total, re) => total + [...source.matchAll(re)].length, 0);
}
