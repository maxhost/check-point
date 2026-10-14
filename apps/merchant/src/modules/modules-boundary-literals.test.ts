import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  APP_DIR,
  SRC,
  coreMerchantFiles,
  coreOfModulesFiles,
  exactIdLiteralCount,
  moduleUseLiteralCount,
  moduleLiteralCount,
  permissionLiteralCount,
  withoutComments,
} from "./modules-boundary-support";
import { MODULES } from "./registry";
import { modulePermissionIds } from "./permissions";

/**
 * Spec 0216 / ADR 0139 §7 regla 2 — NINGUN ARCHIVO DEL CORE (servidor NI pantalla) NOMBRA UN MODULO:
 * ni sus rutas (`"/backoffice/<id>"`, `"/api/modules/<id>"`) ni comparando `segment`/`moduleId`/`id`
 * contra su id, ni como `segment: "<id>"`. Se barre `apps/merchant/src` fuera de `src/modules/` con
 * los ids del registro.
 *
 * Spec 0220 / ADR 0141 §9, regla 2 AMPLIADA — tampoco nombra los PERMISOS de un modulo
 * (`includes("<perm>")`, `permission === "<perm>"`, `permission: "<perm>"`), barrido con los
 * permisos de los manifiestos (`permissionLiteralPatterns`).
 *
 * Spec 0220, revision de la 2a — el barrido incluye el CORE DE MODULOS (`modules/*.ts` sin los
 * registros ni tests: `coreOfModulesFiles`) y suma el id como LITERAL EXACTO fuera de comentarios
 * (`exactIdLiteralCount`: `isModuleEnabled(b, "pos")`, `["pos", …]`, `case "tables":`).
 *
 * ES UN PROXY SINTACTICO (`gotchas-del-repo` §barridos). Lo que ve y lo que no, en
 * `moduleLiteralPatterns`, `permissionLiteralPatterns` y `exactIdLiteralCount`
 * (`modules-boundary-support.ts`). LO QUE NO SE VE, ademas: el literal exacto de los ids de
 * `EXACT_ID_COLLISIONS` (hoy `stock`, que el core usa como valor propio — la foto de stock del
 * catalogo, `imageAction: "stock"`): para esos valen las rutas, comparaciones y propiedades de
 * `moduleLiteralPatterns`, los patrones de permiso y `moduleUseLiteralCount` (el id como argumento
 * de una funcion de modulos, `isModuleEnabled(b, "stock")`, o en `enabledModules.has("stock")`).
 * No se ve un id armado, uno guardado antes en una variable ni uno dentro de un texto mas largo. El trabajo lo hacen esos
 * patrones; el piso de archivos y los controles prueban que el barrido mira.
 *
 * `PENDING_GPT` quedo vacia al cerrar la Fase 2 (spec 0220: 2b de GPT y el paso final que borro
 * `posEnabled` de la sesion). Se conserva como cuenta EXACTA por archivo (suma los patrones de arriba
 * y `LEGACY_POS`, los nombres del POS de antes de ser modulo): si una migracion futura necesita
 * convivir con literales viejos, se anotan aca y el test obliga a bajarlos a `{}`.
 */
const PENDING_GPT: Readonly<Record<string, number>> = {};

/**
 * FALSOS POSITIVOS MEDIDOS del literal exacto (revision de la 2a, 2026-10-13), nombrados aca y en el
 * reporte en vez de excepcionarlos en silencio: tests del core que usan el id de un modulo como DATO
 * de un permiso, no como modulo.
 * - `session.neon`: la lista de permisos del owner fija el orden `…, "stock", "recipes", "pos"` (el
 *   contrato de la sesion incluye los permisos de modulo); `"stock"` no cuenta (colision).
 * - `membership-permissions-checks.neon`: `array['stock','recipes','billing']` prueba la FORMA del
 *   CHECK de la base (spec 0216); cualquier texto valido serviria.
 * - `pin-change-gate.test`: los permisos del integrante del fixture (`["pos", "counter", "catalog"]`).
 */
