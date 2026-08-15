import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type Seed,
  dropBusiness,
  integrationEnabled,
  seedBusiness,
  seedConsumer,
} from "./counter-integration-support";
import { getDb } from "./db";
import {
  consumerAccounts,
  walletPasses,
  walletPushDevices,
  walletPushQueue,
} from "./schema";
import { resolveScan } from "./counter/resolve";
import { type PersistGrantInput, persistGrant } from "./counter/orders";
import { ensureWalletPass, setAuthTokenHash } from "./wallet/core";
import { hashToken, generateOpaqueToken } from "./consumer/core";
import {
  authorizePass,
  listUpdatedSerials,
  registerDevice,
  unregisterDevice,
} from "./wallet/passkit";
import { rotatePassCredentials } from "./wallet/push";

const consumerIds: string[] = [];

async function enrolledMembership(seed: Seed) {
  const consumer = await seedConsumer();
  consumerIds.push(consumer.id);
  const resolved = await resolveScan(seed.business, consumer.qrToken);
  return { consumer, membershipId: resolved.membership.id };
}

function grantInput(
  seed: Seed,
  membershipId: string,
  consumerId: string,
  clientRequestId: string,
): PersistGrantInput {
  return {
    businessId: seed.business.id,
    locationId: seed.locationId,
    programId: seed.programId,
    membershipId,
    consumerId,
    mode: "quick",
    total: "9.00",
    currencyCode: "USD",
    note: null,
    accrualKind: "stamps",
    units: 1,
    createdByUserId: seed.userId,
    clientRequestId,
    items: [],
  };
}

