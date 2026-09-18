import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createBusiness,
  createProgram,
  getOnboardingState,
  startMerchantAuth,
} from "./onboarding-api";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("API del wizard", () => {
  it("inicia identidad merchant solo con el email", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ sent: true }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(startMerchantAuth("owner@example.com")).resolves.toEqual({
      sent: true,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/merchant/auth/start",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "owner@example.com" }),
        credentials: "same-origin",
      }),
    );
  });

  it("envía el alta del negocio sin ids resueltos por el cliente", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ businessId: "b-1", slug: "cafe-sur" }));
    vi.stubGlobal("fetch", fetchMock);
    const input = {
      name: "Café Sur",
      categoryGcid: "gcid:cafe",
      countryCode: "EC",
      timezone: "America/Guayaquil",
      locationName: "Principal",
      address: {
        label: "Quito, Ecuador",
        provider: "geoapify" as const,
        longitude: -78.47,
        latitude: -0.18,
        snapshot: { city: "Quito" },
      },
    };

    await expect(createBusiness(input)).resolves.toEqual({
      id: "b-1",
      name: "Café Sur",
      slug: "cafe-sur",
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(input);
  });

  it("crea el programa desde los dos únicos campos contratados", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ programId: "p-1", created: true }));
    vi.stubGlobal("fetch", fetchMock);

    await createProgram(8, "  Café gratis  ");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      target: 8,
      reward: { type: "custom", label: "Café gratis" },
    });
  });

  it("preserva código y motivo de suspensión en errores transversales", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            error: "El negocio está suspendido.",
            code: "business_suspended",
            suspensionReason: "Pago pendiente",
          },
          403,
        ),
      ),
    );

    await expect(createProgram(8, "Café")).rejects.toMatchObject({
      status: 403,
      code: "business_suspended",
      suspensionReason: "Pago pendiente",
    });
  });

  it("lee el estado 0074 sin inferir rol, ids ni plan", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const state = {
      authenticated: true as const,
      business: null,
      program: null,
      stampImage: false,
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(state));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getOnboardingState()).resolves.toEqual(state);
    expect(fetchMock).toHaveBeenCalledWith("/api/onboarding/state", {
      credentials: "same-origin",
    });
  });
});
