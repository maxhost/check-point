import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// better-auth necesita estas dos; el token de seleccion se firma con la primera.
process.env.BETTER_AUTH_SECRET ||= "integration-secret-at-least-32-chars-xx";
process.env.BETTER_AUTH_URL ||= "http://localhost:3001";
// El canal `console` no entrega nada: el link se ENCOLA (fila en `verification`), que es
// lo que se cuenta.
process.env.EMAIL_PROVIDER = "console";

const url = process.env.NEON_INTEGRATION_DATABASE_URL;
const enabled =
  Boolean(url) && process.env.NEON_INTEGRATION_ISOLATED === "true";
if (enabled) process.env.DATABASE_URL = url;

import { getDb } from "@mi-pasaporte/db";
import {
  businesses,
  locationVerifications,
  locations,
  loyaltyPrograms,
  memberships,
  ownerProfiles,
  subscriptions,
  users,
} from "@mi-pasaporte/db/schema";
import { getMerchantAuth } from "./auth";
import { START_RATE_LIMITS } from "./auth-start";
import {
  businessesNamed,
  dropSignups,
  linkTokenCount,
  rawUserInsertViolation,
  sessionCount,
  signup,
  signupBody,
  userByEmail,
} from "./onboarding-signup-integration-support";
import {
  CUENCA_PLACE,
  testSelectionToken,
} from "./places/selection-test-support";

/**
 * Spec 0155 — `POST /api/onboarding/signup` CONTRA LA BASE. Absorbe los casos de
 * `auth-start.neon` (spec 0067 §2) y `onboarding-business.neon` (spec 0069), borrados con
 * sus rutas (tabla de equivalencias en el handoff de la 0155). Los rechazos (400/422) viven
 * en `onboarding-signup-rechazos.neon.integration.test.ts`.
 *
 * El invariante portante sigue siendo el de la 0067: un email CONOCIDO no abre sesion ni
 * crea nada. Se mide con las dos mitades —la cabecera `set-cookie` Y las filas por SQL—,
 * porque cualquiera sola deja medio agujero.
 */
