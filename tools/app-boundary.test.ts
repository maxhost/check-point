import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// Guard de la spec 0117 (ADR 0109): el codigo de PRODUCCION de merchant no importa nada de
// `apps/consumer`, ni al reves. Son dos proyectos de Vercel: un import cruzado compila en el
// monorepo y arrastra al bundle de una app codigo de la otra.
//
// SOLO LOS TESTS PUEDEN CRUZAR (ADR 0109 §Consecuencias): los escenarios mostrador → cliente
// se quedan en merchant e importan la ruta de `apps/consumer` por ruta relativa. «Test» es un
// `*.test.ts(x)` y tambien un modulo NO-test al que SOLO llegan tests (los `*-support.ts` que
// siembran mundos, p. ej. `server/consumer-cross-support.ts`). Produccion es el cierre de
// imports relativos desde las entradas (ver `productionFiles`).
//
// ES UN BARRIDO ESTATICO: ve `from "<literal>"`, `import "<literal>"` e `import("<literal>")`.
// Un especificador armado en una variable no lo ve, y eso se declara.

const ROOT = join(import.meta.dirname, "..");
const APPS = {
  merchant: join(ROOT, "apps", "merchant", "src"),
  consumer: join(ROOT, "apps", "consumer", "src"),
};
type App = keyof typeof APPS;

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      sourceFiles(full, found);
      continue;
    }
    if (/\.tsx?$/.test(entry.name)) found.push(full);
  }
  return found;
}

const isTestFile = (file: string) => /\.test\.tsx?$/.test(file);
const isFile = (path: string) => existsSync(path) && statSync(path).isFile();

const SPECIFIER = [
  /\bfrom\s*(["'])([^"'\n]+)\1/g,
  /\bimport\s*(["'])([^"'\n]+)\1/g,
  /\bimport\(\s*(["'])([^"'\n]+)\1/g,
];

function specifiers(file: string): string[] {
  const source = readFileSync(file, "utf8");
  return SPECIFIER.flatMap((re) => [...source.matchAll(re)].map((m) => m[2]));
}

/** Como resuelve el bundler un especificador relativo sin extension en este repo. */
function resolveRelative(fromFile: string, specifier: string): string | null {
  const base = join(dirname(fromFile), specifier);
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ]) {
    if (isFile(candidate)) return candidate;
  }
  return null;
}

// Los archivos que Next carga por convencion de nombre: son entrada de produccion aunque solo
// los importen tests (una `route.ts` la importa su test, y la sirve Next).
const NEXT_ENTRY =
  /(?:^|[\\/])(?:page|layout|route|template|loading|error|global-error|not-found|default)\.tsx?$/;
const ROOT_ENTRY = /^(?:proxy|middleware|instrumentation)\.ts$/;

/**
 * Que modulos NO-test de la app son produccion: el cierre de imports relativos desde las
 * entradas — las de Next por convencion, y todo modulo no-test que nadie importa (codigo
 * suelto cuenta como produccion: mejor un falso rojo que un cruce sin ver). Lo que queda
 * afuera solo lo alcanzan tests (los `*-support.ts`).
 */
function productionFiles(appRoot: string, files: string[]): string[] {
  const imports = new Map<string, string[]>();
  const imported = new Set<string>();
  for (const file of files) {
    const targets = specifiers(file)
      .filter((spec) => /^\.{1,2}\//.test(spec))
      .map((spec) => resolveRelative(file, spec))
      .filter((target): target is string => target !== null);
    imports.set(file, targets);
    for (const target of targets) imported.add(target);
  }
  const seeds = files.filter((file) => {
    if (isTestFile(file)) return false;
    const rel = relative(appRoot, file);
    if (NEXT_ENTRY.test(rel) && rel.startsWith(`app${sep}`)) return true;
    if (ROOT_ENTRY.test(rel)) return true;
    return !imported.has(file);
  });
  const production = new Set<string>();
  const queue = [...seeds];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (production.has(file) || isTestFile(file)) continue;
    production.add(file);
    queue.push(...(imports.get(file) ?? []));
  }
  return files.filter((file) => production.has(file));
}

/** Los imports de `file` que caen en la otra app (relativo o por nombre de paquete). */
function crossings(file: string, other: App): string[] {
  const otherRoot = join(ROOT, "apps", other);
  return specifiers(file).filter((spec) => {
    if (
      spec === `@mi-pasaporte/${other}` ||
      spec.startsWith(`@mi-pasaporte/${other}/`)
    )
      return true;
    if (!/^\.{1,2}\//.test(spec)) return false;
    const target = join(dirname(file), spec);
    return target === otherRoot || target.startsWith(`${otherRoot}${sep}`);
  });
}

describe("ninguna app importa codigo de produccion de la otra (spec 0117)", () => {
  const scan = (app: App) => {
    const production = productionFiles(APPS[app], sourceFiles(APPS[app]));
    const other: App = app === "merchant" ? "consumer" : "merchant";
    const offenders = production.flatMap((file) =>
      crossings(file, other).map((spec) => `${relative(ROOT, file)}: ${spec}`),
    );
    return { production, offenders };
  };
  const merchant = scan("merchant");
  const consumer = scan("consumer");

  it("el barrido mira las dos apps, no tres archivos", () => {
    // PISO: un barrido sobre la carpeta equivocada no encuentra nada y pasa en verde.
    expect(merchant.production.length).toBeGreaterThanOrEqual(300);
    expect(consumer.production.length).toBeGreaterThanOrEqual(40);
  });

  it("el detector ve los cruces que SI estan permitidos (tests de merchant → consumer)", () => {
    // Sin esto, un detector roto daria `offenders = []` por no ver nada. Los 8 tests que se
    // quedan en merchant (spec 0117 §8) y su support cruzan a proposito.
    const allowed = sourceFiles(APPS.merchant).filter(
      (file) => crossings(file, "consumer").length > 0,
    );
    expect(allowed.length).toBeGreaterThanOrEqual(8);
    expect(allowed.some((file) => !isTestFile(file))).toBe(true);
  });

  // ORACULO DE M2: un modulo de produccion de merchant que importa de `apps/consumer/src`.
  it("merchant no importa nada de apps/consumer", () => {
    expect(merchant.offenders).toEqual([]);
  });

  it("consumer no importa nada de apps/merchant", () => {
    expect(consumer.offenders).toEqual([]);
  });
});
