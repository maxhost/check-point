import { NextRequest } from "next/server";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { integrationEnabled } from "./counter-integration-support";
import { POST as callback } from "../app/api/public/wallet/google/callback/route";
import { GOOGLE_ROOT_KEYS_URL } from "./wallet/google-callback";
import {
  ecKeyPair,
  rootKeyOf,
  signedCallback,
} from "./google-callback-support";
import {
  DAY,
  dropWelcomeWorlds,
  googlePass,
  readGoogleSavedAt,
  readWelcomeCoupons,
  welcomeConsumer,
  welcomeWorld,
} from "./marketing-welcome-support";

/**
 * Google's `save` callback THROUGH ITS ROUTE (spec 0107 §4, E3): the only way Android says
 * «installed». The root keys the route fetches are the test's own (a pass-through `fetch`
 * stub answers Google's keys URL and lets the database's requests through). No tick runs:
 * the coupon can only come from the route.
 */

afterAll(dropWelcomeWorlds, 120_000);

const ISSUER = "3388000000099999999";
const root = ecKeyPair();
const intermediate = ecKeyPair();
const realFetch = globalThis.fetch;

beforeEach(() => {
  vi.stubEnv("GOOGLE_WALLET_ISSUER_ID", ISSUER);
  vi.stubGlobal("fetch", (input: unknown, init?: RequestInit) =>
    String(input) === GOOGLE_ROOT_KEYS_URL
      ? Promise.resolve(Response.json({ keys: [rootKeyOf(root)] }))
      : realFetch(input as Parameters<typeof fetch>[0], init),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function post(body: unknown) {
  return callback(
    new NextRequest("https://example.test/api/public/wallet/google/callback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

function message(serial: string, eventType = "save") {
  return {
    classId: `${ISSUER}.mipasaporte_identity`,
    objectId: `${ISSUER}.${serial}`,
    eventType,
    expTimeMillis: Date.now() + 60_000,
    nonce: `n-${serial}`,
  };
}

async function androidWorld(label: string) {
  const now = Date.now();
  const world = await welcomeWorld(label, { activatedAt: new Date(now - DAY) });
  const person = await welcomeConsumer(world, new Date(now - 60_000));
  const serial = await googlePass(person.consumerId);
  return { world, person, serial };
}

describe.skipIf(!integrationEnabled)("welcome gift — Google callback", () => {
  it("ORACULO DE M8: a signed `save` stamps google_saved_at and issues the gift", async () => {
    const { world, person, serial } = await androidWorld("Welcome M8");
    const response = await post(
      signedCallback({
        issuerId: ISSUER,
        message: message(serial),
        root,
        intermediate,
      }),
    );
    expect(response.status).toBe(200);
    expect(await readGoogleSavedAt(serial)).toBeInstanceOf(Date);
    expect(
      (await readWelcomeCoupons(world.seed.business.id)).map(
        (c) => c.membershipId,
      ),
    ).toEqual([person.membershipId]);
  }, 120_000);

  it("ORACULO DE M9 (ruta): a message signed by another intermediate is a 401 and writes nothing", async () => {
    const { world, serial } = await androidWorld("Welcome M9");
    const response = await post(
      signedCallback({
        issuerId: ISSUER,
        message: message(serial),
        root,
        intermediate,
        messageSigner: ecKeyPair(),
      }),
    );
    expect(response.status).toBe(401);
    expect(await readGoogleSavedAt(serial)).toBeNull();
    expect(await readWelcomeCoupons(world.seed.business.id)).toEqual([]);
  }, 120_000);

  it("a `del`, another class or a malformed body change nothing", async () => {
    const { world, serial } = await androidWorld("Welcome del");
    const del = await post(
      signedCallback({
        issuerId: ISSUER,
        message: message(serial, "del"),
        root,
        intermediate,
      }),
    );
    expect(del.status).toBe(200);
    const foreign = await post(
      signedCallback({
        issuerId: ISSUER,
        message: { ...message(serial), classId: `${ISSUER}.otra_clase` },
        root,
        intermediate,
      }),
    );
    expect(foreign.status).toBe(200);
    expect((await post({ hola: 1 })).status).toBe(400);
    expect(await readGoogleSavedAt(serial)).toBeNull();
    expect(await readWelcomeCoupons(world.seed.business.id)).toEqual([]);
  }, 120_000);
});
