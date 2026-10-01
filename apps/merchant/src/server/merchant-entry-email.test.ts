import { beforeEach, describe, expect, it, vi } from "vitest";

const email = vi.hoisted(() => ({
  findUserIdByEmail: vi.fn(),
  createOwnerUser: vi.fn(),
  signInMagicLink: vi.fn(),
  openMerchantSession: vi.fn(),
}));

vi.mock("./auth", () => ({
  getMerchantAuth: () => ({ api: { signInMagicLink: email.signInMagicLink } }),
}));
vi.mock("./auth-start", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./auth-start")>()),
  assertStartWithinLimits: vi.fn(),
  recordStartAttempt: vi.fn(),
  findUserIdByEmail: email.findUserIdByEmail,
  createOwnerUser: email.createOwnerUser,
}));
vi.mock("./merchant-session", () => ({
  openMerchantSession: email.openMerchantSession,
}));

import { POST as login } from "../app/api/merchant/auth/login/route";
import { POST as signup } from "../app/api/merchant/auth/start/route";

function post(path: string, address: string) {
  return new Request(`https://business.checkpass.club${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: address }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  email.findUserIdByEmail.mockResolvedValue(null);
  email.createOwnerUser.mockResolvedValue("new-owner");
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
    expect(email.createOwnerUser).not.toHaveBeenCalled();
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
    expect(email.createOwnerUser).not.toHaveBeenCalled();
    expect(email.signInMagicLink).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { email: "owner@example.com", callbackURL: "/backoffice" },
      }),
    );
  });

  it("un alta nueva envía verificación y conserva la sesión si falla Resend", async () => {
    const sent = await signup(
      post("/api/merchant/auth/start", "new@example.com"),
    );
    expect(await sent.json()).toEqual({ sent: false, verificationSent: true });
    expect(sent.headers.get("set-cookie")).toContain("session=test");

    email.signInMagicLink.mockRejectedValueOnce(new Error("provider rejected"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const failed = await signup(
        post("/api/merchant/auth/start", "other@example.com"),
      );
      expect(failed.status).toBe(200);
      expect(await failed.json()).toEqual({
        sent: false,
        verificationSent: false,
      });
      expect(failed.headers.get("set-cookie")).toContain("session=test");
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
