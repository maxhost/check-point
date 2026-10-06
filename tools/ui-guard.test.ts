import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseChanges, runGuard } from "./ui-guard.ts";

/** Spec 0164: el trinquete contra un repo git de verdad (base en `main`, cambios encima). */
const A = "apps/merchant/src/app/backoffice/a.tsx";
const B = "apps/merchant/src/app/backoffice/b.tsx";
const one = "export const A = () => <button>a</button>;\n";
const two =
  "export const A = () => (<div><button>a</button><button>b</button></div>);\n";
const none = "export const A = () => <div>a</div>;\n";

let root: string;
const git = (...args: string[]) => {
  const r = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr);
};
const write = (path: string, text: string) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
};
const guard = () => runGuard(root, "main");
const categories = () =>
  guard().violations.map((v) => `${v.path} ${v.category}`);

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "ui-guard-"));
  git("init", "-q", "-b", "main");
  git("config", "user.email", "t@t");
  git("config", "user.name", "t");
  write(A, one);
  git("add", ".");
  git("commit", "-qm", "base");
  git("checkout", "-qb", "work");
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("runGuard (trinquete)", () => {
  it("sin cambios: nada que comparar", () => {
    expect(guard()).toEqual({ files: 0, violations: [] });
  });

  it("archivo con un <button> mas → aumento de native-element", () => {
    write(A, two);
    git("commit", "-qam", "mas");
    expect(guard().violations).toEqual([
      { path: A, category: "native-element", base: 1, head: 2, lines: [1, 1] },
    ]);
  });

  it("archivo nuevo con un <button> → base 0", () => {
    write(B, one);
    git("add", ".");
    git("commit", "-qm", "nuevo");
    expect(categories()).toEqual([`${B} native-element`]);
  });

  it("renombrado sin cambios → compara contra la ruta vieja, sin aumentos", () => {
    git("mv", A, B);
    git("commit", "-qm", "mv");
    expect(guard()).toEqual({ files: 1, violations: [] });
  });

  it("renombrado con un <button> mas → aumento", () => {
    git("mv", A, B);
    write(B, two);
    git("add", ".");
    git("commit", "-qm", "mv+");
    expect(categories()).toEqual([`${B} native-element`]);
  });

  it("violacion movida a un archivo nuevo → aumento en el nuevo", () => {
    write(A, none);
    write(B, one);
    git("add", ".");
    git("commit", "-qm", "mover");
    expect(categories()).toEqual([`${B} native-element`]);
  });

  it("borrar una violacion → sin aumentos", () => {
    write(A, none);
    expect(guard().violations).toEqual([]);
  });

  it("sin commitear y sin seguimiento tambien cuentan", () => {
    write(A, two);
    write(B, one);
    expect(categories()).toEqual([
      `${A} native-element`,
      `${B} native-element`,
    ]);
  });

  it("fuera de lo vigilado (kit, servidor, tests) no se mira", () => {
    write("apps/merchant/src/ui/x.tsx", one);
    write("apps/merchant/src/server/x.tsx", one);
    write("apps/merchant/src/app/backoffice/x.test.tsx", one);
    expect(guard()).toEqual({ files: 0, violations: [] });
  });

  it("archivo borrado: no se cuenta", () => {
    git("rm", "-q", A);
    expect(guard()).toEqual({ files: 0, violations: [] });
  });

  it("el archivo de la cabeza sobre disco manda (renombrado sin commitear)", () => {
    renameSync(join(root, A), join(root, B));
    git("add", "-A");
    expect(guard()).toEqual({ files: 1, violations: [] });
  });
});

describe("parseChanges", () => {
  it("R → ruta vieja; A → null; D → afuera; C → null", () => {
    const z = ["M", A, "R090", A, B, "A", B, "D", A, "C100", A, B, ""].join(
      "\0",
    );
    expect(parseChanges(z, "")).toEqual([
      { path: A, basePath: A },
      { path: B, basePath: A },
      { path: B, basePath: null },
      { path: B, basePath: null },
    ]);
  });
});
