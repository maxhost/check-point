import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Guard de la spec 0116 (ADR 0108): todo `vi.mock` / `vi.doMock` con especificador
// RELATIVO apunta a un archivo que existe.
//
// POR QUE: vitest no se queja de un `vi.mock("./x")` cuyo `./x` no existe — registra el
// doble para un modulo que nadie importa y el test sigue corriendo contra el modulo REAL.
// Mover modulos a un paquete (0115, 0116) es justo lo que deja mocks asi: el import del
// test se reescribe al paquete, el `vi.mock` relativo se queda atras y el doble deja de
// doblar sin un solo rojo. Los especificadores de paquete (`@mi-pasaporte/...`) los
// resuelve el typecheck del `import` hermano; los relativos no los ve nadie mas.
//
// ES UN BARRIDO ESTATICO: ve la forma `vi.mock("<literal>")` (comillas simples o dobles,
// con saltos de linea entre el parentesis y el literal). Un especificador armado en una
// variable no lo ve, y eso se declara.

const ROOT = join(import.meta.dirname, "..");

/** `apps/*\/src` y `packages/*\/src`: donde viven los tests de las apps y los paquetes. */
function sourceRoots(): string[] {
  const roots: string[] = [];
  for (const group of ["apps", "packages"]) {
    for (const entry of readdirSync(join(ROOT, group), {
      withFileTypes: true,
    })) {
      const src = join(ROOT, group, entry.name, "src");
      if (entry.isDirectory() && existsSync(src)) roots.push(src);
    }
  }
  return roots;
}

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

const isFile = (path: string) => existsSync(path) && statSync(path).isFile();

/** Como resuelve vitest un especificador relativo sin extension en este repo. */
function resolves(fromFile: string, specifier: string): boolean {
  const base = join(dirname(fromFile), specifier);
  return [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")].some(
    isFile,
  );
}

const MOCK = /vi\.(?:mock|doMock)\(\s*(["'])([^"'\n]+)\1/g;

describe("los vi.mock relativos apuntan a un archivo (spec 0116)", () => {
  const roots = sourceRoots();
  const calls: { file: string; specifier: string }[] = [];
  for (const root of roots) {
    for (const file of sourceFiles(root)) {
      for (const match of readFileSync(file, "utf8").matchAll(MOCK)) {
        calls.push({ file, specifier: match[2] });
      }
    }
  }
  const relativeCalls = calls.filter(({ specifier }) =>
    /^\.{1,2}\//.test(specifier),
  );

  it("el barrido mira las apps y los paquetes, no tres archivos", () => {
    // PISO: un barrido sobre la carpeta equivocada no encuentra nada y pasa en verde.
    expect(calls.length).toBeGreaterThanOrEqual(150);
    expect(relativeCalls.length).toBeGreaterThan(0);
    const rels = roots.map((root) => relative(ROOT, root));
    expect(rels).toContain(join("apps", "merchant", "src"));
    expect(rels).toContain(join("packages", "domain", "src"));
  });

  it("todo especificador relativo resuelve a .ts, .tsx o /index.ts", () => {
    const dangling = relativeCalls
      .filter(({ file, specifier }) => !resolves(file, specifier))
      .map(({ file, specifier }) => `${relative(ROOT, file)}: ${specifier}`);
    expect(dangling).toEqual([]);
  });
});