describe.skipIf(!integrationEnabled)(
  "wallet push channel against Neon (spec 0033)",
  () => {
    let seed: Seed;

    beforeAll(async () => {
      seed = await seedBusiness({
        name: "La Gringa",
        kind: "stamps",
        mode: "per_purchase",
        grant: 1,
        blockAmount: null,
      });
    }, 30_000);

    afterAll(async () => {
      const db = getDb();
      for (const id of consumerIds) {
        await db
          .delete(walletPushQueue)
          .where(eq(walletPushQueue.consumerId, id));
      }
      await dropBusiness(seed.business.id);
      for (const id of consumerIds) {
        // wallet_push_device cascades with the pass; delete passes then the account.
        await db.delete(walletPasses).where(eq(walletPasses.consumerId, id));
        await db.delete(consumerAccounts).where(eq(consumerAccounts.id, id));
      }
    }, 30_000);

    it("persistGrant enqueues ONE transactional queue row atomically with the order", async () => {
      const { consumer, membershipId } = await enrolledMembership(seed);
      const granted = await persistGrant(
        grantInput(seed, membershipId, consumer.id, randomUUID()),
      );
      expect(granted).not.toBeNull();
      expect(granted?.pushQueueId).toBeTruthy();

      const rows = await getDb()
        .select()
        .from(walletPushQueue)
        .where(eq(walletPushQueue.consumerId, consumer.id));
      expect(rows).toHaveLength(1);
      expect(rows[0].class).toBe("transactional");
      expect(rows[0].status).toBe("pending");
      expect(rows[0].title).toBe("La Gringa");
      expect(rows[0].body).toBe("+1 sello");
    }, 30_000);

    it("a bogus membership creates neither an order nor a queue row (rollback invariant)", async () => {
      const consumer = await seedConsumer();
      consumerIds.push(consumer.id);
      const granted = await persistGrant(
        grantInput(seed, randomUUID(), consumer.id, randomUUID()),
      );
      expect(granted).toBeNull();
      const rows = await getDb()
        .select()
        .from(walletPushQueue)
        .where(eq(walletPushQueue.consumerId, consumer.id));
      expect(rows).toHaveLength(0);
    }, 30_000);

    it("an idempotent retry does NOT duplicate the queue row", async () => {
      const { consumer, membershipId } = await enrolledMembership(seed);
      const clientRequestId = randomUUID();
      const first = await persistGrant(
        grantInput(seed, membershipId, consumer.id, clientRequestId),
      );
      const second = await persistGrant(
        grantInput(seed, membershipId, consumer.id, clientRequestId),
      );
      expect(first?.pushQueueId).toBeTruthy();
      expect(second).toBeNull(); // idempotent hit → no new row
      const rows = await getDb()
        .select()
        .from(walletPushQueue)
        .where(eq(walletPushQueue.consumerId, consumer.id));
      expect(rows).toHaveLength(1);
    }, 30_000);

    it("PassKit auth: valid ApplePass token authorizes; missing/wrong → 401; cross-pass → 401", async () => {
      const a = await enrolledMembership(seed);
      const b = await enrolledMembership(seed);
      const passA = await ensureWalletPass(a.consumer.id, "apple");
      const passB = await ensureWalletPass(b.consumer.id, "apple");
      const tokenA = generateOpaqueToken();
      const tokenB = generateOpaqueToken();
      await setAuthTokenHash(passA.id, tokenA);
      await setAuthTokenHash(passB.id, tokenB);

      expect(
        (await authorizePass(passA.serialNumber, `ApplePass ${tokenA}`)).status,
      ).toBe("ok");
      expect((await authorizePass(passA.serialNumber, null)).status).toBe(
        "unauthorized",
      );
      expect(
        (await authorizePass(passA.serialNumber, "ApplePass nope")).status,
      ).toBe("unauthorized");
      // A pass's token cannot access another pass's serial.
      expect(
        (await authorizePass(passA.serialNumber, `ApplePass ${tokenB}`)).status,
      ).toBe("unauthorized");
      expect(
        (await authorizePass("no-such-serial", `ApplePass ${tokenA}`)).status,
      ).toBe("not_found");
    }, 30_000);

    it("register is an idempotent upsert; list-updated returns the serial after a change", async () => {
      const { consumer } = await enrolledMembership(seed);
      const pass = await ensureWalletPass(consumer.id, "apple");
      const deviceLibraryId = `dev-${randomUUID()}`;

      const r1 = await registerDevice({
        passId: pass.id,
        deviceLibraryId,
        pushToken: "apns-token-1",
      });
      expect(r1.created).toBe(true);
      const r2 = await registerDevice({
        passId: pass.id,
        deviceLibraryId,
        pushToken: "apns-token-2",
      });
      expect(r2.created).toBe(false); // upsert, not a new row

      const devices = await getDb()
        .select()
        .from(walletPushDevices)
        .where(eq(walletPushDevices.walletPassId, pass.id));
      expect(devices).toHaveLength(1);
      expect(devices[0].pushToken).toBe("apns-token-2");

      // Nothing changed yet → 204 (null).
      expect(await listUpdatedSerials({ deviceLibraryId })).toBeNull();

      // Materialize a change on the consumer, then the serial shows up.
      const changedAt = new Date();
      await getDb()
        .update(consumerAccounts)
        .set({
          messageUpdatedAt: changedAt,
          latestMessage: "La Gringa: +1 sello",
        })
        .where(eq(consumerAccounts.id, consumer.id));

      const listed = await listUpdatedSerials({ deviceLibraryId });
      expect(listed?.serialNumbers).toContain(pass.serialNumber);
      // A tag at/after the change filters it back out.
      const after = await listUpdatedSerials({
        deviceLibraryId,
        passesUpdatedSince: String(changedAt.getTime()),
      });
      expect(after).toBeNull();

      await unregisterDevice({ passId: pass.id, deviceLibraryId });
      const gone = await getDb()
        .select()
        .from(walletPushDevices)
        .where(eq(walletPushDevices.walletPassId, pass.id));
      expect(gone).toHaveLength(0);
    }, 30_000);

    it("rotatePassCredentials rotates both tokens, wipes devices, enqueues re-emission; old qr_token dies", async () => {
      const { consumer } = await enrolledMembership(seed);
      const pass = await ensureWalletPass(consumer.id, "apple");
      await registerDevice({
        passId: pass.id,
        deviceLibraryId: `dev-${randomUUID()}`,
        pushToken: "apns-token",
      });
      const [before] = await getDb()
        .select()
        .from(consumerAccounts)
        .where(eq(consumerAccounts.id, consumer.id));

      const { qrToken, webViewToken } = await rotatePassCredentials(
        consumer.id,
      );
      expect(qrToken).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(webViewToken).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(qrToken).not.toBe(webViewToken);
      expect(qrToken).not.toBe(before.qrToken);
      expect(webViewToken).not.toBe(before.webViewToken);

      // Devices wiped.
      const devices = await getDb()
        .select()
        .from(walletPushDevices)
        .where(eq(walletPushDevices.walletPassId, pass.id));
      expect(devices).toHaveLength(0);

      // A re-emission transactional push was enqueued.
      const rows = await getDb()
        .select()
        .from(walletPushQueue)
        .where(
          and(
            eq(walletPushQueue.consumerId, consumer.id),
            eq(walletPushQueue.class, "transactional"),
          ),
        );
      expect(rows.length).toBeGreaterThanOrEqual(1);

      // The old qr_token no longer resolves in the counter scan (0030).
      await expect(
        resolveScan(seed.business, before.qrToken),
      ).rejects.toMatchObject({ status: 422 });
      // The new one does.
      const resolved = await resolveScan(seed.business, qrToken);
      expect(resolved.consumer.displayName).toBeTruthy();
      // hashToken is deterministic (sanity for the auth compare path).
      expect(hashToken("x")).toBe(hashToken("x"));
    }, 30_000);
  },
);
