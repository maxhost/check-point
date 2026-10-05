import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.BETTER_AUTH_SECRET ||= "unit-secret-at-least-32-chars-long-xxxx";

const email = vi.hoisted(() => ({
  findUserIdByEmail: vi.fn(),
  createOwnerWithBusiness: vi.fn(),
  signInMagicLink: vi.fn(),
  openMerchantSession: vi.fn(),
  assertStartWithinLimits: vi.fn(),
  recordStartAttempt: vi.fn(),
}));

vi.mock("./auth", () => ({
  getMerchantAuth: () => ({ api: { signInMagicLink: email.signInMagicLink } }),
}));
vi.mock("./auth-start", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./auth-start")>()),
  assertStartWithinLimits: email.assertStartWithinLimits,
  recordStartAttempt: email.recordStartAttempt,
  findUserIdByEmail: email.findUserIdByEmail,
}));
vi.mock("./onboarding-signup", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./onboarding-signup")>()),
  createOwnerWithBusiness: email.createOwnerWithBusiness,
}));
vi.mock("./merchant-session", () => ({
  openMerchantSession: email.openMerchantSession,
}));

import { POST as login } from "../app/api/merchant/auth/login/route";
import { POST as signup } from "../app/api/onboarding/signup/route";
import { testSelectionToken } from "./places/selection-test-support";

function post(path: string, address: string) {
  return new Request(`https://business.checkpass.club${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: address }),
  });
}

/** Spec 0155, P4: el email + el negocio del paso 1 con su token firmado. */
function signupRequest(
  address: string,
  business: Record<string, unknown> = {},
) {
  return new Request("https://business.checkpass.club/api/onboarding/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: address,
      business: {
        name: "Café Plátano",
        categoryGcid: "gcid:cafe",
        selectionToken: testSelectionToken(),
        ...business,
      },
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  email.findUserIdByEmail.mockResolvedValue(null);
  email.createOwnerWithBusiness.mockResolvedValue({
    userId: "new-owner",
    businessId: "biz-1",
    slug: "cafe-platano",
  });
  email.signInMagicLink.mockResolvedValue({});
  email.openMerchantSession.mockResolvedValue("session=test; Path=/; HttpOnly");
});

describe("acceso merchant por email", () => {
  it("login no crea cuentas y responde igual para un email desconocido", async () => {
    const response = await login(
      post("/api/merchant/auth/login", "NUEVO@example.com"),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ accepted: true });
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(email.createOwnerWithBusiness).not.toHaveBeenCalled();
    expect(email.signInMagicLink).not.toHaveBeenCalled();
  });

  it("login de una cuenta existente envía un enlace sin abrir sesión", async () => {
    email.findUserIdByEmail.mockResolvedValue("existing-owner");
    const response = await login(
      post("/api/merchant/auth/login", "OWNER@example.com"),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ accepted: true });
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(email.createOwnerWithBusiness).not.toHaveBeenCalled();
    expect(email.signInMagicLink).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { email: "owner@example.com", callbackURL: "/backoffice" },
      }),
    );
  });

  it("un alta nueva envía verificación y conserva la sesión si falla Resend", async () => {
    const sent = await signup(signupRequest("new@example.com"));
    expect(sent.status).toBe(201);
    expect(await sent.json()).toEqual({
      created: true,
      verificationSent: true,
      business: { id: "biz-1", name: "Café Plátano", slug: "cafe-platano" },
    });
    expect(sent.headers.get("set-cookie")).toContain("session=test");

    email.signInMagicLink.mockRejectedValueOnce(new Error("provider rejected"));
    const failed = await signup(signupRequest("other@example.com"));
    expect(failed.status).toBe(201);
    expect((await failed.json()).verificationSent).toBe(false);
    expect(failed.headers.get("set-cookie")).toContain("session=test");
  });
});

/**
 * Spec 0155 — el ORDEN de `POST /api/onboarding/signup` con la base doblada. Lo que la suite
 * Neon no puede aislar: que un 400/422 sale ANTES de gastar cupo, de mirar si el email existe
 * o de mandar un mail («un error de validacion nunca manda un mail», contrato P4).
 */
describe("signup: nada escribe ni manda mail antes del paso 5", () => {
  const untouched = () => {
    expect(email.assertStartWithinLimits).not.toHaveBeenCalled();
    expect(email.recordStartAttempt).not.toHaveBeenCalled();
    expect(email.findUserIdByEmail).not.toHaveBeenCalled();
    expect(email.createOwnerWithBusiness).not.toHaveBeenCalled();
    expect(email.signInMagicLink).not.toHaveBeenCalled();
  };

  it.each([
    ["nombre vacío", { name: "  " }, "name"],
    ["nombre de 121", { name: "x".repeat(121) }, "name"],
    [
      "categoría fuera de la lista",
      { categoryGcid: "gcid:store" },
      "categoryGcid",
    ],
  ])("%s → 400 invalid_business + field", async (_case, business, field) => {
    const response = await signup(signupRequest("new@example.com", business));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: "invalid_business",
      field,
    });
    untouched();
  });

  it.each([
    ["ausente", undefined],
    ["alterado", `${testSelectionToken().split(".")[0]}.AAAA`],
    ["vencido", testSelectionToken({}, new Date(Date.now() - 3 * 3_600_000))],
  ])("token %s → 422 invalid_selection", async (_case, selectionToken) => {
    const response = await signup(
      signupRequest("new@example.com", { selectionToken }),
    );
    expect(response.status).toBe(422);
    expect((await response.json()).code).toBe("invalid_selection");
    untouched();
  });

  it("email del staff (dominio no entregable) → 400 invalid_email", async () => {
    const response = await signup(signupRequest("staff-x@staff.invalid"));
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("invalid_email");
    untouched();
  });

  it("cuerpo que no es un objeto → 400 invalid_body", async () => {
    for (const body of ["no-json", "[]", "null"]) {
      const response = await signup(
        new Request("https://business.checkpass.club/api/onboarding/signup", {
          method: "POST",
          body,
        }),
      );
      expect(response.status).toBe(400);
      expect((await response.json()).code).toBe("invalid_body");
    }
    untouched();
  });
});

describe("signup: email conocido y choques del único", () => {
  it("email conocido → 200 sent, sin cookie, sin crear nada", async () => {
    email.findUserIdByEmail.mockResolvedValue("existing-owner");
    const response = await signup(signupRequest("OWNER@example.com"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sent: true });
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(email.createOwnerWithBusiness).not.toHaveBeenCalled();
    expect(email.openMerchantSession).not.toHaveBeenCalled();
    expect(email.signInMagicLink).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { email: "owner@example.com", callbackURL: "/backoffice" },
      }),
    );
  });

  it("unique violation y el email ya existe (carrera) → 200 sent sin cookie", async () => {
    email.findUserIdByEmail
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce("winner");
    email.createOwnerWithBusiness.mockRejectedValue({ code: "23505" });
    const response = await signup(signupRequest("race@example.com"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sent: true });
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(email.openMerchantSession).not.toHaveBeenCalled();
  });

  it("unique violation con el email libre (slug) → 503 signup_unavailable", async () => {
    email.createOwnerWithBusiness.mockRejectedValue({
      cause: { code: "23505" },
    });
    const response = await signup(signupRequest("slug@example.com"));
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("signup_unavailable");
    expect(email.openMerchantSession).not.toHaveBeenCalled();
    expect(email.signInMagicLink).not.toHaveBeenCalled();
  });
});