const KNOWN_FALSE_POSITIVES: Readonly<Record<string, number>> = {
  "app/api/merchant/session/session.neon.integration.test.ts": 2,
  "server/membership-permissions-checks.neon.integration.test.ts": 1,
  "server/pin-change-gate.test.ts": 1,
};

/**
 * EXCEPCION NOMBRADA (ADR 0141 §2): el `id` de la PWA queda congelado en `"/backoffice/pos"`
 * (cambiarlo instala otra app). Es un identificador opaco, no una ruta que el core use.
 */
const NAMED_EXCEPTIONS: Readonly<Record<string, number>> = {
  "app/manifest.ts": 1,
};

/**
 * Spec 0220 — los nombres del POS de cuando era un switch del core (el barrido del DoD de la 0220),
 * sus rutas borradas (`/api/merchant/business/{pos,ticket}`, `/api/locations/:id/tables`) y los
 * imports a sus pantallas, que siguen en el core hasta la 2b (`../pos/…`). Ninguno puede volver.
 */
const LEGACY_POS = new RegExp(
  [
    "posEnabled|pos_enabled|requirePosOperator|assertPosGrantable",
    // Revision final de la Fase 2 (H2): los eventos con nombre del POS que reemplazaron
    // `checkpass:modules-changed` y `checkpass:module-primary`.
    "pos-module-changed|POS_NEW_ORDER",
    String.raw`/api/pos\b|server/pos\b|server/tables\b`,
    String.raw`/api/merchant/business/(?:pos|ticket)\b`,
    String.raw`/api/locations/[^"'\x60\n]*/tables\b`,
    String.raw`["']\.{1,2}/(?:\.\./)*pos/`,
  ].join("|"),
  "g",
);

const IDS = MODULES.map((m) => m.id);
const PERMS = modulePermissionIds();

/** Ids de modulo que el core usa como palabra propia: su literal exacto no se barre (ver arriba). */
const EXACT_ID_COLLISIONS = ["stock"];
const EXACT_IDS = IDS.filter((id) => !EXACT_ID_COLLISIONS.includes(id));

function coreCount(source: string): number {
  return (
    moduleLiteralCount(source, IDS) +
    permissionLiteralCount(source, PERMS) +
    exactIdLiteralCount(source, EXACT_IDS) +
    moduleUseLiteralCount(source, EXACT_ID_COLLISIONS) +
    [...source.matchAll(LEGACY_POS)].length
  );
}

/** Lo que barre la regla 2: el core de merchant y el core de modulos. */
const sweptFiles = () => [...coreMerchantFiles(), ...coreOfModulesFiles()];

