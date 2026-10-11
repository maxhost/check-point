import { randomUUID } from "node:crypto";

const url = process.env.NEON_INTEGRATION_DATABASE_URL;
const integrationEnabled =
  Boolean(url) && process.env.NEON_INTEGRATION_ISOLATED === "true";
// getDb() lee DATABASE_URL en cada llamada: se apunta a la rama aislada ANTES de usarla.
if (integrationEnabled) process.env.DATABASE_URL = url;

import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { getDb } from "@mi-pasaporte/db";
import {
  businesses,
  memberships,
  platformAuditLog,
  subscriptions,
  users,
} from "@mi-pasaporte/db/schema";
import { applyTrialChange, listBusinesses } from "./businesses";

const DAY = 86_400_000;
const seeded: string[] = [];
const seededUsers: string[] = [];

/** Un comercio como lo deja el alta: dueño, negocio y (si se pide) su fila de suscripcion. */
async function seedBusiness(
  label: string,
  subscription: Partial<typeof subscriptions.$inferInsert> | null,
) {
  const db = getDb();
  const userId = `platform-int-${randomUUID()}`;
  const businessId = randomUUID();
  const email = `${userId}@example.test`;
  await db.insert(users).values({
    id: userId,
    name: label,
    email,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(businesses).values({
    id: businessId,
    name: `${label} ${Date.now()}`,
    slug: `pint-${businessId.slice(0, 20)}`,
    countryCode: "EC",
    timezone: "America/Guayaquil",
    currencyCode: "USD",
  });
  await db.insert(memberships).values({ businessId, userId, role: "owner" });
  if (subscription !== null) {
    await db.insert(subscriptions).values({ businessId, ...subscription });
  }
  seeded.push(businessId);
  seededUsers.push(userId);
  return { businessId, email };
}

const trialRow = (endsInDays: number) => ({
  plan: "trial",
  status: "active",
  trialEndsAt: new Date(Date.now() + endsInDays * DAY),
});

async function trialEndsAt(businessId: string) {
  const [row] = await getDb()
    .select({ trialEndsAt: subscriptions.trialEndsAt })
    .from(subscriptions)
    .where(eq(subscriptions.businessId, businessId));
  return row?.trialEndsAt ?? null;
}

async function auditCount(businessId: string) {
  const [row] = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(platformAuditLog)
    .where(eq(platformAuditLog.businessId, businessId));
  return row?.n ?? 0;
}

describe.skipIf(!integrationEnabled)("panel de plataforma (spec 0190)", () => {
  afterAll(async () => {
    if (seeded.length === 0) return;
    await getDb().delete(businesses).where(inArray(businesses.id, seeded));
    await getDb().delete(users).where(inArray(users.id, seededUsers));
  }, 120_000);

  it("la migracion 0070 dejo platform_auth con sus 5 tablas y el check de audit_log", async () => {
    const tables = await getDb().execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables where table_schema = 'platform_auth' order by table_name`,
    );
    expect(tables.rows.map((row) => row.table_name)).toEqual([
      "account",
      "audit_log",
      "session",
      "user",
      "verification",
    ]);
    const { businessId } = await seedBusiness("Check", trialRow(5));
    await expect(
      getDb().insert(platformAuditLog).values({
        adminEmail: "a@b.co",
        businessId,
        action: "otra_cosa",
        afterTrialEndsAt: new Date(),
      }),
    ).rejects.toThrow();
  }, 60_000);

  it("listBusinesses: en prueba, bloqueado, pagando y sin fila, con el email del dueño", async () => {
    const now = new Date();
    const trial = await seedBusiness("Prueba", trialRow(10));
    const blocked = await seedBusiness("Bloqueado", trialRow(-1));
    const paying = await seedBusiness("Paga", {
      plan: "base",
      status: "active",
      stripeSubscriptionId: `sub_${randomUUID().slice(0, 8)}`,
      trialEndsAt: null,
    });
    const missing = await seedBusiness("Sin fila", null);

    const all = await listBusinesses(now);
    const byId = new Map(all.map((row) => [row.id, row]));
    expect(byId.get(trial.businessId)).toMatchObject({
      access: "trial",
      trialDaysLeft: 10,
      ownerEmail: trial.email,
      plan: "trial",
      hasStripe: false,
    });
    expect(byId.get(blocked.businessId)).toMatchObject({
      access: "blocked",
      trialDaysLeft: null,
    });
    expect(byId.get(paying.businessId)).toMatchObject({
      access: "subscribed",
      hasStripe: true,
    });
    expect(byId.get(missing.businessId)).toMatchObject({
      access: "blocked",
      plan: null,
    });
    // Orden: bloqueados, despues en prueba, despues los que pagan.
    const position = (id: string) => all.findIndex((row) => row.id === id);
    expect(position(blocked.businessId)).toBeLessThan(
      position(trial.businessId),
    );
    expect(position(trial.businessId)).toBeLessThan(
      position(paying.businessId),
    );

    const [one] = await listBusinesses(now, trial.businessId);
    expect(one?.id).toBe(trial.businessId);
  }, 60_000);

  it("add_days escribe UNA fila y UN audit_log; vencida cuenta desde ahora", async () => {
    const { businessId } = await seedBusiness("Extender", trialRow(-20));
    const before = await trialEndsAt(businessId);
    const now = new Date();
    const result = await applyTrialChange({
      businessId,
      adminEmail: "dueno@checkpass.club",
      change: { mode: "add_days", days: 7 },
      now,
    });
    expect(result).toMatchObject({
      kind: "ok",
      access: "trial",
      trialDaysLeft: 7,
    });
    expect((await trialEndsAt(businessId))?.getTime()).toBe(
      now.getTime() + 7 * DAY,
    );
    const audit = await getDb()
      .select()
      .from(platformAuditLog)
      .where(eq(platformAuditLog.businessId, businessId));
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      adminEmail: "dueno@checkpass.club",
      action: "trial_add_days",
    });
    expect(audit[0]?.beforeTrialEndsAt?.getTime()).toBe(before?.getTime());
  }, 60_000);

  it("ORACULO DE LA FILA 2: suscripcion de Stripe viva → subscription_live y nada se escribe", async () => {
    const { businessId } = await seedBusiness("Viva", {
      plan: "trial",
      status: "trialing",
      stripeSubscriptionId: `sub_${randomUUID().slice(0, 8)}`,
      trialEndsAt: new Date(Date.now() + 5 * DAY),
    });
    const before = await trialEndsAt(businessId);
    expect(
      await applyTrialChange({
        businessId,
        adminEmail: "dueno@checkpass.club",
        change: { mode: "add_days", days: 30 },
        now: new Date(),
      }),
    ).toEqual({ kind: "subscription_live" });
    expect((await trialEndsAt(businessId))?.getTime()).toBe(before?.getTime());
    expect(await auditCount(businessId)).toBe(0);
  }, 60_000);

  it("set_date pasada: sin confirmar → would_block; confirmada → bloqueado", async () => {
    const { businessId } = await seedBusiness("Acortar", trialRow(30));
    const change = { mode: "set_date" as const, date: "2026-01-01" };
    expect(
      await applyTrialChange({
        businessId,
        adminEmail: "dueno@checkpass.club",
        change,
        now: new Date(),
      }),
    ).toEqual({ kind: "would_block" });
    expect(await auditCount(businessId)).toBe(0);
    const result = await applyTrialChange({
      businessId,
      adminEmail: "dueno@checkpass.club",
      change: { ...change, confirmBlock: true },
      now: new Date(),
    });
    expect(result).toMatchObject({ kind: "ok", access: "blocked" });
    expect((await trialEndsAt(businessId))?.toISOString()).toBe(
      "2026-01-02T04:59:59.000Z",
    );
    expect(await auditCount(businessId)).toBe(1);
  }, 60_000);

  it("comercio sin fila de suscripcion o inexistente → not_found", async () => {
    const { businessId } = await seedBusiness("Sin fila 2", null);
    for (const id of [businessId, randomUUID()]) {
      expect(
        await applyTrialChange({
          businessId: id,
          adminEmail: "dueno@checkpass.club",
          change: { mode: "add_days", days: 3 },
          now: new Date(),
        }),
      ).toEqual({ kind: "not_found" });
    }
  }, 60_000);
});
