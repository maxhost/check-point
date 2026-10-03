import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { getDb } from "@mi-pasaporte/db";
import {
  SESSION_COOKIE,
  generateOpaqueToken,
  hashToken,
} from "@mi-pasaporte/domain/server/consumer/core";

/**
 * Spec 0118 / ADR 0110 — EL MUNDO DEL ORACULO POSITIVO DEL ROL DEL CLIENTE. Se siembra COMO
 * DUEÑO (`NEON_INTEGRATION_DATABASE_URL`, cliente propio) y las rutas corren con
 * `DATABASE_URL` = la URL del rol (`NEON_INTEGRATION_CONSUMER_DATABASE_URL`): todo lo que el
 * codigo del cliente lee o escribe pasa por los GRANT y las politicas de la `0060`.
 *
 * Con `NEON_INTEGRATION_ISOLATED=true` y SIN la URL del rol el archivo FALLA (ver
 * `roleUrlPresent`), no se saltea: un oraculo que se apaga solo no protege nada.
 */

const ownerUrl = process.env.NEON_INTEGRATION_DATABASE_URL;
export const roleUrl = process.env.NEON_INTEGRATION_CONSUMER_DATABASE_URL;
export const enabled =
  Boolean(ownerUrl) && process.env.NEON_INTEGRATION_ISOLATED === "true";
export const runAsRole = enabled && Boolean(roleUrl);

/** Desde aca, todo `getDb()`/`withDbTransaction` del codigo del cliente es el ROL. */
export function useRoleConnection(): void {
  if (runAsRole) process.env.DATABASE_URL = roleUrl;
}

type Row = Record<string, unknown>;

/**
 * Cada archivo del oraculo positivo abre con ESTE caso: prueba que las rutas corren COMO el
 * rol y sin bypass (corrido como dueño todo pasaria y no mediria nada) y, sin la URL del rol,
 * es el rojo que impide que el archivo se saltee.
 */
export function roleSuite(name: string, body: () => void): void {
  describe.skipIf(!enabled)(name, () => {
    it("corre COMO checkpass_consumer, sin BYPASSRLS", async () => {
      expect(
        roleUrl,
        "falta NEON_INTEGRATION_CONSUMER_DATABASE_URL",
      ).toBeTruthy();
      const result = await getDb().execute(
        sql`select current_user as who, (select rolbypassrls from pg_roles where rolname = current_user) as bypass`,
      );
      expect(result.rows).toEqual([
        { who: "checkpass_consumer", bypass: false },
      ]);
    });
    describe.skipIf(!runAsRole)("flujos del cliente", body);
  });
}
type Owner = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<Row[]>;

/** SQL como dueño de las tablas: siembra, lecturas de verificacion y teardown. */
export const owner: Owner = (strings, ...values) =>
  neon(ownerUrl!)(strings, ...values) as Promise<Row[]>;

export const HOUR = 3_600_000;
export const ISSUER_ID = "3388000000022999999";
/** Plaza de Mayo, desplazada por corrida para no cruzarse con otros mundos de la rama. */
export const GPS = {
  latitude: -34.6083 - Math.random() * 0.2,
  longitude: -58.3712,
};
const north = (meters: number) => ({
  latitude: GPS.latitude + ((meters / 6_371_000) * 180) / Math.PI,
  longitude: GPS.longitude,
});

export type World = {
  userId: string;
  home: string;
  cross: string;
  valley: string;
  homeLocation: string;
  valleyLocation: string;
  programId: string;
  productId: string;
  welcomeId: string;
  crossId: string;
  valleyId: string;
};

const businessIds: string[] = [];
const userIds: string[] = [];
const consumerIds: string[] = [];
const phones: string[] = [];

