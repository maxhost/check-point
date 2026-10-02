import { afterAll, beforeAll, expect, it, vi } from "vitest";
import {
  type Member,
  type World,
  dropWorld,
  owner,
  request,
  roleSuite,
  seedMember,
  seedWorld,
  useRoleConnection,
} from "./consumer-role-support";

useRoleConnection();

// R2 no existe en la CI: el objeto se dobla para que el 200 de logo/imagen pruebe la LECTURA de
// la base (sin el doble, una lectura denegada y un R2 ausente darian el mismo 404).
vi.mock("@mi-pasaporte/domain/server/r2", async (original) => ({
  ...(await original<typeof import("@mi-pasaporte/domain/server/r2")>()),
  getPrivateObject: async () => ({
    Body: (async function* () {
      yield new Uint8Array([1, 2, 3]);
    })(),
  }),
}));

import { GET as enrollMe } from "../app/api/public/enroll/me/route";
import { POST as optOut } from "../app/api/public/consumer/marketing-opt-out/route";
import { POST as subscribe } from "../app/api/public/push/subscribe/route";
import { POST as click } from "../app/api/public/push/click/route";
import { POST as homeLaunch } from "../app/api/public/home/launch/route";
import { listWelcomeCoupons } from "@mi-pasaporte/domain/server/consumer/welcome-coupons";
import { GET as logo } from "../app/api/public/brands/[businessId]/logo/route";
import { GET as productImage } from "../app/api/public/catalog/[productId]/image/route";
import { GET as stamp } from "../app/api/public/loyalty/[businessId]/[programId]/stamp/route";
import { getEnrollLanding } from "@mi-pasaporte/domain/server/consumer/enrollment";
import { listConsumerPrograms } from "@mi-pasaporte/domain/server/consumer/programs";
import { resolveSession } from "@mi-pasaporte/domain/server/consumer/session";
import { hasWebPushSubscription } from "@mi-pasaporte/domain/server/push/subscriptions";
import { markAccountOpened } from "@mi-pasaporte/domain/server/wallet/reminder-store";

/**
 * Spec 0118 — ORACULO POSITIVO del rol del cliente (ADR 0110): alta, mis programas, las paginas,
 * el opt-out, el Web Push, las imagenes publicas y el sello, COMO `checkpass_consumer` (el alta con
 * Google/Apple y la de un toque, spec 0119, estan en `consumer-role-auth`). Cada caso
 * asevera el RESULTADO DE NEGOCIO leido como dueño, no solo el codigo HTTP: varias escrituras
 * del cliente son best-effort y tragan su error (`markAccountOpened`, el regalo de bienvenida).
 * ORACULO DE M3 de la 0118 (`enroll/me` y mis programas: 0 filas, no un error).
 */

let world: World;
let member: Member;

beforeAll(async () => {
  world = await seedWorld();
  member = await seedMember(world);
}, 120_000);

afterAll(dropWorld, 120_000);

