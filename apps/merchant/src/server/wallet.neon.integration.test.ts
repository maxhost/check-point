import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { unzipSync } from "fflate";
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
import { ensureWalletPass, resolveWebViewToken } from "./wallet/core";
import { authorizePass } from "./wallet/passkit";
import { walletProviderFromEnv } from "./wallet/provider";

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

  it("mints a STABLE authenticationToken: re-emission embeds the SAME token and authorizePass accepts it across the re-emit (spec 0033 fix)", async () => {
    // fake provider stands in outside production (NODE_ENV=test).
    const provider = walletProviderFromEnv({ NODE_ENV: "test" });
    const baseInput = {
      qrToken: "QR-STABLE",
      firstName: "Marcos",
      lastName: "Pérez",
      origin: "https://app.mipasaporte.test",
      webViewToken: "WEB-VIEW-STABLE",
    };

    // Two independent ensure+build cycles = "Add to Wallet" pressed twice.
    const pass1 = await ensureWalletPass(consumerId, "apple");
    const built1 = await provider.buildApplePass({
      ...baseInput,
      serialNumber: pass1.serialNumber,
      authenticationToken: pass1.authToken,
    });
    const pass2 = await ensureWalletPass(consumerId, "apple");
    const built2 = await provider.buildApplePass({
      ...baseInput,
      serialNumber: pass2.serialNumber,
      authenticationToken: pass2.authToken,
    });

    // The stored token is stable across re-emission (this is the bug the fix closes).
    expect(pass2.id).toBe(pass1.id);
    expect(pass2.authToken).toBe(pass1.authToken);
    expect(pass1.authToken).toBeTruthy();

    // And the token embedded in the pass.json is identical both times.
    const tokenOf = (bytes: Buffer) => {
      const files = unzipSync(new Uint8Array(bytes));
      return JSON.parse(Buffer.from(files["pass.json"]).toString())
        .authenticationToken as string;
    };
    expect(tokenOf(built1.bytes)).toBe(pass1.authToken);
    expect(tokenOf(built2.bytes)).toBe(pass1.authToken);

    // The DB never stored a hash for the new stable-token contract.
    const [row] = await getDb()
      .select()
      .from(walletPasses)
      .where(eq(walletPasses.id, pass1.id));
    expect(row.authToken).toBe(pass1.authToken);

    // authorizePass accepts the stable token even after the re-emission; a wrong one is 401.
    expect(
      (await authorizePass(pass1.serialNumber, `ApplePass ${pass1.authToken}`))
        .status,
    ).toBe("ok");
    expect(
      (await authorizePass(pass1.serialNumber, "ApplePass wrong-token")).status,
    ).toBe("unauthorized");
  });

  it("resolveWebViewToken: valid → account; unknown/revoked → null (route 404s)", async () => {
    const acc = await resolveWebViewToken(webViewToken);
    expect(acc?.id).toBe(consumerId);
    expect(await resolveWebViewToken("nope-not-a-real-token")).toBeNull();
    expect(await resolveWebViewToken(undefined)).toBeNull();
  });
});
