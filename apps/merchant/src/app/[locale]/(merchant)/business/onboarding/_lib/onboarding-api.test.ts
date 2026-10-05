import { afterEach, describe, expect, it, vi } from "vitest";
import {
  autocompletePlaces,
  getOnboardingState,
  selectPlace,
  signupMerchant,
} from "./onboarding-api";

afterEach(() => vi.unstubAllGlobals());
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("API del alta 0157", () => {
  it("comparte la sesión en P1 y P2", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ suggestions: [] }))
      .mockResolvedValueOnce(
        response({
          place: { addressLabel: "Cuenca" },
          selectionToken: "signed",
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    await autocompletePlaces("cafe", "uuid-1");
    await selectPlace("place-1", "uuid-1");
    expect(
      fetchMock.mock.calls.map(([url, init]) => [url, JSON.parse(init.body)]),
    ).toEqual([
      ["/api/places/autocomplete", { input: "cafe", sessionToken: "uuid-1" }],
      ["/api/places/details", { placeId: "place-1", sessionToken: "uuid-1" }],
    ]);
  });

  it("envía P4 una vez con email y token, y acepta 201", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      response(
        {
          created: true,
          verificationSent: true,
          business: { id: "b", name: "Café", slug: "cafe" },
        },
        201,
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const business = {
      name: "Café",
      categoryGcid: "gcid:cafe",
      selectionToken: "signed",
    };
    await expect(
      signupMerchant("owner@example.com", business),
    ).resolves.toMatchObject({ created: true });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/onboarding/signup");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      email: "owner@example.com",
      business,
    });
  });

  it("acepta el enlace de cuenta conocida sin negocio", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ sent: true })));
    await expect(
      signupMerchant("owner@example.com", {
        name: "Café",
        categoryGcid: "gcid:cafe",
        selectionToken: "signed",
      }),
    ).resolves.toEqual({ sent: true });
  });

  it("conserva código y campo de error", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          response(
            { error: "Email inválido", code: "invalid_email", field: "email" },
            400,
          ),
        ),
    );
    await expect(
      signupMerchant("bad", {
        name: "Café",
        categoryGcid: "gcid:cafe",
        selectionToken: "signed",
      }),
    ).rejects.toMatchObject({
      code: "invalid_email",
      field: "email",
      status: 400,
    });
  });

  it("consulta estado al cargar", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(response({ authenticated: false }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getOnboardingState()).resolves.toEqual({
      authenticated: false,
    });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/onboarding/state");
  });
});
