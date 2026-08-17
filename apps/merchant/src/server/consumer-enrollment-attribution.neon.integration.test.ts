import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.NEON_INTEGRATION_DATABASE_URL;
const enabled =
  Boolean(url) && process.env.NEON_INTEGRATION_ISOLATED === "true";
// getDb() reads DATABASE_URL lazily; point it at the isolated integration branch.
if (enabled) process.env.DATABASE_URL = url;

import { getDb } from "./db";
import {
  businesses,
  consumerAccounts,
  locations,
  loyaltyPrograms,
  programMemberships,
  users,
} from "./schema";
import { enroll } from "./consumer/enrollment";

// Attribution of a self-service alta by local (ADR 0042 / spec 0041). The `?loc=` from
// the poster QR is validated against the program's business and persisted only on the
// FIRST alta; a foreign/unknown loc attributes null and never breaks the alta; a re-alta
// (idempotent 409) never overwrites the stored value. Isolated fixtures (its own owner,
// two businesses, one operational program, two locales) so it can run alongside the base
// enrollment suite without sharing state.
describe.skipIf(!enabled)("enrollment attribution by local against Neon", () => {
  const userId = `attr-${randomUUID()}`;
  const businessMain = randomUUID();
  const businessOther = randomUUID();
  const program = randomUUID();
  const localMain = randomUUID();
  const localForeign = randomUUID();
  const phoneValid = "+59395" + Math.floor(1000000 + Math.random() * 8999999);
  const phoneNone = "+59394" + Math.floor(1000000 + Math.random() * 8999999);
  const phoneForeign = "+59393" + Math.floor(1000000 + Math.random() * 8999999);
  const phones = [phoneValid, phoneNone, phoneForeign];

  beforeAll(async () => {
    const db = getDb();
    await db.insert(users).values({
      id: userId,
      name: "Owner Attribution QA",
      email: `${userId}@example.test`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(businesses).values([
      {
        id: businessMain,
        name: "Marca Principal",
        countryCode: "EC",
        timezone: "America/Guayaquil",
      },
      {
        id: businessOther,
        name: "Marca Ajena",
        countryCode: "EC",
        timezone: "America/Guayaquil",
      },
    ]);
    await db.insert(loyaltyPrograms).values({
      id: program,
      businessId: businessMain,
      kind: "points",
      configuration: { unitSingular: "Punto", unitPlural: "Puntos" },
      termsMarkdown: "Términos.",
      termsHash: "hash",
      status: "active",
      createdBy: userId,
      createdAt: new Date(Date.now() - 10_000),
    });
    const addr = {
      businessId: businessMain,
      name: "Local Centro",
      addressLabel: "Centro",
      longitude: "-0.1800000",
      latitude: "-78.4670000",
      countryCode: "EC",
      addressSnapshot: {},
    };
    await db.insert(locations).values([
      { ...addr, id: localMain },
      {
        ...addr,
        id: localForeign,
        businessId: businessOther,
        name: "Local Ajeno",
      },
    ]);
  }, 30_000);

  afterAll(async () => {
    const db = getDb();
    const accs = await db
      .select({ id: consumerAccounts.id })
      .from(consumerAccounts)
      .where(inArray(consumerAccounts.phoneE164, phones));
    const accIds = accs.map((a) => a.id);
    if (accIds.length) {
      await db
        .delete(programMemberships)
        .where(inArray(programMemberships.consumerId, accIds));
      await db
        .delete(consumerAccounts)
        .where(inArray(consumerAccounts.phoneE164, phones));
    }
    await db.delete(locations).where(inArray(locations.id, [localMain, localForeign]));
    await db.delete(loyaltyPrograms).where(eq(loyaltyPrograms.id, program));
    await db
      .delete(businesses)
      .where(inArray(businesses.id, [businessMain, businessOther]));
    await db.delete(users).where(eq(users.id, userId));
  }, 30_000);

  it("valid loc of the program's business → persisted as origin_location_id", async () => {
    const { membership } = await enroll(
      program,
      {
        firstName: "Val",
        lastName: "Ida",
        phoneE164: phoneValid,
        countryIso: "EC",
      },
      localMain,
    );
    expect(membership.originLocationId).toBe(localMain);
  });

  it("no loc → origin_location_id null", async () => {
    const { membership } = await enroll(
      program,
      {
        firstName: "Sin",
        lastName: "Loc",
        phoneE164: phoneNone,
        countryIso: "EC",
      },
      null,
    );
    expect(membership.originLocationId).toBeNull();
  });

  it("foreign loc (another business) → null, and the alta still completes", async () => {
    const { membership } = await enroll(
      program,
      {
        firstName: "Aje",
        lastName: "No",
        phoneE164: phoneForeign,
        countryIso: "EC",
      },
      localForeign,
    );
    expect(membership.programId).toBe(program);
    expect(membership.originLocationId).toBeNull();
  });

  it("re-alta (409) never overwrites the stored origin_location_id", async () => {
    const [acc] = await getDb()
      .select({ id: consumerAccounts.id })
      .from(consumerAccounts)
      .where(eq(consumerAccounts.phoneE164, phoneValid));
    await expect(
      enroll(
        program,
        {
          firstName: "Val",
          lastName: "Ida",
          phoneE164: phoneValid,
          countryIso: "EC",
        },
        localForeign,
      ),
    ).rejects.toMatchObject({ status: 409, code: "already_member" });
    const [stored] = await getDb()
      .select()
      .from(programMemberships)
      .where(
        and(
          eq(programMemberships.consumerId, acc.id),
          eq(programMemberships.programId, program),
        ),
      );
    expect(stored.originLocationId).toBe(localMain);
  });
});
