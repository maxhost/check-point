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
  return sourceFiles(DB_MODULES).flatMap(schemaExportsOf);
}

function schemaExportsOf(file: string): string[] {
  return [
    ...readFileSync(file, "utf8").matchAll(/export\s+const\s+(\w+)/g),
  ].map((m) => m[1]);
}

/**
 * Spec 0220 (revision de la 2a) — los esquemas de modulo que `file` alcanza SIN pasar por el barril:
 * el especificador `@mi-pasaporte/db/schema/modules/<id>` (import o re-export) o una ruta relativa
 * que cae en `packages/db/src/schema/modules/`. Devuelve los `<id>` (nombre del archivo).
 */
export function directSchemaModules(file: string): string[] {
  const viaPackage = specifiers(readFileSync(file, "utf8"))
    .map((s) =>
      s.match(/^@mi-pasaporte\/db\/schema\/modules\/([^/]+?)(?:\.ts)?$/),
    )
    .filter((m) => m !== null)
    .map((m) => m[1]);
  const viaRelative = importsInto(file, DB_MODULES).map((target) =>
    target.slice(DB_MODULES.length + 1).replace(/\.ts$/, ""),
  );
  return [...viaPackage, ...viaRelative];
}

/** Spec 0220 — de que modulo es cada tabla del barril: `schema/modules/<id>.ts` → `<id>`. */
export function schemaExportOwners(): Map<string, string> {
  const owners = new Map<string, string>();
  for (const file of sourceFiles(DB_MODULES)) {
    const id = file.slice(DB_MODULES.length + 1).replace(/\.ts$/, "");
    for (const name of schemaExportsOf(file)) owners.set(name, id);
  }
  return owners;
}

const IMPORT_FROM_SCHEMA =
  /(?:import|export)\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["']@mi-pasaporte\/db\/schema["']/g;

/** Los nombres que `source` importa (o re-exporta) del barril `@mi-pasaporte/db/schema`. */
export function namesFromSchemaBarrel(source: string): string[] {
  return [...source.matchAll(IMPORT_FROM_SCHEMA)].flatMap((m) =>
    m[1]
      .split(",")
      .map(
        (name) =>
          name
            .trim()
            .replace(/^type\s+/, "")
            .split(/\s+as\s+/)[0],
      )
      .filter(Boolean),
  );
}

/** El core de merchant: todo `apps/merchant/src` fuera de `src/modules/`. */
export const coreMerchantFiles = () =>
  sourceFiles(SRC).filter((f) => !inside(f, MODULES_DIR));

/** Los tres registros: la unica pieza del core de modulos que nombra modulos (a proposito). */
export const REGISTRIES = [
  "registry.ts",
  "server-registry.ts",
  "ui-registry.ts",
];

/**
 * Spec 0220 (revision de la 2a) — EL CORE DE MODULOS que no es un registro: `modules/*.ts` sin los
 * tres registros, sin tests y sin los soportes de test (`*-support.ts`). Para la regla 2 es core:
 * `activation.ts`, `guard.ts`, `dispatch.ts`, `start-page.ts`… no pueden nombrar un modulo.
 */
export const coreOfModulesFiles = () =>
  readdirSync(MODULES_DIR)
    .filter(
      (name) =>
        /\.tsx?$/.test(name) &&
        !REGISTRIES.includes(name) &&
        !/\.test\.tsx?$/.test(name) &&
        !/-support\.ts$/.test(name),
    )
    .map((name) => join(MODULES_DIR, name));

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

/**
 * Spec 0220 / ADR 0141 §9, regla 2 ampliada — los literales que usan el PERMISO `perm` de un
 * modulo: `includes("<perm>")`, una comparacion contra `"<perm>"` de algo que se llama permiso o
 * alcance (`permission`, `x.permissions[0]`, `scope`, `perm`, en los dos ordenes) y la propiedad
 * `permission: "<perm>"`.
 *
 * Lo que NO ve (proxy sintactico): una comparacion contra un nombre que no dice permiso
 * (`effective[0] === "pos"`, `p === "pos"`), un `Set.has("pos")`, el permiso en un arreglo literal
 * (`["pos", "counter"]`) y el armado. Lo que deja pasar a proposito: `=== "stock"` sobre algo que no
 * es un permiso (`image.action === "stock"`, la foto de stock del catalogo).
 */
export function permissionLiteralPatterns(perm: string): RegExp[] {
  const q = "[\"'`]";
  const name = escape(perm);
  const subject =
    "\\b(?:[\\w$]+\\.)*(?:\\w*(?:[pP]ermission|[sS]cope)\\w*|perm)(?:\\[\\d+\\])?";
  return [
    new RegExp(`\\.includes\\(\\s*${q}${name}${q}\\s*\\)`, "g"),
    new RegExp(`${subject}\\s*[!=]==?\\s*${q}${name}${q}`, "g"),
    new RegExp(`${q}${name}${q}\\s*[!=]==?\\s*${subject}`, "g"),
    new RegExp(`\\bpermission\\s*:\\s*${q}${name}${q}`, "g"),
  ];
}

/** Cuantas veces `source` nombra a alguno de `perms` como permiso de modulo. */
export function permissionLiteralCount(
  source: string,
  perms: readonly string[],
): number {
  return perms
    .flatMap(permissionLiteralPatterns)
    .reduce((total, re) => total + [...source.matchAll(re)].length, 0);
}

/** El codigo sin comentarios: bloques barra-asterisco, lineas que empiezan con doble barra y la
 * doble barra al final de una linea (con un espacio antes, para no cortar un `https://` dentro de un
 * texto). Aproximado: alcanza para que el literal exacto no cuente el id en la prosa de un docblock. */
export function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .map((line) => line.replace(/\s\/\/\s.*$/, ""))
    .join("\n");
}

