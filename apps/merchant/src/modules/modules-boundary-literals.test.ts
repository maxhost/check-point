import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SRC,
  coreMerchantFiles,
  moduleLiteralCount,
} from "./modules-boundary-support";
import { MODULES } from "./registry";

/**
 * Spec 0216 / ADR 0139 §7 regla 2 — NINGUN ARCHIVO DEL CORE (servidor NI pantalla) NOMBRA UN MODULO:
 * ni sus rutas (`"/backoffice/<id>"`, `"/api/modules/<id>"`) ni comparando `segment`/`moduleId`/`id`
 * contra su id, ni como `segment: "<id>"`. Se barre `apps/merchant/src` fuera de `src/modules/` con
 * los ids del registro.
 *
 * ES UN PROXY SINTACTICO (`gotchas-del-repo` §barridos). Lo que ve y lo que no, en
 * `moduleLiteralPatterns` (`modules-boundary-support.ts`): no ve un id armado, una ruta construida
 * desde una variable, un `case "stock":`, una comparacion contra otro nombre de variable ni un id
 * en un comentario. El trabajo lo hacen los cuatro patrones; el piso de archivos y el control de
 * abajo prueban que el barrido mira.
 *
 * PENDIENTE DE GPT (encargo de la Fase 1, spec 0216 «No entra»): el menu, Ajustes y las pantallas
 * de Stock y Recetas todavia nombran los modulos. `PENDING_GPT` es la cuenta EXACTA de hoy por
 * archivo, no una excepcion abierta: un literal nuevo (en esos archivos o en otro) da rojo, y cuando
 * GPT los saque el test da rojo hasta bajar la cuenta. La meta es `{}`.
 */
const PENDING_GPT: Readonly<Record<string, number>> = {};

const IDS = MODULES.map((m) => m.id);

describe("regla 2: el core no nombra modulos (ADR 0139 §7)", () => {
  it("el barrido mira: piso de archivos y los ids del registro", () => {
    expect(coreMerchantFiles().length).toBeGreaterThan(500);
    expect(IDS).toEqual(expect.arrayContaining(["stock", "recipes"]));
  });

  it("CONTROL: los patrones ven las formas prohibidas y dejan pasar la foto de stock del catalogo", () => {
    for (const source of [
      'href: "/backoffice/stock",',
      "fetch(`/api/modules/recipes/${id}`)",
      "segment: 'stock',",
      'if (segment !== "stock") return true;',
      'modules.find((module) => module.id === "recipes")',
      '"stock" === moduleId',
    ]) {
      expect(moduleLiteralCount(source, IDS), source).toBe(1);
    }
    for (const source of [
      'image.action === "stock"',
      'const action: "keep" | "stock" = "stock";',
      'href: "/backoffice/stockroom"',
      'id: "stocks"',
    ]) {
      expect(moduleLiteralCount(source, IDS), source).toBe(0);
    }
  });

  it("ningun archivo del core nombra un modulo (fuera de lo pendiente de GPT, contado exacto)", () => {
    const found: Record<string, number> = {};
    for (const file of coreMerchantFiles()) {
      const count = moduleLiteralCount(readFileSync(file, "utf8"), IDS);
      if (count > 0) found[relative(SRC, file)] = count;
    }
    expect(found).toEqual(PENDING_GPT);
  });
});
