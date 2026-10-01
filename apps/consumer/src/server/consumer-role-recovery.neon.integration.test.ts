import type { NextRequest } from "next/server";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import {
  type Member,
  type World,
  dropWorld,
  owner,
  phone,
  request,
  roleSuite,
  seedMember,
  seedWorld,
  sessionFrom,
  useRoleConnection,
} from "./consumer-role-support";
import { POST as requestCode } from "../app/api/public/recovery/request/route";
import { POST as resendCode } from "../app/api/public/recovery/resend/route";
import { POST as verifyCode } from "../app/api/public/recovery/verify/route";
import { POST as completeProfile } from "../app/api/public/recovery/profile/route";
import { decryptOtp } from "@mi-pasaporte/domain/server/otp/core";

useRoleConnection();

/**
 * Spec 0118 — ORACULO POSITIVO del rol del cliente: la recuperacion por OTP con el canal
 * `console` (sin SMS). Pedido y reenvio (reserva bajo lock + entrega), verificacion de una
 * cuenta EXISTENTE (revoca sesiones y ROTA las credenciales: borra dispositivos y
 * suscripciones, encola el aviso del pase) y de un telefono NUEVO (perfil → cuenta + sesion).
 * El codigo se descifra de la base como dueño, con la misma clave que usa el servidor.
 */

const KEY = Buffer.alloc(32, 7).toString("base64");
let world: World;
let member: Member;

beforeAll(async () => {
  vi.stubEnv("RECOVERY_ENABLED", "true");
  vi.stubEnv("OTP_PROVIDER", "console");
  vi.stubEnv(
    "OTP_HMAC_SECRET",
    "integration-hmac-secret-0118-at-least-32-bytes",
  );
  vi.stubEnv("OTP_ENCRYPTION_KEY", KEY);
  world = await seedWorld();
  member = await seedMember(world);
  const [pass] =
    await owner`insert into consumer.wallet_pass (consumer_id, provider, serial_number, auth_token)
    values (${member.id}, 'apple', ${`serial-${member.id}`}, ${`token-${member.id}`}) returning id`;
  await owner`insert into consumer.wallet_push_device (wallet_pass_id, device_library_id, push_token)
    values (${pass.id}, ${`device-${member.id}`}, 'apns-0118')`;
  await owner`insert into consumer.web_push_subscription (consumer_id, endpoint, p256dh_key, auth_key, platform)
    values (${member.id}, ${`https://push.example.test/r/${member.id}`}, 'p', 'a', 'other')`;
}, 120_000);

afterAll(async () => {
  vi.unstubAllEnvs();
  await dropWorld();
}, 120_000);

const post = (
  handler: (r: NextRequest) => Promise<Response>,
  path: string,
  body: unknown,
  cookie?: string,
) =>
  handler(
    request(path, { method: "POST", body, headers: cookie ? { cookie } : {} }),
  );

async function codeFor(challengeId: string): Promise<string> {
  const [row] =
    await owner`select code_ciphertext from consumer.otp_challenge where id = ${challengeId}`;
  return decryptOtp(String(row.code_ciphertext), KEY);
}

async function askCode(number: string): Promise<string> {
  const response = await post(requestCode, "/api/public/recovery/request", {
    phoneE164: number,
    countryIso: "EC",
  });
  expect(response.status, JSON.stringify(await response.clone().json())).toBe(
    202,
  );
  return ((await response.json()) as { challengeId: string }).challengeId;
}

roleSuite("rol del cliente — recuperacion por OTP", () => {
  it("request + resend: el desafio y sus dos entregas aceptadas", async () => {
    const challengeId = await askCode(member.phone);
    await owner`update consumer.otp_challenge set resend_available_at = now() - interval '1 second'
      where id = ${challengeId}`;
    const resent = await post(resendCode, "/api/public/recovery/resend", {
      challengeId,
    });
    expect(resent.status).toBe(202);
    const [row] = await owner`select c.delivery_count,
        (select count(*)::int from consumer.otp_delivery d where d.challenge_id = c.id and d.status = 'accepted') as accepted
      from consumer.otp_challenge c where c.id = ${challengeId}`;
    expect(row).toEqual({ delivery_count: 2, accepted: 2 });
  });

  it("verify de una cuenta existente: sesion nueva, las viejas revocadas, credenciales rotadas", async () => {
    const challengeId = await askCode(member.phone);
    const response = await post(verifyCode, "/api/public/recovery/verify", {
      challengeId,
      code: await codeFor(challengeId),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ next: "wallet" });
    expect(sessionFrom(response)).toBeTruthy();
    const [row] = await owner`select a.web_view_token, a.phone_verified_at,
        (select count(*)::int from consumer.consumer_session s where s.consumer_id = a.id and s.revoked_at is null) as live,
        (select count(*)::int from consumer.wallet_push_device d join consumer.wallet_pass p on p.id = d.wallet_pass_id
          where p.consumer_id = a.id) as devices,
        (select count(*)::int from consumer.web_push_subscription w where w.consumer_id = a.id) as subs,
        (select count(*)::int from consumer.wallet_push_queue q where q.consumer_id = a.id) as queued
      from consumer.consumer_account a where a.id = ${member.id}`;
    expect(row).toMatchObject({ live: 1, devices: 0, subs: 0, queued: 1 });
    expect(row.web_view_token).not.toBe(member.webViewToken);
    expect(row.phone_verified_at).not.toBeNull();
  });

  it("verify de un telefono nuevo → perfil: crea la cuenta y abre su sesion", async () => {
    const number = phone();
    const challengeId = await askCode(number);
    const verified = await post(verifyCode, "/api/public/recovery/verify", {
      challengeId,
      code: await codeFor(challengeId),
    });
    expect(await verified.json()).toEqual({ next: "profile" });
    const ticket = /consumer_recovery_onboarding=([^;]+)/.exec(
      verified.headers.get("set-cookie") ?? "",
    )?.[1];
    expect(ticket).toBeTruthy();
    const response = await post(
      completeProfile,
      "/api/public/recovery/profile",
      { firstName: "Nora", lastName: "Nueva" },
      `consumer_recovery_onboarding=${ticket}`,
    );
    expect(response.status).toBe(201);
    const [row] = await owner`select a.first_name,
        (select count(*)::int from consumer.consumer_session s where s.consumer_id = a.id) as sessions
      from consumer.consumer_account a where a.phone_e164 = ${number}`;
    expect(row).toEqual({ first_name: "Nora", sessions: 1 });
  });
});
