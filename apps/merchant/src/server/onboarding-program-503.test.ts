import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Spec 0078 — **SIN PLANTILLAS NO SE ESCRIBE UN PROGRAMA.** El contrato de la ruta de
 * escritura para ese caso es `503 program_unavailable` y **cero escrituras**. Desde la spec
 * 0079 esa ruta es `PUT /api/loyalty-program`, la única, y el compositor se llama
 * `programInput`.
 *
 * Va con dobles y no contra Neon **a propósito, y el motivo es de CONTRATO, no de
 * comodidad**: para que la resolución de plantillas falle de verdad habría que dejar sin
 * semillas publicadas a TODOS los candidatos, y `termsScopeCandidates` siempre appendea
 * `"default"` al final (`loyalty-program/terms-scope.ts`), así que mientras `default` esté
 * sembrado el 503 es inalcanzable **por construcción**. Lo que este archivo pinnea es lo
 * que sí depende de la ruta: el `status`, el `code`, y que **`saveProgram` no se llame**.
 * Lo que queda declarado afuera es sólo «una base real sin semillas».
 *
 * `LoyaltyError` se mantiene REAL (el mock del barrel esparce el original): la ruta mapea
 * el status con un `instanceof`, y una clase falsa haría que este test pinnee el doble en
 * vez del mapeo.
 */
const world = vi.hoisted(() => ({
  session: null as null | {
    user: { id: string; emailVerified: boolean };
    session: { onboardingGrantUntil: Date | null };
  },
  programInput: vi.fn(),
  saveProgram: vi.fn(),
}));

vi.mock("./auth", () => ({
  getMerchantAuth: () => ({ api: { getSession: async () => world.session } }),
}));

/**
 * Spec 0079 — la ruta única resuelve owner con `requireApiOwnerSinGateDeEmail`, que lee
 * `ownerContext`. Se dobla en `active` porque este archivo mide el 503 del compositor, no el
 * guard: el guard entero, con sus cinco estados del caller, es `api-owner-surfaces.test.ts`.
 */
vi.mock("./staff", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./staff")>()),
  // Spec 0086: el `PUT` pasó a `requireApiPermissionSinGateDeEmail`, que resuelve con
  // `membershipContext`. `ownerContext` queda doblado igual porque otras superficies del
  // barril lo siguen usando y un doble parcial dejaría la real apuntando a la base.
  membershipContext: async () => ({
    id: "11111111-1111-4111-8111-111111111111",
    slug: "la-farmacia",
    countryCode: "EC",
    currencyCode: "USD",
    status: "active",
    suspensionReason: null,
    role: "owner",
    permissions: [],
  }),
  ownerContext: async () => ({
    id: "11111111-1111-4111-8111-111111111111",
    slug: "la-farmacia",
    currencyCode: "USD",
    status: "active",
    suspensionReason: null,
  }),
}));

vi.mock("./onboarding/program-defaults", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./onboarding/program-defaults")>()),
  programInput: world.programInput,
}));

vi.mock("./loyalty-program", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./loyalty-program")>()),
  saveProgram: world.saveProgram,
}));

import { PUT } from "../app/api/loyalty-program/route";
import { LoyaltyError } from "./loyalty-program/core";

const post = () =>
  PUT(
    new Request("http://localhost:3001/api/loyalty-program", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "stamps",
        configuration: { target: 8 },
        rewards: [{ type: "custom", label: "Café gratis" }],
      }),
    }),
  );

describe("PUT /api/loyalty-program sin plantillas (spec 0078 §3, ruta única 0079)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    world.session = {
      user: { id: "user-0078", emailVerified: true },
      session: { onboardingGrantUntil: null },
    };
  });

  it("responde 503 `program_unavailable` y NO llama a `saveProgram`", async () => {
    world.programInput.mockRejectedValue(
      new LoyaltyError(503, "Las plantillas de términos no están disponibles."),
    );
    const response = await post();
    // LA ASERCIÓN QUE IMPORTA VA PRIMERO, y el orden no es estético: medido, si la ruta
    // dejara de cortar y siguiera al writer, el `catch` genérico devuelve **el mismo 503
    // con el mismo `code`**. O sea que `status` y `code` NO distinguen ese caso: lo único
    // que lo distingue es que el writer no se llamó (y, de rebote, el mensaje).
    expect(world.saveProgram).not.toHaveBeenCalled();
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.code).toBe("program_unavailable");
    expect(body.error).toBe("Las plantillas de términos no están disponibles.");
  });

  /** CONTROL POSITIVO — sin esto, un doble que siempre falle dejaría el caso de arriba en
   * verde aunque la ruta nunca llamara al writer en ningún escenario. */
  it("con plantillas resueltas, la MISMA ruta llama al writer y contesta 201", async () => {
    world.programInput.mockResolvedValue({ kind: "stamps" });
    world.saveProgram.mockResolvedValue({ programId: "prog-1", created: true });
    const response = await post();
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      programId: "prog-1",
      created: true,
    });
    expect(world.saveProgram).toHaveBeenCalledTimes(1);
  });
});
