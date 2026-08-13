import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.NEON_INTEGRATION_DATABASE_URL;
const enabled =
  Boolean(url) && process.env.NEON_INTEGRATION_ISOLATED === "true";
// getDb() reads DATABASE_URL lazily; point it at the isolated integration branch.
if (enabled) process.env.DATABASE_URL = url;

import { getDb } from "./db";
import {
  businesses,
  loyaltyProgramEvents,
  loyaltyPrograms,
  memberships,
  users,
} from "./schema";
import {
  LoyaltyError,
  cancelClose,
  closeProgram,
  expireClosingPrograms,
  programForOwner,
  saveProgram,
} from "./loyalty-program";

/** A browser datetime-local value in America/Guayaquil (UTC-5, no DST) N days ahead. */
function guayaquilLocal(daysFromNow: number) {
  const date = new Date(Date.now() + daysFromNow * 86_400_000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Guayaquil",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

describe.skipIf(!enabled)("loyalty program service against Neon", () => {
  const userId = `int-${randomUUID()}`;
  const businessId = randomUUID();

  beforeAll(async () => {
    const db = getDb();
    await db.insert(users).values({
      id: userId,
      name: "Owner Integración",
      email: `${userId}@example.test`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(businesses).values({
      id: businessId,
      name: "Integración QA",
      countryCode: "EC",
      timezone: "America/Guayaquil",
    });
    await db.insert(memberships).values({ businessId, userId, role: "owner" });
  }, 30_000);

  afterAll(async () => {
    const db = getDb();
    await db
      .delete(loyaltyProgramEvents)
      .where(eq(loyaltyProgramEvents.businessId, businessId));
    await db
      .delete(loyaltyPrograms)
      .where(eq(loyaltyPrograms.businessId, businessId));
    await db.delete(memberships).where(eq(memberships.businessId, businessId));
    await db.delete(businesses).where(eq(businesses.id, businessId));
    await db.delete(users).where(eq(users.id, userId));
  }, 30_000);

  const auditActions = async () =>
    (
      await getDb()
        .select()
        .from(loyaltyProgramEvents)
        .where(eq(loyaltyProgramEvents.businessId, businessId))
        .orderBy(loyaltyProgramEvents.createdAt)
    ).map((event) => event);

  it("runs the full lifecycle with a complete, attributed audit trail", async () => {
    // Many sequential Neon HTTP round-trips; allow generous time.
    // create — unknown config keys must be stripped
    const created = await saveProgram(userId, {
      kind: "points",
      configuration: { unitSingular: "Punto", unitPlural: "Puntos", junk: "x" },
      clauses: [{ text: "Términos iniciales." }],
    });
    expect(created.created).toBe(true);
    let ctx = await programForOwner(userId);
    expect(ctx?.program?.status).toBe("active");
    expect(ctx?.program?.configuration).toEqual({
      unitSingular: "Punto",
      unitPlural: "Puntos",
    });

    // edit
    const edited = await saveProgram(userId, {
      kind: "points",
      configuration: { unitSingular: "Estrella", unitPlural: "Estrellas" },
      clauses: [{ text: "Términos actualizados." }],
    });
    expect(edited.created).toBe(false);

    // schedule close
    await closeProgram(userId, {
      earningEndsAt: guayaquilLocal(2),
      redemptionEndsAt: guayaquilLocal(7),
    });
    ctx = await programForOwner(userId);
    expect(ctx?.program?.status).toBe("closing");

    // closing again and editing while closing must fail (no false success)
    await expect(
      closeProgram(userId, {
        earningEndsAt: guayaquilLocal(2),
        redemptionEndsAt: guayaquilLocal(7),
      }),
    ).rejects.toBeInstanceOf(LoyaltyError);
    await expect(
      saveProgram(userId, {
        kind: "points",
        configuration: { unitSingular: "No", unitPlural: "Noes" },
        clauses: [{ text: "x" }],
      }),
    ).rejects.toBeInstanceOf(LoyaltyError);

    // cancel the close → back to active, dates cleared
    await cancelClose(userId);
    ctx = await programForOwner(userId);
    expect(ctx?.program?.status).toBe("active");
    expect(ctx?.program?.earningEndsAt).toBeNull();
    expect(ctx?.program?.redemptionEndsAt).toBeNull();

    // reclose, then force the redemption window into the past and expire
    await closeProgram(userId, {
      earningEndsAt: guayaquilLocal(1),
      redemptionEndsAt: guayaquilLocal(2),
    });
    // Move the whole window into the past (earning < redemption keeps the
    // check constraint satisfied) so the idempotent expiry job fires.
    await getDb()
      .update(loyaltyPrograms)
      .set({
        earningEndsAt: new Date(Date.now() - 2000),
        redemptionEndsAt: new Date(Date.now() - 1000),
      })
      .where(eq(loyaltyPrograms.businessId, businessId));
    const expiredCount = await expireClosingPrograms();
    expect(expiredCount).toBeGreaterThanOrEqual(1);
    ctx = await programForOwner(userId);
    expect(ctx?.program).toBeNull();

    // audit trail: full sequence, system actor on expiry, owner actor on the rest
    const log = await auditActions();
    expect(log.map((event) => event.action)).toEqual([
      "created",
      "edited",
      "closing_scheduled",
      "closing_canceled",
      "closing_scheduled",
      "expired",
    ]);
    expect(log[0].actorId).toBe(userId);
    expect(log.at(-1)?.actorId).toBeNull();

    // a new cycle can be created only now that the previous one is inactive
    const recreated = await saveProgram(userId, {
      kind: "stamps",
      configuration: { unitName: "Sello", target: 8 },
      clauses: [{ text: "Términos del nuevo ciclo." }],
    });
    expect(recreated.created).toBe(true);
  }, 60_000);
});
