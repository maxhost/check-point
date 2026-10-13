import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  APP_DIR,
  SRC,
  coreMerchantFiles,
  moduleLiteralCount,
  permissionLiteralCount,
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
 * ES UN PROXY SINTACTICO (`gotchas-del-repo` §barridos). Lo que ve y lo que no, en
 * `moduleLiteralPatterns` y `permissionLiteralPatterns` (`modules-boundary-support.ts`). El trabajo
 * lo hacen esos patrones; el piso de archivos y los controles prueban que el barrido mira.
 *
 * `PENDING_GPT` (Fase 2, spec 0220): las pantallas que todavia nombran el POS hasta que GPT las mude
 * en la 2b, mas el paso transitorio `posEnabled` de la sesion (se borra en el paso final de la 2a).
 * Cuenta EXACTA por archivo: suma los patrones de arriba y `LEGACY_POS` (los nombres del POS de
 * antes de ser modulo, el barrido del DoD de la 0220). La 2b la baja a `{}`.
 */
const PENDING_GPT: Readonly<Record<string, number>> = {
  // Pantallas (zona GPT, 2b): menu y barra movil, Locales, POS, Ajustes, Equipo, aviso de prueba.
  "app/backoffice/backoffice-navigation.tsx": 18,
  "app/backoffice/locations/location-tables.tsx": 2,
  "app/backoffice/locations/locations-console.tsx": 5,
  "app/backoffice/pos/page.tsx": 1,
  "app/backoffice/pos/pos-cache.ts": 2,
  "app/backoffice/pos/pos-console.tsx": 3,
  "app/backoffice/pos/pos-payment.ts": 2,
  "app/backoffice/pos/pos-printing.ts": 1,
  "app/backoffice/pos/pos-tables.tsx": 1,
  "app/backoffice/pos/pos-types.ts": 2,
  "app/backoffice/settings/pos-settings.tsx": 3,
  "app/backoffice/settings/ticket-settings.tsx": 3,
  "app/backoffice/staff/permission-picker.tsx": 4,
  "app/backoffice/staff/staff-api.ts": 1,
  "app/backoffice/staff/staff-console.tsx": 8,
  "app/backoffice/staff/staff-views.tsx": 8,
  "app/backoffice/subscription/trial-notice.tsx": 2,
  // Paso transitorio de la sesion (`business.posEnabled`): se borra con su lectura en la 2b.
  "server/session-view.ts": 3,
  "server/read-surfaces-leak.test.ts": 1,
  "app/api/merchant/session/session.neon.integration.test.ts": 2,
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
    String.raw`/api/pos\b|server/pos\b|server/tables\b`,
    String.raw`/api/merchant/business/(?:pos|ticket)\b`,
    String.raw`/api/locations/[^"'\x60\n]*/tables\b`,
    String.raw`["']\.{1,2}/(?:\.\./)*pos/`,
  ].join("|"),
  "g",
);

const IDS = MODULES.map((m) => m.id);
const PERMS = modulePermissionIds();

function coreCount(source: string): number {
  return (
    moduleLiteralCount(source, IDS) +
    permissionLiteralCount(source, PERMS) +
    [...source.matchAll(LEGACY_POS)].length
  );
}

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

  it("la excepcion nombrada es SOLO el `id` congelado de la PWA", () => {
    const manifest = readFileSync(join(APP_DIR, "manifest.ts"), "utf8");
    expect(manifest).toMatch(/\bid: "\/backoffice\/pos",/);
    expect(manifest).toMatch(/\bstart_url: "\/backoffice\/start",/);
  });

  it("ningun archivo del core nombra un modulo ni su permiso (fuera de lo pendiente de GPT y la excepcion nombrada, contado exacto)", () => {
    const found: Record<string, number> = {};
    for (const file of coreMerchantFiles()) {
      const count = coreCount(readFileSync(file, "utf8"));
      if (count > 0) found[relative(SRC, file)] = count;
    }
    expect(found).toEqual({ ...PENDING_GPT, ...NAMED_EXCEPTIONS });
  });
});
