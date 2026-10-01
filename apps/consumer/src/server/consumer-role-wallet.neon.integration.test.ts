import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import {
  ISSUER_ID,
  type Member,
  type World,
  dropWorld,
  owner,
  request,
  roleSuite,
  seedMember,
  seedWorld,
  sessionFrom,
  useRoleConnection,
} from "./consumer-role-support";
import { GET as magicLink } from "../app/(consumer)/c/[webViewToken]/route";
import { GET as manifest } from "../app/(consumer)/wallet/manifest.webmanifest/route";
import { GET as applePass } from "../app/api/public/wallet/apple.pkpass/route";
import { GET as googleSave } from "../app/api/public/wallet/google/route";
import { POST as googleCallback } from "../app/api/public/wallet/google/callback/route";
import {
  DELETE as unregister,
  POST as register,
} from "../app/api/public/wallet/passkit/v1/devices/[deviceLibraryId]/registrations/[passTypeId]/[serialNumber]/route";
import { GET as serials } from "../app/api/public/wallet/passkit/v1/devices/[deviceLibraryId]/registrations/[passTypeId]/route";
import { GET as servePass } from "../app/api/public/wallet/passkit/v1/passes/[passTypeId]/[serialNumber]/route";
import { POST as passkitLog } from "../app/api/public/wallet/passkit/v1/log/route";
import {
  GOOGLE_ROOT_KEYS_URL,
  lengthValue,
} from "@mi-pasaporte/domain/server/wallet/google-callback";
import { loyaltyClassId } from "@mi-pasaporte/domain/server/wallet/google-object";
import { passLocationsForConsumer } from "@mi-pasaporte/domain/server/wallet/pass-locations-store";

useRoleConnection();

/**
 * Spec 0118 — ORACULO POSITIVO del rol del cliente: la billetera. El enlace magico y su
 * manifiesto, los pases Apple/Google con el proveedor `fake` (NODE_ENV=test), el ciclo PassKit
 * (registrar — que ES la instalacion y emite la Bienvenida —, listar, servir, desregistrar,
 * log) y el callback firmado de Google (con una raiz de prueba: `fetch` de las claves de Google
 * doblado). La Bienvenida es best-effort y traga su error: por eso se lee el cupon, no el 200.
 */

const PASS_TYPE = "pass.com.mipasaporte.dev";
const DEVICE = `device-0118-${Date.now()}`;
let world: World;
let apple: Member;
let android: Member;

beforeAll(async () => {
  world = await seedWorld();
  apple = await seedMember(world);
  android = await seedMember(world);
  await owner`insert into consumer.pass_placement (consumer_id, location_id, slot_kind, business_id, relevant_text)
    values (${apple.id}, ${world.homeLocation}, 'utility', ${world.home}, 'Estas cerca')`;
}, 120_000);

afterAll(dropWorld, 120_000);

const applePassRow = async (consumerId: string) =>
  (
    await owner`select serial_number, auth_token from consumer.wallet_pass
    where consumer_id = ${consumerId} and provider = 'apple'`
  )[0];
const welcomeCoupons = (consumerId: string) =>
  owner`select id from core.campaign_coupon where campaign_id = ${world.welcomeId} and consumer_id = ${consumerId}`;
const passkitParams = (serialNumber: string) => ({
  params: Promise.resolve({
    deviceLibraryId: DEVICE,
    passTypeId: PASS_TYPE,
    serialNumber,
  }),
});