export const phone = () => {
  const value = `+5939${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
  phones.push(value);
  return value;
};

async function business(name: string, category: string) {
  const [row] =
    await owner`insert into core.business (name, country_code, timezone, category_gcid,
      logo_object_key, logo_version)
    values (${name}, 'EC', 'America/Guayaquil', ${category}, 'brand/0118/logo', 1) returning id`;
  const id = String(row.id);
  businessIds.push(id);
  await owner`insert into core.subscription (business_id, plan, status, stripe_customer_id, stripe_subscription_id)
    values (${id}, 'plus', 'active', ${`cus_${id.slice(0, 8)}`}, ${`sub_${id.slice(0, 8)}`})`;
  return id;
}

async function location(
  businessId: string,
  point: { latitude: number; longitude: number },
) {
  const [row] =
    await owner`insert into core.location (business_id, name, address_label, address_snapshot,
      country_code, latitude, longitude)
    values (${businessId}, 'Sede 0118', 'Calle 1', '{}'::jsonb, 'EC', ${point.latitude.toFixed(7)},
      ${point.longitude.toFixed(7)}) returning id`;
  return String(row.id);
}

async function offerCampaign(
  businessId: string,
  userId: string,
  template: "cross" | "valley",
) {
  const [row] =
    await owner`insert into core.campaign (business_id, kind, template_key, channel_proximity,
      channel_push, name, status, activated_at, message, coupon_label, coupon_cost, coupon_kind,
      dormant_days, cross_audience, cross_valid_days, cross_monthly_cap, valley_monthly_cap, starts_at,
      created_by_user_id)
    values (${businessId}, 'proximity', ${template}, false, false, ${`Oferta ${template}`}, 'active',
      now() - interval '30 days', 'Te esperamos', ${`Regalo ${template}`}, 1, 'custom', 30,
      ${template === "cross" ? "non_members" : null}, ${template === "cross" ? 15 : null},
      ${template === "cross" ? 100 : null}, ${template === "valley" ? 100 : null},
      now() - interval '30 days', ${userId}) returning id`;
  return String(row.id);
}

export async function seedWorld(): Promise<World> {
  const run = randomUUID().slice(0, 8);
  const userId = `role-0118-${run}`;
  await owner`insert into merchant_auth."user" (id, name, email, email_verified, created_at, updated_at)
    values (${userId}, 'Owner 0118', ${`${userId}@example.test`}, true, now(), now())`;
  userIds.push(userId);
  const home = await business(`Casa 0118 ${run}`, `gcid:home-${run}`);
  const cross = await business(`Cruzado 0118 ${run}`, `gcid:cross-${run}`);
  const valley = await business(`Valle 0118 ${run}`, `gcid:valley-${run}`);
  const homeLocation = await location(home, north(5_000));
  await location(cross, north(300));
  const valleyLocation = await location(valley, north(-300));
  for (let weekday = 1; weekday <= 7; weekday += 1)
    await owner`insert into core.valley_window (location_id, weekday, start_hour, end_hour, source)
      values (${valleyLocation}, ${weekday}, 0, 24, 'merchant')`;
  const programId = randomUUID();
  await owner`insert into core.loyalty_program (id, business_id, kind, status, configuration,
      terms_markdown, terms_hash, created_by, accrual_mode, accrual_grant)
    values (${programId}, ${home}, 'stamps', 'active', '{"unitName":"sello","target":8}'::jsonb,
      'Terminos 0118', ${`hash-${run}`}, ${userId}, 'per_purchase', 1)`;
  const [product] =
    await owner`insert into core.product (business_id, name, image_object_key, image_version)
    values (${home}, 'Cafe 0118', 'catalog/0118/cafe', 1) returning id`;
  const productId = String(product.id);
  await owner`insert into core.loyalty_reward (program_id, business_id, reward_type, label, product_id, position)
    values (${programId}, ${home}, 'catalog_product', 'Cafe gratis', ${productId}, 0)`;
  const [welcome] =
    await owner`insert into core.campaign (business_id, kind, template_key,
      channel_proximity, channel_push, name, status, activated_at, message, coupon_label, coupon_cost,
      coupon_kind, welcome_valid_days, welcome_reminder_days, welcome_monthly_cap, welcome_redeem_from,
      starts_at, created_by_user_id)
    values (${home}, 'proximity', 'welcome', false, false, 'Bienvenida', 'active',
      now() - interval '1 day', 'Bienvenido', 'Regalo de bienvenida', 1, 'custom', 7, 1, 100,
      'same_visit', now() - interval '1 day', ${userId}) returning id`;
  return {
    userId,
    home,
    cross,
    valley,
    homeLocation,
    valleyLocation,
    programId,
    productId,
    welcomeId: String(welcome.id),
    crossId: await offerCampaign(cross, userId, "cross"),
    valleyId: await offerCampaign(valley, userId, "valley"),
  };
}

export type Member = {
  id: string;
  phone: string;
  membershipId: string;
  token: string;
  webViewToken: string;
};

/** Un cliente sembrado por el DUEÑO, miembro del programa, con una sesion viva. */
export async function seedMember(world: World): Promise<Member> {
  const number = phone();
  const webViewToken = generateOpaqueToken();
  const [account] =
    await owner`insert into consumer.consumer_account (phone_e164, first_name, last_name,
      country_iso, qr_token, web_view_token, latest_message, message_updated_at)
    values (${number}, 'Ana', 'Rol', 'EC', ${generateOpaqueToken()}, ${webViewToken}, 'Hola',
      now()) returning id`;
  const id = String(account.id);
  consumerIds.push(id);
  const [membership] =
    await owner`insert into consumer.program_membership (consumer_id, program_id, business_id,
      enrolled_at)
    values (${id}, ${world.programId}, ${world.home}, now() - interval '1 hour') returning id`;
  const token = generateOpaqueToken();
  await owner`insert into consumer.consumer_session (consumer_id, token_hash, expires_at)
    values (${id}, ${hashToken(token)}, now() + interval '1 day')`;
  return {
    id,
    phone: number,
    membershipId: String(membership.id),
    token,
    webViewToken,
  };
}

export const trackConsumer = (id: string) => consumerIds.push(id);

export function request(
  path: string,
  init: {
    method?: string;
    token?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): NextRequest {
  const headers: Record<string, string> = { ...init.headers };
  if (init.token) headers.cookie = `${SESSION_COOKIE}=${init.token}`;
  return new NextRequest(`https://my.test${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

/** El token de la cookie de sesion de una respuesta. */
export function sessionFrom(response: Response): string | null {
  const match = /consumer_session=([^;]+)/.exec(
    response.headers.get("set-cookie") ?? "",
  );
  return match ? match[1] : null;
}

export async function dropWorld(): Promise<void> {
  const accounts =
    await owner`select id from consumer.consumer_account where phone_e164 = any(${phones})`;
  const consumers = [
    ...new Set([...consumerIds, ...accounts.map((row) => String(row.id))]),
  ];
  // Spec 0143: un pedido sembrado (el clic del regalo misterio) se lleva su `cross_decision` en
  // cascada, que apunta a la campaña cruzada (NO ACTION) y a la cuenta.
  await owner`delete from core."order" where business_id = any(${businessIds}::uuid[])`;
  await owner`delete from core.welcome_device where business_id = any(${businessIds}::uuid[])`;
  await owner`delete from core.campaign_coupon where business_id = any(${businessIds}::uuid[])
    or consumer_id = any(${consumers}::uuid[])`;
  await owner`delete from core.campaign_push where business_id = any(${businessIds}::uuid[])`;
  await owner`delete from core.campaign where business_id = any(${businessIds}::uuid[])`;
  await owner`delete from consumer.program_membership where consumer_id = any(${consumers}::uuid[])
    or business_id = any(${businessIds}::uuid[])`;
  // `consumer_identity` y las sesiones caen en cascada con la cuenta.
  await owner`delete from consumer.consumer_account where id = any(${consumers}::uuid[])`;
  await owner`delete from core.loyalty_reward where business_id = any(${businessIds}::uuid[])`;
  await owner`delete from core.loyalty_program where business_id = any(${businessIds}::uuid[])`;
  await owner`delete from core.business where id = any(${businessIds}::uuid[])`;
  await owner`delete from merchant_auth."user" where id = any(${userIds})`;
}
