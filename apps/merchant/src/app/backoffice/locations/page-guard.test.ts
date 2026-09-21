import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * EL GATE DE `/backoffice/locales`, QUE DESDE HOY ES POR PERMISO Y NO POR ROL.
 *
 * La pantalla era `requireOwner()` desde la spec 0061 §4, mientras la API de `/api/locations/*`
 * quedo delegada en el permiso `locations` con la spec 0086: el permiso estaba **vivo en la API
 * y muerto en el producto**. Al abrirla, el chequeo nuevo es lo unico que separa a un integrante
 * sin ese permiso de la consola — y un gate sin prueba de que MUERDE se lee como proteccion sin
 * serlo. Es la leccion que dejo la revision de la 0088, donde borrar el gate gemelo de Staff
 * dejaba 1.526 tests en verde.
 *
 * Los dobles: `auth-guards` decide quien llama, `db`/`locations` evitan la base (la pagina lee
 * pais y plan para el aviso de tope) y el componente cliente no se renderiza de verdad.
 */
const { requireBackofficeSession, redirect } = vi.hoisted(() => ({
  requireBackofficeSession: vi.fn(),
  redirect: vi.fn((destino: string) => {
    throw new Error(`REDIRECT:${destino}`);
  }),
}));

vi.mock("../../../server/auth-guards", () => ({ requireBackofficeSession }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("./locations-console", () => ({ LocationsConsole: () => null }));
vi.mock("../../../server/db", () => {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "from", "leftJoin", "where"])
    chain[m] = () => chain;
  chain.limit = () => Promise.resolve([{ countryCode: "EC", plan: "free" }]);
  return { getDb: () => chain };
});
vi.mock("../../../server/locations", () => ({
  listLocations: async () => [],
  effectiveLocationLimit: () => 1,
}));

const { default: LocationsPage } = await import("./page");

const sesion = (role: string, permissions: string[]) => ({
  business: { id: "b1", name: "Bar", slug: "bar" },
  membership: { role, status: "active", permissions },
  user: { id: "u1" },
});

describe("el guard de /backoffice/locations", () => {
  beforeEach(() => {
    requireBackofficeSession.mockReset();
    redirect.mockClear();
  });

  it("rebota al integrante que NO tiene el permiso `locations`", async () => {
    requireBackofficeSession.mockResolvedValue(sesion("staff", ["counter"]));
    await expect(LocationsPage()).rejects.toThrow("REDIRECT:/backoffice");
    expect(redirect).toHaveBeenCalledWith("/backoffice");
  });

  it("rebota al integrante sin ningun permiso", async () => {
    requireBackofficeSession.mockResolvedValue(sesion("staff", []));
    await expect(LocationsPage()).rejects.toThrow("REDIRECT:/backoffice");
  });

  it("deja entrar al integrante CON el permiso `locations`", async () => {
    requireBackofficeSession.mockResolvedValue(sesion("staff", ["locations"]));
    await expect(LocationsPage()).resolves.toBeDefined();
    expect(redirect).not.toHaveBeenCalled();
  });

  /** El owner entra. Ojo con lo que mide: el doble ya entrega los siete expandidos, asi que
   * `permissionsForRole` no corre aca — eso tiene su oraculo en
   * `server/staff-permissions.test.ts`. Lo que este caso distingue es que la pagina no rechace
   * `role === "owner"`. */
  it("deja entrar al owner", async () => {
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
    await expect(LocationsPage()).resolves.toBeDefined();
    expect(redirect).not.toHaveBeenCalled();
  });
});
