import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { integrationEnabled } from "./locations-integration-support";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import { campaigns } from "@mi-pasaporte/db/schema";
import { enableTemplate } from "./marketing/template-store";
import {
  campaignWorld as world,
  dropCampaignWorlds,
} from "./marketing-campaigns-support";

/**
 * Spec 0101 — THE ORACLE OF THE `23505` BRANCH of `enableTemplate`, with a REAL race.
 *
 * The `Promise.allSettled` race of `marketing-templates` does NOT reach that branch:
 * measured, the loser always sees the winner's committed row in the select that precedes
 * the insert and answers 409 from THERE (M2 of the spec stayed green). So this file builds
 * the interleaving by hand: transaction A inserts the live run and does NOT commit until B
 * (a real `enableTemplate`) is BLOCKED on the partial unique index — which means B already
 * passed its select without seeing A's uncommitted row. A commits, B gets `23505` on
 * `core_campaign_template_live_unique`, and only the mapping can turn it into a 409.
 *
 * «B is blocked» is read from `pg_stat_activity` (a backend waiting on a `Lock` with the
 * campaign insert), not guessed with a sleep: a sleep that ends early lets B see the
 * committed row through the select, and the case would pass for the wrong reason.
 */

afterAll(dropCampaignWorlds, 120_000);

async function insertBlockedOnLock(): Promise<boolean> {
  const result = await getDb().execute<{ n: number }>(
    sql`select count(*)::int as n from pg_stat_activity
        where wait_event_type = 'Lock'
          and query ilike 'insert into "core"."campaign" %'`,
  );
  return (result.rows[0]?.n ?? 0) > 0;
}

describe.skipIf(!integrationEnabled)("campaign templates — the race", () => {
  it("the loser that passed the select gets the 23505 of the index, answered as 409 template_already_live", async () => {
    const seed = await world("plus", "Templates real race");
    let loser: Promise<unknown> = Promise.resolve("no arrancó");
    let blocked = false;

    await withDbTransaction(async (tx) => {
      await tx.insert(campaigns).values({
        businessId: seed.business.id,
        kind: "proximity",
        templateKey: "win_back",
        name: "Recuperar perdidos",
        status: "active",
        dormantDays: 90,
        message: "¡Vuelve! Te estamos esperando.",
        startsAt: new Date(),
        activatedAt: new Date(),
        createdByUserId: seed.userId,
      });
      // B starts while A's row is uncommitted: its select cannot see it.
      loser = enableTemplate(
        seed.business.id,
        seed.userId,
        "win_back",
        {},
      ).then(
        () => "fulfilled",
        (error: unknown) => error,
      );
      for (let tries = 0; tries < 100 && !blocked; tries += 1) {
        blocked = await insertBlockedOnLock();
        if (!blocked) await new Promise((r) => setTimeout(r, 200));
      }
    });

    // The precondition of the case: B really reached the insert before A committed.
    expect(blocked).toBe(true);
    expect(await loser).toMatchObject({
      status: 409,
      code: "template_already_live",
    });
    const live = await getDb().execute<{ n: number }>(
      sql`select count(*)::int as n from core.campaign
          where business_id = ${seed.business.id} and template_key = 'win_back'
            and status in ('draft', 'active', 'paused')`,
    );
    expect(live.rows[0]?.n).toBe(1);
  }, 120_000);
});