roleSuite("rol del cliente — alta, programas, push e imagenes", () => {
  it("GET enroll/me: la membresia del cliente de la sesion (0 filas = politica SELECT ausente)", async () => {
    const response = await enrollMe(
      request("/api/public/enroll/me", { token: member.token }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      memberships: { programId: string }[];
    };
    expect(body.memberships.map((m) => m.programId)).toEqual([world.programId]);
  });

  it("pagina /wallet: sesion, mis programas con su premio y su imagen, push y apertura de la cuenta", async () => {
    expect((await resolveSession(member.token))?.id).toBe(member.id);
    const programs = await listConsumerPrograms(member.id);
    expect(programs.map((p) => p.programId)).toEqual([world.programId]);
    expect(programs[0].rewards).toHaveLength(1);
    expect(programs[0].rewards[0].imagePath).toContain(world.productId);
    expect(await hasWebPushSubscription(member.id)).toBe(false);
    await markAccountOpened(member.id);
    const [row] =
      await owner`select last_opened_at from consumer.consumer_account where id = ${member.id}`;
    expect(row.last_opened_at).not.toBeNull();
  });

  it("pagina /enroll: la landing del programa con su oferta de bienvenida", async () => {
    const landing = await getEnrollLanding(world.programId);
    expect(landing?.businessId).toBe(world.home);
    expect(landing?.hasLogo).toBe(true);
    expect(landing?.welcomeOffer?.label).toBe("Regalo de bienvenida");
  });

  it("POST marketing-opt-out: apaga y vuelve a encender, escrito en la membresia", async () => {
    const send = (value: boolean) =>
      optOut(
        request("/api/public/consumer/marketing-opt-out", {
          method: "POST",
          token: member.token,
          body: { programId: world.programId, optOut: value },
        }),
      );
    const off = await send(true);
    expect(off.status).toBe(200);
    expect(await off.json()).toEqual({ marketingOptOut: true });
    const [row] =
      await owner`select marketing_opt_out_at from consumer.program_membership where id = ${member.membershipId}`;
    expect(row.marketing_opt_out_at).not.toBeNull();
    expect(await (await send(false)).json()).toEqual({
      marketingOptOut: false,
    });
  });

  it("POST push/subscribe: crea y despues actualiza la suscripcion (upsert por endpoint)", async () => {
    const endpoint = `https://push.example.test/${member.id}`;
    const send = (auth: string) =>
      subscribe(
        request("/api/public/push/subscribe", {
          method: "POST",
          token: member.token,
          body: { endpoint, keys: { p256dh: "p256dh-0118", auth } },
        }),
      );
    expect((await send("auth-1")).status).toBe(201);
    expect((await send("auth-2")).status).toBe(201);
    const rows =
      await owner`select auth_key from consumer.web_push_subscription where consumer_id = ${member.id}`;
    expect(rows).toEqual([{ auth_key: "auth-2" }]);
    expect(await hasWebPushSubscription(member.id)).toBe(true);
  });

  it("POST push/click: marca clicked_at del push enviado", async () => {
    const [push] =
      await owner`insert into core.campaign_push (campaign_id, business_id, consumer_id,
        membership_id, holdout, decided_at, sent_at)
      values (${world.welcomeId}, ${world.home}, ${member.id}, ${member.membershipId}, false, now(), now())
      returning id`;
    const response = await click(
      request("/api/public/push/click", {
        method: "POST",
        body: { id: push.id },
      }),
    );
    expect(response.status).toBe(204);
    const [row] =
      await owner`select clicked_at from core.campaign_push where id = ${push.id}`;
    expect(row.clicked_at).not.toBeNull();
  });

  it("POST home/launch: marca home_launched_at, emite la Bienvenida sin error tragado y lista los cupones", async () => {
    // `issueWelcomeGiftsSafely` traga su error: sin el espia, un GRANT faltante del regalo daria
    // el mismo 200 que el camino feliz.
    const swallowed = vi.spyOn(console, "error");
    try {
      const response = await homeLaunch(
        request("/api/public/home/launch", {
          method: "POST",
          token: member.token,
        }),
      );
      expect(response.status).toBe(200);
      expect(
        swallowed.mock.calls.filter((call) =>
          String(call[0]).startsWith("[welcome]"),
        ),
      ).toEqual([]);
    } finally {
      swallowed.mockRestore();
    }
    const [row] =
      await owner`select home_launched_at from consumer.consumer_account where id = ${member.id}`;
    expect(row.home_launched_at).not.toBeNull();
    const expected =
      await owner`select c.id from core.campaign_coupon c where c.consumer_id = ${member.id}
      and c.welcome_membership_id is not null and c.valid_until > now()
      and not exists (select 1 from core.coupon_redemption r where r.coupon_id = c.id)`;
    const coupons = await listWelcomeCoupons(member.id);
    expect(coupons.map((c) => c.id).sort()).toEqual(
      expected.map((r) => String(r.id)).sort(),
    );
  });

  it("GET logo, imagen de producto y sello: 200 con los bytes (el sello es el placeholder PNG)", async () => {
    const logoResponse = await logo(
      request(`/api/public/brands/${world.home}/logo?v=1`),
      {
        params: Promise.resolve({ businessId: world.home }),
      },
    );
    expect(logoResponse.status).toBe(200);
    expect(Buffer.from(await logoResponse.arrayBuffer())).toEqual(
      Buffer.from([1, 2, 3]),
    );
    const imageResponse = await productImage(
      request(`/api/public/catalog/${world.productId}/image?v=1`),
      {
        params: Promise.resolve({ productId: world.productId }),
      },
    );
    expect(imageResponse.status).toBe(200);
    const stampResponse = await stamp(
      request(`/api/public/loyalty/${world.home}/${world.programId}/stamp?v=0`),
      {
        params: Promise.resolve({
          businessId: world.home,
          programId: world.programId,
        }),
      },
    );
    expect(stampResponse.status).toBe(200);
    expect(stampResponse.headers.get("content-type")).toBe("image/png");
  });
});
