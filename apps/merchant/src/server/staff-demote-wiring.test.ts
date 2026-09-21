import { describe, expect, it, vi } from "vitest";

/**
 * EL CABLEADO DE R1b, NO LA REGLA — y existe porque se MIDIO que faltaba.
 *
 * `staff-permissions.test.ts` prueba que `assertDemotable` muerde; eso no dice **nada** sobre
 * si `setStaffPermissions` la llama. Se mutó borrando la llamada del writer y la suite entera
 * del paquete siguió en verde (1.293 tests): el techo del perfil se podía sacar del camino sin
 * poner rojo a nadie. Es el mismo modo de falla que costó la revisión de la spec 0088.
 *
 * El doble de `./db` sólo necesita el `select … limit`, porque el caso que importa **corta
 * antes de escribir**: si algún día llegara al `update`, el doble fallaría ruidoso en vez de
 * pasar en silencio.
 *
 * **La fila del doble es la que la base puede producir de verdad:** `permissions` es
 * `text[] NOT NULL DEFAULT '{}'` y `role` es `NOT NULL` (migración 0041 / `schema/business.ts`),
 * así que las dos viajan siempre. Un doble que omitiera una columna `NOT NULL` describiría una
 * fila imposible y lo que se midiera con él valdría cero.
 */
const objetivo: { role: string; permissions: string[] } = {
  role: "staff",
  permissions: ["staff", "catalog"],
};

vi.mock("./db", () => {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "from", "where", "update", "set"]) {
    chain[m] = () => chain;
  }
  chain.limit = () => Promise.resolve([objetivo]);
  chain.returning = () => {
    throw new Error(
      "el writer llego a ESCRIBIR: R1b no corto la degradacion (o el doble quedo corto)",
    );
  };
  return { getDb: () => chain };
});

const { setStaffPermissions } = await import("./staff-permissions");

const negocio = { id: "b-1", slug: "bar" };

describe("R1b cableada en `PATCH /api/staff/:userId/permissions`", () => {
  it("un administrador NO puede degradar a otro administrador", async () => {
    objetivo.role = "staff";
    objetivo.permissions = ["staff", "catalog"];
    await expect(
      setStaffPermissions(
        negocio,
        { userId: "u-admin", role: "staff" },
        "u-otro-admin",
        ["catalog"],
      ),
    ).rejects.toMatchObject({ status: 403, code: "permission_not_grantable" });
  });

  /** El límite de la regla: sobre alguien que NO es administrador, el administrador sigue
   * editando permisos — es la R2, decisión textual del owner, y no se rompe. Llega al
   * `update`, que en este doble es el error ruidoso: eso mismo prueba que pasó el guard. */
  it("un administrador SÍ edita a un integrante común (pasa el guard y llega a escribir)", async () => {
    objetivo.role = "staff";
    objetivo.permissions = ["counter"];
    await expect(
      setStaffPermissions(
        negocio,
        { userId: "u-admin", role: "staff" },
        "u-comun",
        ["catalog"],
      ),
    ).rejects.toThrow(/llego a ESCRIBIR/);
  });
});