/**
 * Spec 0220 (revision de la 2a) — el id de un modulo como LITERAL EXACTO (`"pos"`, `'tables'`,
 * `` `recipes` ``) fuera de los comentarios: ve el id pasado como argumento
 * (`isModuleEnabled(b, "pos")`), en un arreglo o en un `case`. Se aplica solo a los ids que NO son
 * tambien una palabra del core (`EXACT_ID_COLLISIONS`).
 */
export function exactIdLiteralCount(
  source: string,
  ids: readonly string[],
): number {
  const code = withoutComments(source);
  return ids.reduce(
    (total, id) =>
      total +
      [...code.matchAll(new RegExp(`["'\`]${escape(id)}["'\`]`, "g"))].length,
    0,
  );
}

/**
 * El id de un modulo usado COMO MODULO aunque sea tambien una palabra del core (`stock`, la foto de
 * stock del catalogo): argumento literal de una funcion cuyo nombre dice modulo
 * (`isModuleEnabled(b, "stock")`, `requireModule(id, "stock")`, `lockModuleEnabled(tx, b, "stock")`,
 * `moduleById("stock")`) o consulta a una coleccion de modulos (`enabledModules.has("stock")`,
 * `modules.includes("stock")`). Fuera de comentarios. No ve una llamada con parentesis anidados
 * antes del literal, una funcion de modulos importada con otro nombre (`import { isModuleEnabled as
 * on }`) ni el id guardado antes en una variable.
 */
export function moduleUseLiteralCount(
  source: string,
  ids: readonly string[],
): number {
  const code = withoutComments(source);
  const q = "[\"'`]";
  return ids.reduce((total, id) => {
    const name = escape(id);
    const patterns = [
      new RegExp(`\\b\\w*[mM]odule\\w*\\s*\\([^()]*?${q}${name}${q}`, "g"),
      new RegExp(
        `\\b\\w*[mM]odules?\\w*\\s*\\.\\s*(?:has|includes)\\(\\s*${q}${name}${q}\\s*\\)`,
        "g",
      ),
    ];
    return (
      total + patterns.reduce((n, re) => n + [...code.matchAll(re)].length, 0)
    );
  }, 0);
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
