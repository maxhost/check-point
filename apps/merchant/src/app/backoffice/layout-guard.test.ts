import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it, vi } from "vitest";

/**
 * Spec 0189 §D4 — H1 de la revision: el owner SIN ACCESO tiene que poder llegar a
 * `/backoffice/subscription`, que el layout de `/backoffice` envuelve.
 *
 *  (a) el LAYOUT, con el `auth-guards` REAL y la lectura del acceso doblada a `blocked`, NO
 *      redirige al owner (antes lanzaba `redirect("/backoffice/subscription")`: bucle).
 *  (b) como el layout ya no corta, el corte vive en CADA pagina: barrido estatico de los
 *      `page.tsx` bajo `app/backoffice` — todos llaman a `requireOwner(` o
 *      `requireBackofficeSession(`, y SOLO `subscription/page.tsx` pasa `allowBlocked`.
 *      PROXY, y etiquetado como tal: pinnea que la llamada este escrita, no que se ejecute
 *      antes de leer datos. Lee las dos funciones y asevera un piso de archivos escaneados.
 */
const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`REDIRECT:${to}`);
  }),
}));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("../../server/auth", () => ({
  getMerchantAuth: () => ({
    api: {
      getSession: async () => ({
        user: { id: "u1", name: "Owner", emailVerified: true },
      }),
    },
  }),
}));
vi.mock("@mi-pasaporte/db", () => {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "from", "innerJoin", "where", "orderBy"])
    chain[m] = () => chain;
  chain.limit = () =>
    Promise.resolve([
      {
        id: "b1",
        name: "Bar",
        currencyCode: "USD",
        timezone: "UTC",
        businessStatus: "active",
        suspensionReason: null,
        role: "owner",
        status: "active",
        permissions: [],
      },
    ]);
  return { getDb: () => chain };
});
vi.mock("../../server/billing-gate", () => ({
  readBusinessBilling: async () => ({
    access: "blocked",
    trialEndsAt: null,
    failure: {},
  }),
}));
vi.mock("./backoffice-navigation", () => ({
  BackofficeNavigation: () => null,
}));
vi.mock("./onboarding/onboarding-checklist", () => ({
  OnboardingChecklist: () => null,
}));

const { default: BackofficeLayout } = await import("./layout");
const { requireBackofficeSession } = await import("../../server/auth-guards");

describe("el layout de /backoffice con un owner SIN acceso (H1)", () => {
  it("CONTROL: el guard sin `allowBlocked` lo manda a la suscripcion", async () => {
    await expect(requireBackofficeSession()).rejects.toThrow(
      "REDIRECT:/backoffice/subscription",
    );
  });

  it("ORACULO DE LA MUTACION H1: el layout NO redirige (si no, bucle en /backoffice/subscription)", async () => {
    redirect.mockClear();
    await expect(BackofficeLayout({ children: null })).resolves.toBeTruthy();
    expect(redirect).not.toHaveBeenCalled();
  });
});

function pages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return pages(path);
    return entry.name === "page.tsx" ? [path] : [];
  });
}

describe("cada pagina de /backoffice corre su propio guard (H1)", () => {
  const root = import.meta.dirname;
  const found = pages(root).map((path) => ({
    name: relative(root, path),
    source: readFileSync(path, "utf8"),
  }));

  it("hay un piso de paginas escaneadas", () => {
    expect(found.length).toBeGreaterThanOrEqual(18);
    expect(found.map((page) => page.name)).toContain("subscription/page.tsx");
  });

  it("todas llaman a `requireOwner(` o `requireBackofficeSession(`", () => {
    const sinGuard = found
      .filter((page) => !/require(Owner|BackofficeSession)\(/.test(page.source))
      .map((page) => page.name);
    expect(sinGuard).toEqual([]);
  });

  it("SOLO la de suscripcion deja pasar a un negocio sin acceso", () => {
    const conAllowBlocked = found
      .filter((page) => page.source.includes("allowBlocked"))
      .map((page) => page.name);
    expect(conAllowBlocked).toEqual(["subscription/page.tsx"]);
  });
});
