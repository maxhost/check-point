import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type Seed,
  dropBusiness,
  integrationEnabled,
  seedBusiness,
  seedConsumer,
  seedReward,
  setBalance,
} from "./counter-integration-support";
import { redeemBody } from "./counter-redeem-support";
import { resolveScan } from "./counter/resolve";
import { redeemReward } from "./counter/redeem";
import { listTodaysAccreditations } from "./counter/history";
import { listConsumerPrograms } from "./consumer/programs";

/**
 * Spec 0055 — the surfaces the redemption feeds: the `resolve` DTO (the reward list the
 * Canjear mode paints), the counter's day history, and the consumer wallet summary.
 * Each one gets its own leak test, as the annex §1 requires: the old wizard test does
 * not cover a new surface, and a second reward DTO is how the spec 0025 leak happened.
 */
describe.skipIf(!integrationEnabled)(
  "redemption surfaces against Neon (spec 0055)",
  () => {
    let seed: Seed;
    let rewardIds: string[];

    beforeAll(async () => {
      seed = await seedBusiness({
        name: `Superficies ${randomUUID().slice(0, 8)}`,
        kind: "points",
        mode: "per_amount",
        grant: 10,
        blockAmount: "3.00",
        configuration: { unitSingular: "punto", unitPlural: "puntos" },
        redeemAllowInsufficient: true,
      });
      // Inserted out of order on purpose: the DTO must sort by `position`.
      const third = await seedReward({
        programId: seed.programId,
        businessId: seed.business.id,
        label: "Tercero",
        pointsCost: 90,
        position: 2,
      });
      const first = await seedReward({
        programId: seed.programId,
        businessId: seed.business.id,
        label: "Primero",
        pointsCost: 30,
        position: 0,
      });
      const second = await seedReward({
        programId: seed.programId,
        businessId: seed.business.id,
        label: "Segundo",
        pointsCost: 60,
        position: 1,
      });
      rewardIds = [first, second, third];
    }, 60_000);

    afterAll(async () => {
      await dropBusiness(seed.business.id);
    }, 60_000);

    it("resolve serves the rewards by position and the dispensation flag, and its DTO is an EXACT allow-list", async () => {
      const consumer = await seedConsumer();
      const resolved = await resolveScan(seed.business, consumer.qrToken);
      expect(resolved.rewards.map((reward) => reward.label)).toEqual([
        "Primero",
        "Segundo",
        "Tercero",
      ]);
      expect(resolved.rewards.map((reward) => reward.id)).toEqual(rewardIds);
      expect(resolved.rewards[0].pointsCost).toBe(30);
      expect(resolved.program.redeemAllowInsufficient).toBe(true);

      // ── Leak guard ────────────────────────────────────────────────────────────
      // This used to be a list of FORBIDDEN LITERALS (`ObjectKey`, `qrToken`,
      // `webViewToken`, a `configuration` property). An independent reviewer evaded it
      // twice with the test staying GREEN, by renaming the leak:
      //   `stampKey: program.stampImageObjectKey`  → a real R2 key under another name
      //   `config: program.configuration`          → the whole jsonb under another name
      // A guard that only knows today's spelling promises a universal property and
      // delivers a spell-checker. It is now a POSITIVE allow-list: the EXACT key set of
      // every object of the DTO, so ANY new field — whatever it is called — turns this
      // red until someone adds it here on purpose. That deliberate edit IS the review
      // this DTO deserves; the spec 0025 leak was a second DTO nobody re-read.
      const keys = (value: object) => Object.keys(value).sort();
      expect(keys(resolved)).toEqual([
        "catalog",
        "consumer",
        "membership",
        "program",
        "rewards",
      ]);
      expect(keys(resolved.consumer)).toEqual(["displayName"]);
      expect(keys(resolved.membership)).toEqual([
        "id",
        "justEnrolled",
        "pointsBalance",
        "stampsCount",
      ]);
      expect(keys(resolved.program)).toEqual([
        "accrual",
        "cardDesign",
        "id",
        "kind",
        "redeemAllowInsufficient",
        "target",
      ]);
      expect(keys(resolved.program.accrual)).toEqual([
        "blockAmount",
        "grant",
        "mode",
      ]);
      expect(keys(resolved.program.cardDesign)).toEqual([
        "backgroundColor",
        "backgroundColor2",
        "borderColor",
        "gradientAngle",
      ]);
      expect(keys(resolved.catalog)).toEqual(["categories", "products"]);
      expect(keys(resolved.rewards[0])).toEqual([
        "discountPercent",
        "id",
        "imagePath",
        "label",
        "pointsCost",
        "position",
        "productId",
        "type",
      ]);
      // WHAT THIS DOES NOT COVER (declared, not papered over): the ELEMENTS of
      // `catalog.products` / `catalog.categories` — this world seeds no product, so
      // there is nothing to read the keys of. That DTO predates this spec and is pinned
      // by the counter's own catalog tests, not here.
      //
      // Value-based backstop, and the only assertion here that is not name-based: the
      // scanned token must not appear anywhere in the payload, under any key at all.
      expect(JSON.stringify(resolved)).not.toContain(consumer.qrToken);
    }, 60_000);

    it("the redemption shows up in the day history next to the accreditations", async () => {
      const consumer = await seedConsumer();
      const resolved = await resolveScan(seed.business, consumer.qrToken);
      await setBalance(resolved.membership.id, { points: 100 });
      const card = {
        consumerId: consumer.id,
        membershipId: resolved.membership.id,
      };
      await redeemReward(
        seed.business,
        seed.userId,
        redeemBody(card, rewardIds[0], seed),
      );

      const history = await listTodaysAccreditations(
        seed.business.id,
        "America/Guayaquil",
        new Date(),
      );
      const mine = history.filter(
        (entry) =>
          entry.entryKind === "redemption" && entry.unitsGranted === 30,
      );
      expect(mine).toHaveLength(1);
      expect(mine[0].rewardLabel).toBe("Primero");
      expect(mine[0].accrualKind).toBe("points");
      expect(mine[0].consumer).toBe("Marcos Pérez");
      expect(JSON.stringify(history)).not.toContain(consumer.qrToken);
    }, 60_000);

    it("the consumer wallet summary carries the reward catalog without any object key", async () => {
      const consumer = await seedConsumer();
      await resolveScan(seed.business, consumer.qrToken);
      const [summary] = await listConsumerPrograms(consumer.id);
      expect(summary.rewards.map((reward) => reward.label)).toEqual([
        "Primero",
        "Segundo",
        "Tercero",
      ]);
      const serialized = JSON.stringify(summary);
      expect(serialized).not.toContain("ObjectKey");
      expect(serialized).not.toContain(consumer.qrToken);
    }, 60_000);

    it("a redemption counts as activity: it moves lastActivityAt forward", async () => {
      const consumer = await seedConsumer();
      const resolved = await resolveScan(seed.business, consumer.qrToken);
      await setBalance(resolved.membership.id, { points: 100 });
      const before = (await listConsumerPrograms(consumer.id))[0]
        .lastActivityAt;
      await redeemReward(
        seed.business,
        seed.userId,
        redeemBody(
          { consumerId: consumer.id, membershipId: resolved.membership.id },
          rewardIds[0],
          seed,
        ),
      );
      const after = (await listConsumerPrograms(consumer.id))[0].lastActivityAt;
      expect(after > before).toBe(true);
    }, 60_000);
  },
);
