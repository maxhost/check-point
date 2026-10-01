import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildPassJson } from "@mi-pasaporte/domain/server/wallet/apple";
import { buildLoyaltyObject } from "@mi-pasaporte/domain/server/wallet/google-object";

/**
 * EL CABLEADO de `consumerOriginOr` (spec 0114 §3 / ADR 0106 §5): lo que se EMITE desde
 * ahora lleva el host del cliente. Las tres rutas de pases y el afiche le pasan al builder
 * `CONSUMER_ORIGIN` si esta cargado y, si no, el origin del request (el comportamiento de
 * antes). La regla pura esta en `hosts.test.ts`; aca se mide que cada borde la invoque.
 *
 * El `origin` que recibe el provider se pasa por los builders REALES (`buildPassJson`,
 * `buildLoyaltyObject`) para leer el `webServiceURL` y el link `/c/` que terminan en el
 * pase — sin firmar, sin base. Todo lo demas esta doblado.
 */

const MY = "https://my.checkpass.club";
const REQUEST_ORIGIN = "https://www.checkpass.club";

const appleInputs: Record<string, unknown>[] = [];
const googleInputs: Record<string, unknown>[] = [];
const kitOrigins: string[] = [];

vi.mock("@mi-pasaporte/domain/server/wallet/pass-locations-store", () => ({
  passLocationsForConsumer: async () => [],
}));

vi.mock("@mi-pasaporte/domain/server/wallet/provider", () => ({
  getWalletProvider: () => ({
    appleConfigured: true,
    googleConfigured: true,
    buildApplePass: async (input: Record<string, unknown>) => {
      appleInputs.push(input);
      return {
        bytes: Buffer.from("pkpass"),
        mime: "application/vnd.apple.pkpass" as const,
      };
    },
    buildGoogleSaveUrl: async (input: Record<string, unknown>) => {
      googleInputs.push(input);
      return "https://pay.google.com/gp/v/save/jwt";
    },
  }),
}));

vi.mock("@mi-pasaporte/domain/server/wallet/core", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@mi-pasaporte/domain/server/wallet/core")
  >()),
  ensureWalletPass: async (consumerId: string, provider: string) => ({
    id: "pass-row",
    serialNumber: `serial-${provider}`,
    authToken: "auth-token-raw",
    consumerId,
  }),
}));

vi.mock("@mi-pasaporte/domain/server/consumer/session", () => ({
  resolveSession: async () => ({
    id: "consumer-id",
    qrToken: "QR",
    firstName: "Marcos",
    lastName: "Pérez",
    webViewToken: "WVT",
  }),
}));

vi.mock("@mi-pasaporte/domain/server/wallet/passkit", () => ({
  authorizePass: async () => ({ status: "ok" }) as const,
  passServeData: async () => ({
    consumerId: "consumer-id",
    serialNumber: "serial-served",
    qrToken: "QR",
    firstName: "Marcos",
    lastName: "Pérez",
    webViewToken: "WVT",
    latestMessage: null,
    messageUpdatedAt: null,
    authToken: "auth-token-raw",
  }),
}));

vi.mock("./auth-guards", () => ({
  requireOwner: async () => ({ business: { id: "biz-1" } }),
}));

vi.mock("./brand-kit/data", () => ({
  getBrandKitData: async (_businessId: string, origin: string) => {
    kitOrigins.push(origin);
    return { status: "no_program" };
  },
}));

vi.mock("next/headers", () => ({
  headers: async () =>
    new Map([
      ["host", "www.checkpass.club"],
      ["x-forwarded-proto", "https"],
    ]),
}));

function request(url: string): NextRequest {
  return Object.assign(
    new Request(url, {
      headers: { authorization: "ApplePass auth-token-raw" },
    }),
    {
      cookies: { get: () => ({ value: "consumer-session-cookie" }) },
      nextUrl: new URL(url),
    },
  ) as unknown as NextRequest;
}

