import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sessionState: { email: string | null } = { email: null };

vi.mock("./auth", () => ({
  getPlatformAuth: () => ({
    api: {
      getSession: async () =>
        sessionState.email === null
          ? null
          : { user: { email: sessionState.email } },
    },
  }),
}));

const { requireApiAdmin } = await import("./admin-guard");

describe("requireApiAdmin (spec 0190 §D3)", () => {
  const previous = process.env.PLATFORM_ADMIN_EMAILS;
  beforeEach(() => {
    process.env.PLATFORM_ADMIN_EMAILS = "dueno@checkpass.club";
  });
  afterEach(() => {
    sessionState.email = null;
    if (previous === undefined) delete process.env.PLATFORM_ADMIN_EMAILS;
    else process.env.PLATFORM_ADMIN_EMAILS = previous;
  });

  const request = () => new Request("https://admin.test/api/x");

  it("sin sesion → 401 unauthorized", async () => {
    const result = await requireApiAdmin(request());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
      expect(await result.response.json()).toMatchObject({
        code: "unauthorized",
      });
    }
  });

  it("ORACULO DE LA FILA 1: sesion viva de un correo SACADO de la lista → 403 not_admin", async () => {
    sessionState.email = "dueno@checkpass.club";
    expect((await requireApiAdmin(request())).ok).toBe(true);
    process.env.PLATFORM_ADMIN_EMAILS = "otro@checkpass.club";
    const result = await requireApiAdmin(request());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
      expect(await result.response.json()).toMatchObject({ code: "not_admin" });
    }
  });

  it("correo de la lista → ok con su email", async () => {
    sessionState.email = "dueno@checkpass.club";
    expect(await requireApiAdmin(request())).toEqual({
      ok: true,
      email: "dueno@checkpass.club",
    });
  });
});