describe("regla 2: el core no nombra modulos ni sus permisos (ADR 0139 §7, ADR 0141 §9)", () => {
  it("el barrido mira: piso de archivos, ids y permisos del registro", () => {
    expect(coreMerchantFiles().length).toBeGreaterThan(500);
    expect(IDS).toEqual(
      expect.arrayContaining(["stock", "recipes", "pos", "tables"]),
    );
    expect(PERMS).toEqual(expect.arrayContaining(["stock", "recipes", "pos"]));
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

  it("CONTROL regla 2 ampliada: los permisos de modulo en las tres formas, y no un valor que no es permiso", () => {
    for (const source of [
      'if (!permissions.includes("pos")) redirect("/backoffice");',
      'session.membership.permissions.includes("recipes")',
      'permission === "pos"',
      "'stock' !== entry.permission",
      'effective.permissions[0] === "pos"',
      'scope === "stock"',
      '{ permission: "pos", label: "POS" }',
    ]) {
      expect(permissionLiteralCount(source, PERMS), source).toBe(1);
    }
    for (const source of [
      'image.action === "stock"',
      'permissions.includes("counter")',
      'permission === "posts"',
    ]) {
      expect(permissionLiteralCount(source, PERMS), source).toBe(0);
    }
  });

  it("CONTROL de LEGACY_POS: los nombres y rutas del POS viejo, y no las rutas nuevas", () => {
    const count = (source: string) => [...source.matchAll(LEGACY_POS)].length;
    for (const source of [
      "session.business?.posEnabled",
      'fetch("/api/pos/orders")',
      'import { x } from "../server/pos/auth";',
      'fetch("/api/merchant/business/ticket")',
      "`/api/locations/${encodeURIComponent(id)}/tables`",
      'import { posRequest } from "../pos/pos-types";',
      'window.addEventListener("pos-module-changed", load);',
      "window.dispatchEvent(new Event(POS_NEW_ORDER_EVENT));",
    ]) {
      expect(count(source), source).toBe(1);
    }
    for (const source of [
      'fetch("/api/modules/pos/orders")',
      'fetch("/api/positions")',
      'import { x } from "./pos-types";',
    ]) {
      expect(count(source), source).toBe(0);
    }
  });

  it("CONTROL del literal exacto: el id como argumento o en un arreglo, no en un comentario ni en un texto mas largo", () => {
    for (const source of [
      'await isModuleEnabled(businessId, "pos");',
      "const ids = ['tables'];",
      "case `recipes`:",
    ]) {
      expect(exactIdLiteralCount(source, EXACT_IDS), source).toBe(1);
    }
    for (const source of [
      "// el permiso `pos` del modulo",
      "/** el modulo `tables` */",
      'const url = "https://x.test"; // ver `pos`',
      'const label = "las tables";',
      'imageAction: "stock",',
    ]) {
      expect(exactIdLiteralCount(source, EXACT_IDS), source).toBe(0);
    }
    expect(withoutComments('a("https://x/pos")')).toBe('a("https://x/pos")');
  });

  it("CONTROL del id que choca: se ve usado como modulo, no como valor propio del core", () => {
    for (const source of [
      'await isModuleEnabled(businessId, "stock");',
      "await requireModule(business.id, 'stock');",
      'await lockModuleEnabled(tx, businessId, "stock");',
      'const m = moduleById("stock");',
      'if (enabledModules.has("stock")) show();',
      "session.business.enabledModules.includes(`stock`)",
    ]) {
      expect(moduleUseLiteralCount(source, EXACT_ID_COLLISIONS), source).toBe(
        1,
      );
    }
    for (const source of [
      'imageAction: "stock",',
      'setImageAction("stock");',
      'image.action === "stock"',
      '// isModuleEnabled(b, "stock") en un comentario',
      "isModuleEnabled(businessId, moduleId);",
      'enabledModules.has("stocks")',
    ]) {
      expect(moduleUseLiteralCount(source, EXACT_ID_COLLISIONS), source).toBe(
        0,
      );
    }
  });

  it('la colision declarada existe de verdad: el core usa `"stock"` como valor propio', () => {
    const catalog = readFileSync(
      join(APP_DIR, "backoffice", "catalog", "types.ts"),
      "utf8",
    );
    expect(catalog).toMatch(/"stock"/);
    expect(coreOfModulesFiles().map((f) => relative(SRC, f))).toEqual(
      expect.arrayContaining([
        "modules/activation.ts",
        "modules/guard.ts",
        "modules/dispatch.ts",
        "modules/start-page.ts",
      ]),
    );
  });

  it("la excepcion nombrada es SOLO el `id` congelado de la PWA", () => {
    const manifest = readFileSync(join(APP_DIR, "manifest.ts"), "utf8");
    expect(manifest).toMatch(/\bid: "\/backoffice\/pos",/);
    expect(manifest).toMatch(/\bstart_url: "\/backoffice\/start",/);
  });

  it("ningun archivo del core nombra un modulo ni su permiso (fuera de lo pendiente de GPT y la excepcion nombrada, contado exacto)", () => {
    const found: Record<string, number> = {};
    for (const file of sweptFiles()) {
      const count = coreCount(readFileSync(file, "utf8"));
      if (count > 0) found[relative(SRC, file)] = count;
    }
    const expected: Record<string, number> = {};
    for (const map of [PENDING_GPT, NAMED_EXCEPTIONS, KNOWN_FALSE_POSITIVES])
      for (const [file, n] of Object.entries(map))
        expected[file] = (expected[file] ?? 0) + n;
    expect(found).toEqual(expected);
  });
});
