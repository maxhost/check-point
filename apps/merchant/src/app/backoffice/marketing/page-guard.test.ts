import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * EL GATE DE LAS TRES PANTALLAS DE `/backoffice/marketing` — spec 0131.
 *
 * Desde `f61b163` las paginas son cascarones: `requireBackofficeSession` + rebote a
 * `/backoffice` sin el permiso `marketing`, y un componente cliente que trae los datos por API.
 * Ese chequeo es lo unico que separa de la pantalla a un integrante sin el permiso, y un gate sin
 * prueba de que MUERDE se lee como proteccion sin serlo (mismo patron que
 * `locations/page-guard.test.ts`).
 *
 * Los dobles: `auth-guards` decide quien llama, `redirect` lanza como el real, y los componentes
 * cliente no se renderizan: el caso «entra» mira el ELEMENTO que devuelve la pagina.
 */
const { requireBackofficeSession, redirect } = vi.hoisted(() => ({
  requireBackofficeSession: vi.fn(),
  redirect: vi.fn((destino: string) => {
    throw new Error(`REDIRECT:${destino}`);
  }),
}));

vi.mock("../../../server/auth-guards", () => ({ requireBackofficeSession }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("./marketing-home", () => ({ MarketingHome: () => null }));
vi.mock("./campaign-page", () => ({ CampaignPage: () => null }));
vi.mock("./composer", () => ({ CampaignComposer: () => null }));

const { default: MarketingPage } = await import("./page");
const { default: CampaignDetailPage } = await import("./[id]/page");
const { default: NewCampaignPage } = await import("./new/page");
const { MarketingHome } = await import("./marketing-home");
const { CampaignPage } = await import("./campaign-page");
const { CampaignComposer } = await import("./composer");

const sesion = (role: string, permissions: string[]) => ({
  business: { id: "b1", name: "Bar", currencyCode: "USD" },
  membership: { role, status: "active", permissions },
  userId: "u1",
});

const pantallas = [
  {
    nombre: "marketing",
    render: () => MarketingPage(),
    componente: MarketingHome,
  },
  {
    nombre: "marketing/[id]",
    render: () => CampaignDetailPage({ params: Promise.resolve({ id: "c1" }) }),
    componente: CampaignPage,
  },
  {
    nombre: "marketing/new",
    render: () => NewCampaignPage(),
    componente: CampaignComposer,
  },
] as const;

describe.each(pantallas)("el guard de /backoffice/$nombre", (pantalla) => {
  beforeEach(() => {
    requireBackofficeSession.mockReset();
    redirect.mockClear();
  });

  it("rebota al integrante que NO tiene el permiso `marketing`", async () => {
    requireBackofficeSession.mockResolvedValue(
      sesion("staff", ["counter", "locations", "catalog"]),
    );
    await expect(pantalla.render()).rejects.toThrow("REDIRECT:/backoffice");
    expect(redirect).toHaveBeenCalledWith("/backoffice");
  });

  it("rebota al integrante sin ningun permiso", async () => {
    requireBackofficeSession.mockResolvedValue(sesion("staff", []));
    await expect(pantalla.render()).rejects.toThrow("REDIRECT:/backoffice");
  });

  it("deja entrar al integrante CON el permiso `marketing`", async () => {
    requireBackofficeSession.mockResolvedValue(sesion("staff", ["marketing"]));
    const element = (await pantalla.render()) as { type: unknown };
    expect(element.type).toBe(pantalla.componente);
    expect(redirect).not.toHaveBeenCalled();
  });

  /** El doble ya entrega los siete expandidos: `permissionsForRole` no corre aca (tiene su
   * oraculo en `server/staff-permissions.test.ts`). Lo que distingue es que la pagina no
   * rechace `role === "owner"`. */
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
    const element = (await pantalla.render()) as { type: unknown };
    expect(element.type).toBe(pantalla.componente);
    expect(redirect).not.toHaveBeenCalled();
  });
});
