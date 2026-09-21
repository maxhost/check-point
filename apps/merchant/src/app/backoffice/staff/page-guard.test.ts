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
   * La otra mitad del gate, y la que se rompe sola si alguien "arregla" el chequeo mirando la
   * columna: la fila del owner tiene `permissions` VACIA en la base (`CHECK 2` de la migracion
   * 0041 lo exige) y es `permissionsForRole` la que le devuelve los siete
   * (`auth-guards.ts:202`). Si la pagina leyera la columna cruda, el owner quedaria afuera de
   * su propia pantalla.
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
