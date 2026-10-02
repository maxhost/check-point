import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import {
  type World,
  dropWorld,
  owner,
  request,
  roleSuite,
  seedWorld,
  sessionFrom,
  trackConsumer,
  useRoleConnection,
} from "./consumer-role-support";
import {
  GOOGLE_CLIENT_ID,
  type TestProvider,
  testProvider,
  tokenEndpoint,
} from "./oauth-test-support";

useRoleConnection();

// El JWKS del «proveedor» de prueba: el resto de `tokens` es el real.
const keys = vi.hoisted(() => ({ jwks: null as unknown }));
vi.mock(
  "@mi-pasaporte/domain/server/consumer/oauth/tokens",
  async (original) => ({
    ...(await original<
      typeof import("@mi-pasaporte/domain/server/consumer/oauth/tokens")
    >()),
    providerJwks: () => keys.jwks,
  }),
);

import { NextRequest } from "next/server";
import {
  OAUTH_COOKIE,
  encodeOAuthState,
} from "@mi-pasaporte/domain/server/consumer/oauth/state-cookie";
import {
  generateOpaqueToken,
  hashToken,
} from "@mi-pasaporte/domain/server/consumer/core";
import { GET as googleCallback } from "../app/api/public/auth/google/callback/route";
import { POST as enrollPost } from "../app/api/public/enroll/[programId]/route";

/**
 * Spec 0119 — el alta con proveedor y la de un toque, COMO `checkpass_consumer` (ADR 0110): el
 * callback de Google con un id_token de prueba (canje y JWKS doblados; la base es la real) crea
 * cuenta SIN telefono, identidad, membresia con su `loc`, fila de `business_customer` sin
 * telefono, y sesion. ORACULO DE M7: sin el `GRANT … consumer_identity` de la `0061`, el alta de
 * la identidad muere con `42501` y el callback termina en `?error=auth`.
 */

let world: World;
let provider: TestProvider;

beforeAll(async () => {
  world = await seedWorld();
  provider = await testProvider();
  keys.jwks = provider.jwks;
}, 120_000);

afterAll(dropWorld, 120_000);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Una cuenta sin membresias, con sesion viva, sembrada como dueño. */
async function loneAccountWithSession() {
  const [account] =
    await owner`insert into consumer.consumer_account (first_name, last_name, qr_token, web_view_token)
    values ('Lia', 'Toque', ${generateOpaqueToken()}, ${generateOpaqueToken()}) returning id`;
  const id = String(account.id);
  trackConsumer(id);
  const token = generateOpaqueToken();
  await owner`insert into consumer.consumer_session (consumer_id, token_hash, expires_at)
    values (${id}, ${hashToken(token)}, now() + interval '1 day')`;
  return { id, token };
}

const membershipsOf = async (programId: string) =>
  Number(
    (
      await owner`select count(*)::int as n from consumer.program_membership where program_id = ${programId}`
    )[0].n,
  );

roleSuite("rol del cliente — ingreso con Google y alta de un toque", () => {
  it("callback de Google: cuenta sin telefono, identidad, membresia con su loc, proyeccion sin telefono y sesion", async () => {
    vi.stubEnv("CONSUMER_ORIGIN", "");
    vi.stubEnv("CONSUMER_GOOGLE_CLIENT_ID", GOOGLE_CLIENT_ID);
    vi.stubEnv("CONSUMER_GOOGLE_CLIENT_SECRET", "google-secret");
    const subject = `google-0119-${randomUUID()}`;
    const idToken = await provider.sign({
      sub: subject,
      nonce: "nonce-0119",
      email: "bea@example.test",
      email_verified: true,
      given_name: "Bea",
      family_name: "Alta",
    });
    vi.stubGlobal("fetch", tokenEndpoint(idToken).fetchImpl);
    const warnings = vi.spyOn(console, "warn");
    const cookie = encodeOAuthState({
      provider: "google",
      state: "state-0119",
      nonce: "nonce-0119",
      verifier: "verifier-0119",
      programId: world.programId,
      loc: world.homeLocation,
      exp: Date.now() + 600_000,
    });
    const response = await googleCallback(
      new NextRequest(
        "https://my.test/api/public/auth/google/callback?code=c&state=state-0119",
        { headers: { cookie: `${OAUTH_COOKIE}=${cookie}` } },
      ),
    );
    expect(
      response.headers.get("location"),
      JSON.stringify(warnings.mock.calls),
    ).toBe(`https://my.test/enroll/${world.programId}/ready`);
    expect(sessionFrom(response)).toBeTruthy();
    const [row] =
      await owner`select a.id, a.phone_e164, a.email, a.first_name, a.last_name, i.email as identity_email,
        m.origin_location_id, bc.display_name, bc.phone_e164 as bc_phone,
        (select count(*)::int from consumer.consumer_session s where s.consumer_id = a.id) as sessions
      from consumer.consumer_identity i
      join consumer.consumer_account a on a.id = i.consumer_id
      join consumer.program_membership m on m.consumer_id = a.id and m.program_id = ${world.programId}
      join core.business_customer bc on bc.consumer_id = a.id and bc.business_id = ${world.home}
      where i.provider = 'google' and i.subject = ${subject}`;
    expect(row, "no hay cuenta+identidad+membresia+proyeccion").toBeDefined();
    trackConsumer(String(row.id));
    expect(row).toMatchObject({
      phone_e164: null,
      email: "bea@example.test",
      first_name: "Bea",
      last_name: "Alta",
      identity_email: "bea@example.test",
      origin_location_id: world.homeLocation,
      display_name: "Bea Alta",
      bc_phone: null,
      sessions: 1,
    });
  });

  it("POST enroll con sesion → 201 y la membresia; otra vez → 409", async () => {
    const lone = await loneAccountWithSession();
    const send = () =>
      enrollPost(
        request(`/api/public/enroll/${world.programId}`, {
          method: "POST",
          token: lone.token,
          body: { loc: world.homeLocation },
        }),
        { params: Promise.resolve({ programId: world.programId }) },
      );
    const created = await send();
    expect(created.status, JSON.stringify(await created.clone().json())).toBe(
      201,
    );
    const rows =
      await owner`select origin_location_id from consumer.program_membership
      where consumer_id = ${lone.id} and program_id = ${world.programId}`;
    expect(rows).toEqual([{ origin_location_id: world.homeLocation }]);
    expect((await send()).status).toBe(409);
  });

  it("POST enroll sin sesion → 401 y 0 filas", async () => {
    const before = await membershipsOf(world.programId);
    const response = await enrollPost(
      request(`/api/public/enroll/${world.programId}`, {
        method: "POST",
        body: {},
      }),
      { params: Promise.resolve({ programId: world.programId }) },
    );
    expect(response.status).toBe(401);
    expect(await membershipsOf(world.programId)).toBe(before);
  });
});
