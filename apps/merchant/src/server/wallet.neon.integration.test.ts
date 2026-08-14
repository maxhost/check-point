import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
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
  consumerSessions,
  loyaltyPrograms,
  programMemberships,
  users,
  walletPasses,
} from "./schema";
import { enroll } from "./consumer/enrollment";
import {
  ensureWalletPass,
  resolveWebViewToken,
  setAuthTokenHash,
} from "./wallet/core";

describe.skipIf(!enabled)("wallet passes against Neon", () => {
  const userId = `int-${randomUUID()}`;
  const businessId = randomUUID();
  const programId = randomUUID();
  const phone = "+59395" + Math.floor(1000000 + Math.random() * 8999999);
  let consumerId = "";
  let webViewToken = "";

  beforeAll(async () => {
    const db = getDb();
    await db.insert(users).values({
      id: userId,
      name: "Owner Wallet QA",
      email: `${userId}@example.test`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(businesses).values({
      id: businessId,
      name: "La Gringa",
      countryCode: "EC",
      timezone: "America/Guayaquil",
    });
    await db.insert(loyaltyPrograms).values({
      id: programId,
      businessId,
      kind: "points",
      configuration: { unitSingular: "Punto", unitPlural: "Puntos" },
      termsMarkdown: "Términos.",
      termsHash: "hash",
      status: "active",
      createdBy: userId,
    });
    const { account } = await enroll(programId, {
      firstName: "Marcos",
      lastName: "Pérez",
      phoneE164: phone,
      countryIso: "EC",
    });
    consumerId = account.id;
    webViewToken = account.webViewToken;
  }, 30_000);

  afterAll(async () => {
    const db = getDb();
    await db
      .delete(walletPasses)
      .where(eq(walletPasses.consumerId, consumerId));
    await db
      .delete(consumerSessions)
      .where(eq(consumerSessions.consumerId, consumerId));
    await db
      .delete(programMemberships)
      .where(eq(programMemberships.consumerId, consumerId));
    await db
      .delete(consumerAccounts)
      .where(eq(consumerAccounts.id, consumerId));
    await db.delete(loyaltyPrograms).where(eq(loyaltyPrograms.id, programId));
    await db.delete(businesses).where(inArray(businesses.id, [businessId]));
    await db.delete(users).where(eq(users.id, userId));
  }, 30_000);

  it("emits a web_view_token distinct from the qr_token at enrollment", async () => {
    const [acc] = await getDb()
      .select()
      .from(consumerAccounts)
      .where(eq(consumerAccounts.id, consumerId));
    expect(acc.webViewToken).toBeTruthy();
    expect(acc.webViewToken).not.toEqual(acc.qrToken);
  });

  it("create-or-reuse: one wallet_pass per (consumer, provider); a 2nd call never duplicates", async () => {
    const apple1 = await ensureWalletPass(consumerId, "apple");
    const apple2 = await ensureWalletPass(consumerId, "apple");
    expect(apple2.id).toBe(apple1.id);
    expect(apple2.serialNumber).toBe(apple1.serialNumber);

    const google1 = await ensureWalletPass(consumerId, "google");
    expect(google1.id).not.toBe(apple1.id);

    const rows = await getDb()
      .select()
      .from(walletPasses)
      .where(eq(walletPasses.consumerId, consumerId));
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.provider))).toEqual(
      new Set(["apple", "google"]),
    );
  });

  it("stores only the hash of the Apple authenticationToken (never the raw)", async () => {
    const pass = await ensureWalletPass(consumerId, "apple");
    await setAuthTokenHash(pass.id, "raw-auth-token-value");
    const [row] = await getDb()
      .select()
      .from(walletPasses)
      .where(eq(walletPasses.id, pass.id));
    expect(row.authTokenHash).toBeTruthy();
    expect(row.authTokenHash).not.toBe("raw-auth-token-value");
  });

  it("resolveWebViewToken: valid → account; unknown/revoked → null (route 404s)", async () => {
    const acc = await resolveWebViewToken(webViewToken);
    expect(acc?.id).toBe(consumerId);
    expect(await resolveWebViewToken("nope-not-a-real-token")).toBeNull();
    expect(await resolveWebViewToken(undefined)).toBeNull();
  });
});
