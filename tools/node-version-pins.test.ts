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
const nvmrcVersion = read(".nvmrc").trim();
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

  it("`.nvmrc` coincide con `.node-version`", () => {
    // `.nvmrc` existe para que `nvm use` sin argumentos funcione en el repo
    // (nvm NO lee `.node-version`). Un pin mas es una fuente de drift mas: se
    // guarda o no se agrega.
    expect(nvmrcVersion).toBe(nodeVersion);
  });

  it("el Node que corre satisface `engines.node` COMPLETO, no solo el major", () => {
    // Sin esto el resto compara archivos entre si y pasaria igual con un Node
    // equivocado en la terminal — que es como empezo este problema.
    //
    // Comparar solo el major NO alcanza, y es el agujero por el que se colo el
    // drift original: con `.node-version` en 24.20.0, un Node **24.19.0** local
    // pasaba este guard con los dos majors en "24" mientras violaba
    // `engines.node` (`>=24.20.0`) y pnpm avisaba `WARN Unsupported engine` en
    // cada corrida. Se compara la version entera contra el piso.
    const cmp = (a: string, b: string) => {
      const pa = a.split(".").map(Number);
      const pb = b.split(".").map(Number);
      for (let i = 0; i < 3; i += 1) {
        if (pa[i] !== pb[i]) return pa[i] - pb[i];
      }
      return 0;
    };
    const running = process.version.replace(/^v/, "");
    expect(`${running} >= ${nodeVersion}`).toBe(
      cmp(running, nodeVersion) >= 0
        ? `${running} >= ${nodeVersion}`
        : `FALSO: el Node de esta terminal es anterior al pin del repo`,
    );
    expect(Number(running.split(".")[0])).toBe(
      Number(nodeVersion.split(".")[0]),
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
