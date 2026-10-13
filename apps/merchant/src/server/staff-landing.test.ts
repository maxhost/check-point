import { describe, expect, it } from "vitest";
import {
  STAFF_LANDING_PANEL,
  STAFF_LANDING_POS,
  effectiveStaffPermissions,
  staffLanding,
} from "./staff-landing";

/** Spec 0218 §landing — el destino del integrante despues de entrar (ADR 0140 §5). */

const none = new Set<string>();
const land = (
  stored: string[],
  posEnabled: boolean,
  modules: ReadonlySet<string> = none,
) => staffLanding(effectiveStaffPermissions(stored, posEnabled, modules));

describe("staffLanding", () => {
  it("{pos} con el POS encendido → el POS", () => {
    expect(land(["pos"], true)).toBe(STAFF_LANDING_POS);
    expect(STAFF_LANDING_POS).toBe("/backoffice/pos");
  });

  it("{pos} con el POS apagado → vacio → el panel", () => {
    expect(effectiveStaffPermissions(["pos"], false, none)).toEqual([]);
    expect(land(["pos"], false)).toBe(STAFF_LANDING_PANEL);
    expect(STAFF_LANDING_PANEL).toBe("/backoffice");
  });

  it("{pos, catalog} → el panel", () => {
    expect(land(["pos", "catalog"], true)).toBe(STAFF_LANDING_PANEL);
  });

  it("{stock} con Stock apagado → vacio → el panel", () => {
    expect(effectiveStaffPermissions(["stock"], true, none)).toEqual([]);
    expect(land(["stock"], true)).toBe(STAFF_LANDING_PANEL);
  });

  it("un permiso de modulo APAGADO no cuenta: {pos, stock} con Stock apagado → el POS", () => {
    expect(land(["pos", "stock"], true)).toBe(STAFF_LANDING_POS);
    expect(land(["pos", "stock"], true, new Set(["stock"]))).toBe(
      STAFF_LANDING_PANEL,
    );
  });

  it("un valor fuera del catalogo valido no cuenta", () => {
    expect(land(["pos", "inventado"], true)).toBe(STAFF_LANDING_POS);
  });
});