roleSuite("rol del cliente — billetera, PassKit y Google", () => {
  it("GET /c/[token]: abre sesion, marca la apertura y redirige a /wallet; el manifiesto lo lleva", async () => {
    const response = await magicLink(request(`/c/${apple.webViewToken}`), {
      params: Promise.resolve({ webViewToken: apple.webViewToken }),
    });
    expect(response.status).toBe(302);
    expect(sessionFrom(response)).toBeTruthy();
    const [row] = await owner`select last_opened_at,
        (select count(*)::int from consumer.consumer_session where consumer_id = ${apple.id}) as sessions
      from consumer.consumer_account where id = ${apple.id}`;
    expect(row.last_opened_at).not.toBeNull();
    expect(row.sessions).toBe(2);
    const body = await (
      await manifest(
        request(`/wallet/manifest.webmanifest?c=${apple.webViewToken}`),
      )
    ).json();
    expect(body.start_url).toBe(`/c/${apple.webViewToken}`);
  });

  it("GET apple.pkpass: crea el pase con su token estable y lo sirve, con las puertas del pase", async () => {
    expect(await passLocationsForConsumer(apple.id)).toHaveLength(1);
    const response = await applePass(
      request("/api/public/wallet/apple.pkpass", { token: apple.token }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/vnd.apple.pkpass",
    );
    expect((await applePassRow(apple.id))?.auth_token).toBeTruthy();
  });

  it("PassKit: registrar (201 + Bienvenida + dispositivo quemado), re-registrar 200, listar, servir", async () => {
    const pass = await applePassRow(apple.id);
    const auth = { authorization: `ApplePass ${pass.auth_token}` };
    const post = () =>
      register(
        request(`/x`, {
          method: "POST",
          headers: auth,
          body: { pushToken: "apns-0118" },
        }),
        passkitParams(String(pass.serial_number)),
      );
    expect((await post()).status).toBe(201);
    expect(await welcomeCoupons(apple.id)).toHaveLength(1);
    const burned =
      await owner`select 1 from core.welcome_device where business_id = ${world.home}
      and device_library_id = ${DEVICE}`;
    expect(burned).toHaveLength(1);
    expect((await post()).status).toBe(200);
    const list = await serials(
      request(`/x?passesUpdatedSince=0`),
      passkitParams(""),
    );
    expect(list.status).toBe(200);
    expect(
      ((await list.json()) as { serialNumbers: string[] }).serialNumbers,
    ).toEqual([pass.serial_number]);
    const served = await servePass(
      request("/x", { headers: auth }),
      passkitParams(String(pass.serial_number)),
    );
    expect(served.status).toBe(200);
  });

  it("PassKit: desregistrar borra el dispositivo; el log responde 200", async () => {
    const pass = await applePassRow(apple.id);
    const response = await unregister(
      request("/x", {
        method: "DELETE",
        headers: { authorization: `ApplePass ${pass.auth_token}` },
      }),
      passkitParams(String(pass.serial_number)),
    );
    expect(response.status).toBe(200);
    expect(
      await owner`select 1 from consumer.wallet_push_device where device_library_id = ${DEVICE}`,
    ).toEqual([]);
    expect(
      (
        await passkitLog(
          request("/x", { method: "POST", body: { logs: ["0118"] } }),
        )
      ).status,
    ).toBe(200);
  });

  it("GET google: crea el pase Google y redirige al guardado", async () => {
    const response = await googleSave(
      request("/api/public/wallet/google", { token: android.token }),
    );
    expect(response.status).toBe(302);
    const rows =
      await owner`select 1 from consumer.wallet_pass where consumer_id = ${android.id} and provider = 'google'`;
    expect(rows).toHaveLength(1);
  });

  it("POST google/callback firmado: marca google_saved_at y emite la Bienvenida", async () => {
    const [pass] = await owner`select serial_number from consumer.wallet_pass
      where consumer_id = ${android.id} and provider = 'google'`;
    const root = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const intermediate = generateKeyPairSync("ec", {
      namedCurve: "prime256v1",
    });
    vi.stubEnv("GOOGLE_WALLET_ISSUER_ID", ISSUER_ID);
    // Solo las claves de Google: el driver neon-http de la base TAMBIEN va por `fetch`.
    const realFetch = globalThis.fetch;
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) =>
      String(input) === GOOGLE_ROOT_KEYS_URL
        ? Promise.resolve(
            Response.json({
              keys: [
                {
                  keyValue: spki(root.publicKey),
                  protocolVersion: "ECv2SigningOnly",
                },
              ],
            }),
          )
        : realFetch(input, init),
    );
    try {
      const response = await googleCallback(
        request("/api/public/wallet/google/callback", {
          method: "POST",
          body: envelope(root.privateKey, intermediate, {
            classId: loyaltyClassId(ISSUER_ID),
            objectId: `${ISSUER_ID}.${pass.serial_number}`,
            eventType: "save",
            expTimeMillis: String(Date.now() + 600_000),
          }),
        }),
      );
      expect(response.status).toBe(200);
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
    const [row] = await owner`select google_saved_at from consumer.wallet_pass
      where consumer_id = ${android.id} and provider = 'google'`;
    expect(row.google_saved_at).not.toBeNull();
    expect(await welcomeCoupons(android.id)).toHaveLength(1);
  });
});

const spki = (key: KeyObject) =>
  key.export({ format: "der", type: "spki" }).toString("base64");
const der = (data: Buffer, key: KeyObject) =>
  sign("sha256", data, { key, dsaEncoding: "der" }).toString("base64");

/** El sobre `ECv2SigningOnly` con el MISMO formato que verifica `verifyGoogleCallback`. */
function envelope(
  rootKey: KeyObject,
  intermediate: { publicKey: KeyObject; privateKey: KeyObject },
  message: Record<string, unknown>,
) {
  const signedKey = JSON.stringify({
    keyValue: spki(intermediate.publicKey),
    keyExpiration: "4102444800000",
  });
  const signedMessage = JSON.stringify(message);
  return {
    protocolVersion: "ECv2SigningOnly",
    intermediateSigningKey: {
      signedKey,
      signatures: [
        der(
          lengthValue("GooglePayPasses", "ECv2SigningOnly", signedKey),
          rootKey,
        ),
      ],
    },
    signedMessage,
    signature: der(
      lengthValue(
        "GooglePayPasses",
        ISSUER_ID,
        "ECv2SigningOnly",
        signedMessage,
      ),
      intermediate.privateKey,
    ),
  };
}