/** The `webServiceURL` and `/c/` link the real Apple builder writes for this input. */
function applePassUrls(input: Record<string, unknown>) {
  const json = buildPassJson({
    ...(input as Parameters<typeof buildPassJson>[0]),
    passTypeIdentifier: "pass.test",
    teamIdentifier: "TEAM",
  });
  const back = (json.storeCard as { backFields: { value: string }[] })
    .backFields;
  return {
    webServiceURL: json.webServiceURL,
    link: back.map((f) => f.value).find((v) => v.includes("/c/")),
  };
}

async function serveInstalledPass() {
  const { GET } =
    await import("../app/api/public/wallet/passkit/v1/passes/[passTypeId]/[serialNumber]/route");
  return GET(
    request(`${REQUEST_ORIGIN}/api/public/wallet/passkit/v1/passes/pt/s1`),
    { params: Promise.resolve({ serialNumber: "serial-served" }) },
  );
}

async function downloadApplePass() {
  const { GET } = await import("../app/api/public/wallet/apple.pkpass/route");
  return GET(request(`${REQUEST_ORIGIN}/api/public/wallet/apple.pkpass`));
}

async function googleSaveUrl() {
  const { GET } = await import("../app/api/public/wallet/google/route");
  return GET(request(`${REQUEST_ORIGIN}/api/public/wallet/google`));
}

async function renderPoster() {
  const { default: BrandKitPage } =
    await import("../app/backoffice/brand/kit/page");
  await BrandKitPage();
}

beforeEach(() => {
  appleInputs.length = 0;
  googleInputs.length = 0;
  kitOrigins.length = 0;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("with CONSUMER_ORIGIN, what is emitted carries my.", () => {
  beforeEach(() => {
    vi.stubEnv("CONSUMER_ORIGIN", MY);
  });

  // ORACULO DE M4: el primer pase de Apple sale con `webServiceURL` en my.
  it("apple.pkpass (first install): webServiceURL and /c/ link on my.", async () => {
    expect((await downloadApplePass()).status).toBe(200);
    expect(appleInputs).toHaveLength(1);
    expect(applePassUrls(appleInputs[0])).toEqual({
      webServiceURL: `${MY}/api/public/wallet/passkit`,
      link: `${MY}/c/WVT`,
    });
  });

  it("PassKit serve: a pass installed with www is re-issued on my.", async () => {
    expect((await serveInstalledPass()).status).toBe(200);
    expect(appleInputs).toHaveLength(1);
    expect(applePassUrls(appleInputs[0])).toEqual({
      webServiceURL: `${MY}/api/public/wallet/passkit`,
      link: `${MY}/c/WVT`,
    });
  });

  it("google save URL: the /c/ link of the loyalty object on my.", async () => {
    expect((await googleSaveUrl()).status).toBe(302);
    expect(googleInputs).toHaveLength(1);
    const object = buildLoyaltyObject(
      googleInputs[0] as Parameters<typeof buildLoyaltyObject>[0],
      "issuer",
    );
    expect(JSON.stringify(object)).toContain(`"${MY}/c/WVT"`);
    expect(JSON.stringify(object)).not.toContain(REQUEST_ORIGIN);
  });

  it("the poster QR (/enroll) is built with my.", async () => {
    await renderPoster();
    expect(kitOrigins).toEqual([MY]);
  });
});

describe("without CONSUMER_ORIGIN, the request origin (the behavior before 0114)", () => {
  beforeEach(() => {
    vi.stubEnv("CONSUMER_ORIGIN", "");
  });

  it("the three pass routes emit with the request origin", async () => {
    await downloadApplePass();
    await serveInstalledPass();
    await googleSaveUrl();
    expect(appleInputs.map((i) => i.origin)).toEqual([
      REQUEST_ORIGIN,
      REQUEST_ORIGIN,
    ]);
    expect(applePassUrls(appleInputs[1]).webServiceURL).toBe(
      `${REQUEST_ORIGIN}/api/public/wallet/passkit`,
    );
    expect(googleInputs.map((i) => i.origin)).toEqual([REQUEST_ORIGIN]);
  });

  it("the poster QR uses the request host", async () => {
    await renderPoster();
    expect(kitOrigins).toEqual([REQUEST_ORIGIN]);
  });
});