describe.skipIf(!enabled)("POST /api/onboarding/signup (spec 0155)", () => {
  const tag = randomUUID();
  const fresh = `signup-nuevo-${tag}@example.test`;
  const mexican = `signup-mx-${tag}@example.test`;
  const known = `signup-conocido-${tag}@example.test`;
  const knownId = `signup-int-${tag}`;
  const racing = `signup-carrera-${tag}@example.test`;
  // Spec 0156 (B): un email con MAYUSCULAS ya no puede guardarse (CHECK
  // `merchant_auth_user_email_lowercase`), asi que el unico crudo es insensible a mayusculas.
  const mixedStored = `Signup-Mayus-${tag}@Example.test`;
  const mixed = mixedStored.toLowerCase();
  const mixedId = `signup-int-mayus-${tag}`;
  const emails = [fresh, mexican, known, racing, mixed];

  beforeAll(async () => {
    await dropSignups(emails);
    await getDb().insert(users).values({
      id: knownId,
      name: "Ana Conocida",
      email: known,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }, 60_000);

  afterAll(async () => {
    await dropSignups(emails);
  }, 60_000);

  it("email NUEVO: 201 + cookie, y cuenta, negocio, local, verificacion y suscripcion en la base", async () => {
    const body = signupBody(fresh);
    const response = await signup(body);
    expect(response.status).toBe(201);
    const text = await response.text();
    const json = JSON.parse(text);
    expect(json).toMatchObject({
      created: true,
      verificationSent: true,
      business: { name: body.business!.name },
    });
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("HttpOnly");

    const [user] = await userByEmail(fresh);
    expect(user).toMatchObject({
      name: "",
      email_verified: false,
      accounts: 0,
    });
    const session = await getMerchantAuth().api.getSession({
      headers: new Headers({ cookie: cookie.split(";")[0] }),
    });
    expect(session?.user.id).toBe(user.id);

    const db = getDb();
    expect(await sessionCount(user.id)).toBe(1);

    const [business] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, json.business.id));
    expect(business).toMatchObject({
      name: body.business!.name,
      slug: json.business.slug,
      categoryGcid: "gcid:pharmacy",
      countryCode: "EC",
      timezone: CUENCA_PLACE.timezone,
      currencyCode: "USD",
    });
    const [membership] = await db
      .select()
      .from(memberships)
      .where(eq(memberships.businessId, business.id));
    expect(membership).toMatchObject({ userId: user.id, role: "owner" });
    const profiles = await db
      .select()
      .from(ownerProfiles)
      .where(eq(ownerProfiles.userId, user.id));
    expect(profiles).toHaveLength(1);

    const [location] = await db
      .select()
      .from(locations)
      .where(eq(locations.businessId, business.id));
    expect(location).toMatchObject({
      name: "Principal",
      addressLabel: CUENCA_PLACE.label,
      latitude: "-2.9081000",
      longitude: "-79.0137000",
      countryCode: "EC",
      status: "active",
      addressSnapshot: CUENCA_PLACE.snapshot,
    });
    const [verification] = await db
      .select()
      .from(locationVerifications)
      .where(eq(locationVerifications.locationId, location.id));
    expect(verification).toMatchObject({
      id: location.activeVerificationId,
      source: "provider_verified",
      provider: "google",
      providerPlaceId: CUENCA_PLACE.placeId,
      attribution: null,
    });
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.businessId, business.id));
    expect(subscription).toMatchObject({ plan: "free", status: "active" });
    // ADR 0121 §3: el negocio nace SIN programa.
    const programs = await db
      .select({ id: loyaltyPrograms.id })
      .from(loyaltyPrograms)
      .where(eq(loyaltyPrograms.businessId, business.id));
    expect(programs).toHaveLength(0);
    // Y el link de verificacion se encolo.
    expect(await linkTokenCount(fresh)).toBeGreaterThanOrEqual(1);
  }, 60_000);

  it("un token de MX persiste currency_code MXN y la zona DEL TOKEN", async () => {
    const response = await signup(
      signupBody(mexican, {
        categoryGcid: "gcid:cafe",
        selectionToken: testSelectionToken({
          countryCode: "MX",
          timezone: "America/Tijuana",
          latitude: 32.5,
          longitude: -117,
        }),
      }),
    );
    expect(response.status).toBe(201);
    const { business } = await response.json();
    const [row] = await getDb()
      .select()
      .from(businesses)
      .where(eq(businesses.id, business.id));
    expect(row).toMatchObject({
      countryCode: "MX",
      currencyCode: "MXN",
      timezone: "America/Tijuana",
      categoryGcid: "gcid:cafe",
    });
  }, 60_000);

  // ORACULO DE M2. El unico de `user.email` haria fallar un insert, asi que «no hay filas»
  // solo no alcanza: se asevera el 200 `sent`, la ausencia de cookie y de sesion.
  it("email CONOCIDO: 200 sent, sin cookie, sin sesion, 0 negocios nuevos, y el link sale", async () => {
    const body = signupBody(known);
    const response = await signup(body);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sent: true });
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await sessionCount(knownId)).toBe(0);
    expect(await businessesNamed(body.business!.name as string)).toBe(0);
    const owned = await getDb()
      .select()
      .from(memberships)
      .where(eq(memberships.userId, knownId));
    expect(owned).toHaveLength(0);
    expect(await linkTokenCount(known)).toBeGreaterThanOrEqual(1);
  }, 60_000);

  // Spec 0156 (B), ORACULO DE M3: la base rechaza un email con mayusculas por el CHECK
  // (`23514` Y el nombre: un NOT NULL o el unico darian otro rojo), y el CONTROL con la
  // forma en minusculas entra — el rechazo es por las mayusculas, no por la fila.
  it("un `user` con email en MAYUSCULAS lo rechaza la base (23514); en minusculas entra", async () => {
    expect(await rawUserInsertViolation(mixedId, mixedStored)).toEqual({
      code: "23514",
      constraint: "merchant_auth_user_email_lowercase",
    });
    expect(await userByEmail(mixed)).toEqual([]);
    expect(await rawUserInsertViolation(mixedId, mixed)).toBeNull();
    expect((await userByEmail(mixed)).map((u) => u.id)).toEqual([mixedId]);
  }, 60_000);

  it("dos altas simultaneas con el mismo email nuevo: una cuenta, el perdedor sin cookie", async () => {
    const [a, b] = [signupBody(racing), signupBody(racing)];
    const responses = await Promise.all([signup(a), signup(b)]);
    const statuses = responses.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 201]);
    const loser = responses.find((r) => r.status === 200)!;
    expect(await loser.json()).toEqual({ sent: true });
    expect(loser.headers.get("set-cookie")).toBeNull();
    const accounts = await userByEmail(racing);
    expect(accounts).toHaveLength(1);
    expect(await sessionCount(accounts[0].id)).toBe(1);
    const created =
      (await businessesNamed(a.business!.name as string)) +
      (await businessesNamed(b.business!.name as string));
    expect(created).toBe(1);
  }, 60_000);

  it("el rate limit por email muerde con el numero del contrato, sin abrir sesion", async () => {
    let last = await signup(signupBody(known), "203.0.113.10");
    for (let i = 1; i < START_RATE_LIMITS.emailPerHour + 2; i += 1) {
      last = await signup(signupBody(known), "203.0.113.10");
      if (last.status === 429) break;
    }
    expect(last.status).toBe(429);
    expect((await last.json()).code).toBe("rate_limited");
    expect(await sessionCount(knownId)).toBe(0);
    const owned = await getDb().execute<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM core.business_membership WHERE user_id = ${knownId}`,
    );
    expect(owned.rows[0].n).toBe(0);
  }, 60_000);
});
