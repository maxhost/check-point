import { describe, expect, it, vi } from "vitest";
import { assertTargetNotAdministrator } from "./staff";

/**
 * R5 — **un administrador no toca a otro administrador.** Decision textual del owner del
 * 2026-09-21: *«solo owner puede reestablecer el pin de otro administrador de staff y darlo de
 * baja»*.
 *
 * Dos baterias, y la segunda existe porque la primera no alcanza: **una regla pura con test no
 * dice NADA sobre si alguien la llama.** Se midio en esta misma sesion — borrar la llamada de
 * `assertDemotable` del writer dejaba 1.293 tests en verde.
 */
describe("R5, la regla pura", () => {
  it("un no-owner sobre un target con `staff` → 403 `target_is_administrator`", () => {
    expect(() =>
      assertTargetNotAdministrator("staff", ["staff", "counter"]),
    ).toThrowError(
      expect.objectContaining({ status: 403, code: "target_is_administrator" }),
    );
  });

  it("el OWNER sí puede", () => {
    expect(() =>
      assertTargetNotAdministrator("owner", ["staff"]),
    ).not.toThrow();
  });

  it("un no-owner SÍ toca a un integrante común", () => {
    expect(() =>
      assertTargetNotAdministrator("staff", ["counter", "catalog"]),
    ).not.toThrow();
    expect(() => assertTargetNotAdministrator("staff", [])).not.toThrow();
    expect(() => assertTargetNotAdministrator("staff", null)).not.toThrow();
  });

  /** Fail-closed en el ROL, igual que R1: lo que no es `owner` cae del lado restrictivo. */
  it("un rol desconocido tampoco puede", () => {
    expect(() => assertTargetNotAdministrator("admin", ["staff"])).toThrowError(
      expect.objectContaining({ code: "target_is_administrator" }),
    );
  });

  /** El `code` es propio y NO se fusiona con `target_is_owner`: el owner es intocable
   * siempre; un administrador, solo para un no-owner. Mismo string para dos causas = un
   * mensaje que miente en uno de los dos casos. */
  it("no reusa `target_is_owner`", () => {
    try {
      assertTargetNotAdministrator("staff", ["staff"]);
      expect.unreachable("tenia que lanzar");
    } catch (error) {
      expect((error as { code: string }).code).not.toBe("target_is_owner");
    }
  });
});

/**
 * EL CABLEADO DE R5 EN LA BAJA (`POST /api/staff/:userId/status` → `setStaffStatus`).
 *
 * El doble de `./db` devuelve filas que la base PUEDE producir: `role` y `permissions` son las
 * dos `NOT NULL` en `business_membership`. El caso que importa corta antes de escribir; si
 * llegara al `update`, el doble falla ruidoso en vez de pasar en silencio.
 */
const objetivo: { role: string; permissions: string[] } = {
  role: "staff",
  permissions: ["staff"],
};

vi.mock("./db", () => {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "from", "where", "update", "set", "delete"]) {
    chain[m] = () => chain;
  }
  chain.limit = () => Promise.resolve([objetivo]);
  chain.returning = () => {
    throw new Error(
      "la baja llego a ESCRIBIR: R5 no corto (o el doble quedo corto)",
    );
  };
  return { getDb: () => chain };
});

const { setStaffStatus } = await import("./staff");

const negocio = { id: "b-1", slug: "bar" };

describe("R5 cableada en la baja", () => {
  it("un administrador NO da de baja a otro administrador", async () => {
    objetivo.role = "staff";
    objetivo.permissions = ["staff"];
    await expect(
      setStaffStatus(negocio, "staff", "u-otro-admin", "disabled"),
    ).rejects.toMatchObject({ status: 403, code: "target_is_administrator" });
  });

  it("el owner SÍ (pasa el guard y llega a escribir)", async () => {
    objetivo.role = "staff";
    objetivo.permissions = ["staff"];
    await expect(
      setStaffStatus(negocio, "owner", "u-otro-admin", "disabled"),
    ).rejects.toThrow(/llego a ESCRIBIR/);
  });

  it("un administrador SÍ da de baja a un integrante común", async () => {
    objetivo.role = "staff";
    objetivo.permissions = ["counter"];
    await expect(
      setStaffStatus(negocio, "staff", "u-comun", "disabled"),
    ).rejects.toThrow(/llego a ESCRIBIR/);
  });
});
