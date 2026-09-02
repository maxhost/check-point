import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Guard anti-drift (spec 0049 / ADR 0046).
//
// La version de Node vive en varios archivos y nada verificaba que coincidieran:
// el pin local quedo un patch ATRAS de lo que corria en produccion y nadie lo
// noto. Esto es lo que vuelve barata la migracion a Node 26 cuando Vercel la
// habilite (2026-10-28 en adelante): cambiar el numero en un lugar y que este
// test diga cual falto.
//
// El pin de Vercel (Project Settings) NO se puede leer desde el repo; queda
// cubierto por `engines.node`, que Vercel respeta y tiene precedencia sobre el
// dashboard.

const root = join(import.meta.dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const json = (p: string) => JSON.parse(read(p));

const APPS = ["apps/consumer", "apps/merchant", "apps/platform"];

const nodeVersion = read(".node-version").trim();
const rootPkg = json("package.json");

describe("pines de version de Node (spec 0049)", () => {
  it("`.node-version` es un semver completo", () => {
    expect(nodeVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("`engines.node` acota al mismo major que `.node-version`", () => {
    const major = nodeVersion.split(".")[0];
    // Formato esperado: ">=<x.y.z> <major+1>" — piso exacto y techo en el
    // siguiente major, para que un `nvm use` viejo o un salto accidental de
    // major fallen al instalar en vez de silenciosamente.
    expect(rootPkg.engines.node).toBe(`>=${nodeVersion} <${Number(major) + 1}`);
  });

  it("`@types/node` sigue el major de Node en las 3 apps", () => {
    const major = nodeVersion.split(".")[0];
    for (const app of APPS) {
      const types = json(`${app}/package.json`).devDependencies["@types/node"];
      expect(`${app}: ${types.split(".")[0]}`).toBe(`${app}: ${major}`);
    }
  });

  it("el Node que corre satisface `engines.node`", () => {
    // Sin esto el resto compara archivos entre si y pasaria igual con un Node
    // equivocado en la terminal — que es como empezo este problema.
    expect(process.version.replace(/^v/, "").split(".")[0]).toBe(
      nodeVersion.split(".")[0],
    );
  });

  it("la version de pnpm no esta duplicada entre package.json y el CI", () => {
    const pinned = rootPkg.packageManager.replace(/^pnpm@/, "");
    expect(rootPkg.engines.pnpm).toBe(pinned);
    const ci = read(".github/workflows/ci.yml");
    const hardcoded = ci.match(/version:\s*(\d+\.\d+\.\d+)/);
    // pnpm/action-setup toma la version de `packageManager` si no se le pasa
    // `version`. Si alguien la hardcodea igual, tiene que coincidir.
    if (hardcoded) expect(hardcoded[1]).toBe(pinned);
  });
});
