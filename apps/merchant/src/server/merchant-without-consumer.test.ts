import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Spec 0117 §10 / ADR 0109 §4: el cliente salio de merchant. Sus pantallas, su API publica,
 * sus assets y su CSS viven en `apps/consumer`; merchant solo conserva el 308 de paginas
 * (`hosts.ts`) y el proxy de `/api/public/*` (`next.config.ts`). Una copia que sobrevive aca
 * compila y pasa los tests, y Next la serviria en `business.` por delante del proxy.
 */
const APP = join(import.meta.dirname, "..", "..");

describe("merchant no sirve el cliente", () => {
  // ORACULO DE M1: una carpeta o asset del cliente que vuelve a merchant.
  it.each([
    "src/app/(consumer)",
    "src/app/api/public",
    "public/sw.js",
    "public/wallet-logo.png",
  ])("%s no existe", (path) => {
    expect(existsSync(join(APP, path)), path).toBe(false);
  });

  it("globals.css no tiene ningun selector `.consumer-`", () => {
    const css = readFileSync(join(APP, "src", "app", "globals.css"), "utf8");
    // Piso: leer el archivo equivocado (o uno vacio) no puede pasar en verde.
    expect(css.length).toBeGreaterThan(100_000);
    expect(css).toContain(".card-preview");
    expect(css.match(/\.consumer-[\w-]*/g) ?? []).toEqual([]);
  });
});
