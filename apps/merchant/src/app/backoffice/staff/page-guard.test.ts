import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ORACULO DEL HALLAZGO H1 DE LA REVISION DE LA SPEC 0088.
 *
 * `backoffice/staff/page.tsx` es **la primera pagina del backoffice gateada por PERMISO** y no
 * por `requireOwner()`, y la revision independiente midio que ese chequeo **no tenia oraculo**:
 * borrarlo dejaba 1.526 tests en verde, y ningun test del repo importaba la pagina. Un gate sin
 * prueba de que muerde es peor que ninguno, porque se lee como proteccion.
 *
 * Es un test sin base: la pagina no consulta nada —resuelve la sesion y devuelve el componente
 * cliente—, asi que los tres dobles alcanzan y esto corre en la suite normal, no en la de Neon.
 * El `redirect` real de Next **lanza** para cortar el render; el doble lo imita, que es lo que
 * distingue «rebota» de «rebota y ademas renderiza».
 */
const { requireBackofficeSession, redirect } = vi.hoisted(() => ({
  requireBackofficeSession: vi.fn(),
  redirect: vi.fn((destino: string) => {
    throw new Error(`REDIRECT:${destino}`);
  }),
}));

vi.mock("../../../server/auth-guards", () => ({ requireBackofficeSession }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("./staff-console", () => ({ StaffConsole: () => null }));

const { default: StaffPage } = await import("./page");

const sesion = (role: string, permissions: string[]) => ({
  business: { id: "b1", name: "Bar", slug: "bar" },
  membership: { role, status: "active", permissions },
  user: { id: "u1" },
});

describe("el guard de /backoffice/staff", () => {
  beforeEach(() => {
    requireBackofficeSession.mockReset();
    redirect.mockClear();
  });

  it("rebota al integrante que NO tiene el permiso staff", async () => {
    requireBackofficeSession.mockResolvedValue(sesion("staff", ["counter"]));
    await expect(StaffPage()).rejects.toThrow("REDIRECT:/backoffice");
    expect(redirect).toHaveBeenCalledWith("/backoffice");
  });

  it("rebota al integrante sin ningun permiso", async () => {
    requireBackofficeSession.mockResolvedValue(sesion("staff", []));
    await expect(StaffPage()).rejects.toThrow("REDIRECT:/backoffice");
  });

  it("deja entrar al integrante CON el permiso staff", async () => {
    requireBackofficeSession.mockResolvedValue(sesion("staff", ["staff"]));
    await expect(StaffPage()).resolves.toBeDefined();
    expect(redirect).not.toHaveBeenCalled();
  });

  /**
   * El owner entra. **Y este caso mide MENOS de lo que parece, asi que lo dice:** el doble
   * entrega la sesion con los siete permisos ya expandidos, o sea que `permissionsForRole`
   * —que es quien se los da al owner aunque su fila este vacia por el `CHECK 2` de la
   * migracion 0041— **no corre aca**. Lo unico que este caso distingue del anterior es que la
   * pagina no rechace `role === "owner"` por el rol. La expansion tiene su propio oraculo, y
   * esta en otro archivo: `server/staff-permissions.test.ts:103-104`.
   *
   * Lo anota la segunda vuelta de revision de la 0088, y vale la pena que quede: el docblock
   * anterior afirmaba haber medido algo que el doble hacia imposible medir.
   */
  it("deja entrar al owner, que llega con los siete", async () => {
    requireBackofficeSession.mockResolvedValue(
      sesion("owner", [
        "brand",
        "catalog",
        "counter",
        "locations",
        "loyalty",
        "marketing",
        "staff",
      ]),
    );
    await expect(StaffPage()).resolves.toBeDefined();
    expect(redirect).not.toHaveBeenCalled();
  });
});
