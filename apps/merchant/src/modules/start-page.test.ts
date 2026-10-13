import { describe, expect, it } from "vitest";
import {
  STAFF_LANDING_PANEL,
  effectiveStaffPermissions,
  staffLanding,
} from "../server/staff-landing";
import { startPageFor } from "./start-page";

/**
 * Spec 0218 §landing y spec 0220 / ADR 0141 §2 — LA PAGINA DE INICIO: el destino del integrante
 * despues de entrar (`staffLanding`) y donde abre la PWA (`startPageFor`, `/backoffice/start`). Con
 * el registro REAL: el POS declara `startPage: { path: "", permission: "pos" }`.
 *
 * Vive en `modules/` (y no al lado de `server/staff-landing.ts`) porque nombra al POS, y el core no
 * puede nombrar modulos (`modules-boundary-literals.test.ts`).
 */

const POS_PAGE = "/backoffice/pos";
const none = new Set<string>();
const posOn = new Set(["pos"]);
const land = (stored: string[], enabled: ReadonlySet<string>) =>
  staffLanding(effectiveStaffPermissions(stored, enabled), enabled);

describe("ingreso del personal (staffLanding)", () => {
  it("{pos} con el POS encendido → el POS", () => {
    expect(land(["pos"], posOn)).toBe(POS_PAGE);
  });

  it("{pos} con el POS apagado → vacio → el panel", () => {
    expect(effectiveStaffPermissions(["pos"], none)).toEqual([]);
    expect(land(["pos"], none)).toBe(STAFF_LANDING_PANEL);
    expect(STAFF_LANDING_PANEL).toBe("/backoffice");
  });

  it("{pos, counter} → el panel (mas de un permiso efectivo)", () => {
    expect(land(["pos", "counter"], posOn)).toBe(STAFF_LANDING_PANEL);
  });

  it("{stock} con Stock apagado → vacio → el panel; con Stock encendido, Stock no tiene startPage → el panel", () => {
    expect(effectiveStaffPermissions(["stock"], none)).toEqual([]);
    expect(land(["stock"], none)).toBe(STAFF_LANDING_PANEL);
    expect(land(["stock"], new Set(["stock"]))).toBe(STAFF_LANDING_PANEL);
  });

  it("un permiso de modulo APAGADO no cuenta: {pos, stock} con Stock apagado → el POS", () => {
    expect(land(["pos", "stock"], posOn)).toBe(POS_PAGE);
    expect(land(["pos", "stock"], new Set(["pos", "stock"]))).toBe(
      STAFF_LANDING_PANEL,
    );
  });

  it("un valor fuera del catalogo valido no cuenta", () => {
    expect(land(["pos", "inventado"], posOn)).toBe(POS_PAGE);
  });
});

describe("donde abre la PWA (startPageFor)", () => {
  const owner = { isOwner: true, permissions: [] };

  it("owner con el POS encendido → el POS; con el POS apagado → el panel (null)", () => {
    expect(startPageFor(posOn, owner)).toBe(POS_PAGE);
    expect(startPageFor(none, owner)).toBeNull();
    expect(startPageFor(new Set(["stock", "recipes"]), owner)).toBeNull();
  });

  it("integrante: el primer modulo encendido con startPage cuyo permiso TIENE", () => {
    expect(
      startPageFor(posOn, { isOwner: false, permissions: ["pos", "counter"] }),
    ).toBe(POS_PAGE);
    expect(
      startPageFor(posOn, { isOwner: false, permissions: ["counter"] }),
    ).toBeNull();
    expect(
      startPageFor(none, { isOwner: false, permissions: ["pos"] }),
    ).toBeNull();
  });
});
