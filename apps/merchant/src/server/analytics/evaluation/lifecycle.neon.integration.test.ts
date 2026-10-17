import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import {
  businesses,
  analyticsCardCandidates as candidates,
  analyticsCardStates as states,
  analyticsEvaluationRuns as runs,
} from "@mi-pasaporte/db/schema";
import type { CardCandidate } from "@mi-pasaporte/domain/analytics/types";
import { ANALYTICS_POLICY } from "@mi-pasaporte/domain/analytics/policy/index";
import { permisosIntegrationEnabled } from "../../permissions-integration-support";
import {
  readInbox,
  decideInboxCard,
  cleanupInbox,
  lockAnalyticsBusiness,
} from "../lifecycle";
import * as actions from "../actions";
import { evaluateBusiness } from "./index";
const business = randomUUID(),
  other = randomUUID(),
  actor = randomUUID();
const now = new Date("2026-10-17T18:00:00Z"),
  day = "2026-10-17";
const viewer = { role: "owner", permissions: ["analytics"] };
async function makeCard(
  key = "8",
  businessId = business,
  expiresAt = new Date(now.getTime() + 89 * 86400000),
) {
  const id = randomUUID(),
    subject = randomUUID();
  const card: CardCandidate = {
    cardKey: key,
    subjectKey: subject,
    sender: "Stock",
    title: "Un aviso",
    body: "Contenido verificable",
    amountMinor: 100,
    currencyCode: "USD",
    minorUnit: 2,
    quality: "observed",
    actionKey: null,
    urgency: 1,
    fingerprint: "fingerprint",
    weight: 1,
    locationId: null,
  };
  const episodeStartedAt = new Date(
    expiresAt.getTime() - ANALYTICS_POLICY.lifetime.days * 86400000,
  );
  const category = key === "9" ? "informational" : "actionable";
  await getDb()
    .insert(states)
    .values({
      businessId,
      cardKey: key,
      subjectKey: subject,
      candidateId: id,
      contextVersion: "ctx-1",
      policyVersion: ANALYTICS_POLICY.version,
      context: { kind: key },
      episodeStartedAt,
      expiresAt,
      status: "open",
      fingerprint: "fingerprint",
      shownDays: 0,
      lastShownDay: day,
    });
  await getDb()
    .insert(candidates)
    .values({
      id,
      businessId,
      cardKey: key,
      subjectKey: subject,
      day,
      weight: "1",
      amountMinor: 100n,
      currencyCode: "USD",
      minorUnit: 2,
      parameters: card,
      fingerprint: "fingerprint",
      category,
      contextVersion: "ctx-1",
      policyVersion: ANALYTICS_POLICY.version,
      episodeStartedAt,
      expiresAt,
      period: { from: day, to: day, label: "Datos del día" },
    });
  return { id, card, expiresAt, episodeStartedAt };
}
async function control(id: string) {
  return (
    await getDb().select().from(states).where(eq(states.candidateId, id))
  )[0];
}
async function clear() {
  await getDb()
    .delete(candidates)
    .where(sql`${candidates.businessId} in (${business},${other})`);
  await getDb()
    .delete(states)
    .where(sql`${states.businessId} in (${business},${other})`);
}
describe.skipIf(!permisosIntegrationEnabled)(
  "transactional inbox v2 lifecycle services, real replay DB",
  () => {
    beforeAll(async () => {
      await getDb()
        .insert(businesses)
        .values([
          {
            id: business,
            name: "Lifecycle A",
            slug: `lifecycle-${business}`,
            countryCode: "EC",
            timezone: "America/Guayaquil",
            currencyCode: "USD",
          },
          {
            id: other,
            name: "Lifecycle B",
            slug: `lifecycle-${other}`,
            countryCode: "EC",
            timezone: "America/Guayaquil",
            currencyCode: "USD",
          },
        ]);
      await getDb().insert(runs).values({
        businessId: business,
        day,
        status: "ready",
        policyVersion: ANALYTICS_POLICY.version,
        preparedAt: now,
      });
    }, 30000);
    afterAll(async () => {
      vi.restoreAllMocks();
      await getDb()
        .delete(businesses)
        .where(sql`${businesses.id} in (${business},${other})`);
    }, 30000);
    it("does not queue reads or repeated evaluations behind an in-flight business writer", async () => {
      await clear();
      const item = await makeCard();
      let release!: () => void, ready!: () => void;
      const readyPromise = new Promise<void>((r) => (ready = r));
      const releasePromise = new Promise<void>((r) => (release = r));
      let committed = false;
      const holding = withDbTransaction(async (tx) => {
        await lockAnalyticsBusiness(tx, business);
        ready();
        await releasePromise;
      }).then(() => {
        committed = true;
      });
      await readyPromise;
      try {
        const result = await readInbox(business, viewer, now);
        expect(committed).toBe(false);
        expect(result).toMatchObject({
          state: "preparing",
          cards: [],
          nextReminderAt: null,
          refreshAfterMs: ANALYTICS_POLICY.operation.fallbackWaitMs,
          timezone: "America/Guayaquil",
          policyVersion: ANALYTICS_POLICY.version,
        });
        expect(await evaluateBusiness(business, now)).toBe(false);
        expect(committed).toBe(false);
      } finally {
        release();
        await holding;
      }
      expect((await control(item.id)).shownDays).toBe(0);
      expect((await readInbox(business, viewer, now)).cards[0].id).toBe(
        item.id,
      );
    }, 30000);
    it("keeps identity across midnight and does not invalidate a version by repeated exposure", async () => {
      await clear();
      const item = await makeCard();
      const first = await readInbox(business, viewer, now);
      const again = await readInbox(business, viewer, now);
      expect(first).toMatchObject({
        contractVersion: 2,
        timezone: "America/Guayaquil",
        policyVersion: ANALYTICS_POLICY.version,
        state: "ready",
        refreshAfterMs: null,
      });
      expect(again.cards[0].version).toBe(first.cards[0].version);
      const tomorrow = await readInbox(
        business,
        viewer,
        new Date(now.getTime() + 86400000),
      );
      expect(tomorrow.cards[0].id).toBe(item.id);
      expect(tomorrow.state).toBe("preparing");
      expect(tomorrow.refreshAfterMs).toBe(
        ANALYTICS_POLICY.operation.fallbackWaitMs,
      );
    }, 30000);
    it("closes informational content atomically and recognizes the last retry without content", async () => {
      await clear();
      const item = await makeCard("9");
      const card = (await readInbox(business, viewer, now)).cards[0];
      const command = {
        businessId: business,
        actorId: actor,
        cardId: item.id,
        decision: "seen" as const,
        expectedVersion: card.version,
        operationId: randomUUID(),
      };
      await decideInboxCard(command, viewer, now);
      expect(
        await getDb()
          .select()
          .from(candidates)
          .where(eq(candidates.id, item.id)),
      ).toHaveLength(0);
      expect((await control(item.id)).status).toBe("seen");
      expect(JSON.stringify((await control(item.id)).context)).not.toContain(
        "Contenido verificable",
      );
      await expect(
        decideInboxCard(command, viewer, now),
      ).resolves.toMatchObject({ cards: [], nextReminderAt: null });
      await expect(
        decideInboxCard({ ...command, decision: "ignore" }, viewer, now),
      ).rejects.toMatchObject({ status: 409, code: "operation_conflict" });
      await expect(
        decideInboxCard({ ...command, businessId: other }, viewer, now),
      ).rejects.toMatchObject({ status: 404 });
    }, 30000);
    it("consumes a due reminder only once, with the same ID, age and finite deadline", async () => {
      await clear();
      const item = await makeCard();
      const before = (await readInbox(business, viewer, now)).cards[0];
      const due = new Date(now.getTime() + 3600000);
      await decideInboxCard(
        {
          businessId: business,
          actorId: actor,
          cardId: item.id,
          decision: "snooze",
          expectedVersion: before.version,
          operationId: randomUUID(),
          remindAt: due.toISOString(),
        },
        viewer,
        now,
      );
      const waiting = await readInbox(business, viewer, now);
      expect(waiting.cards).toHaveLength(0);
      expect(waiting.nextReminderAt).toBe(due.toISOString());
      const first = await readInbox(business, viewer, due);
      const second = await readInbox(business, viewer, due);
      expect(first.cards[0].id).toBe(item.id);
      expect(second.cards[0].version).toBe(first.cards[0].version);
      expect(first.nextReminderAt).toBeNull();
      const saved = await control(item.id);
      expect(saved.shownDays).toBe(1);
      expect(saved.reminderConsumedAt?.toISOString()).toBe(due.toISOString());
      expect(saved.episodeStartedAt).toEqual(item.episodeStartedAt);
      expect(saved.expiresAt).toEqual(item.expiresAt);
    }, 30000);
    it("rejects unsupported decisions and dates without changing the current context", async () => {
      await clear();
      const item = await makeCard();
      const card = (await readInbox(business, viewer, now)).cards[0];
      const command = {
        businessId: business,
        actorId: actor,
        cardId: item.id,
        decision: "snooze" as const,
        expectedVersion: card.version,
        operationId: randomUUID(),
      };
      for (const remindAt of [
        now.toISOString(),
        new Date(item.expiresAt.getTime() + 1).toISOString(),
        "2027-02-31T12:00:00Z",
        "2026-10-18T12:00:00",
      ])
        await expect(
          decideInboxCard({ ...command, remindAt }, viewer, now),
        ).rejects.toMatchObject({ status: 422 });
      expect((await control(item.id)).revision).toBe(0);
      const report = await makeCard("9");
      const reportCard = (await readInbox(business, viewer, now)).cards.find(
        (c) => c.id === report.id,
      )!;
      await expect(
        decideInboxCard(
          {
            ...command,
            cardId: report.id,
            expectedVersion: reportCard.version,
            remindAt: new Date(now.getTime() + 3600000).toISOString(),
          },
          viewer,
          now,
        ),
      ).rejects.toMatchObject({ status: 422, code: "invalid_decision" });
    }, 30000);
    it("retains the exact 90-day boundary and expires immediately afterwards without waiting for cleanup", async () => {
      await clear();
      const item = await makeCard("8", business, now);
      expect(
        (await readInbox(business, viewer, now)).cards.map((c) => c.id),
      ).toContain(item.id);
      expect(
        (await readInbox(business, viewer, new Date(now.getTime() + 1))).cards,
      ).toHaveLength(0);
      expect((await control(item.id)).status).toBe("expired");
      expect(
        await getDb()
          .select()
          .from(candidates)
          .where(eq(candidates.id, item.id)),
      ).toHaveLength(0);
    }, 30000);
    it("rolls content deletion and the decision back together if response assembly fails", async () => {
      await clear();
      const item = await makeCard();
      const card = (await readInbox(business, viewer, now)).cards[0];
      const failure = vi
        .spyOn(actions, "actionContext")
        .mockRejectedValueOnce(new Error("controlled response failure"));
      try {
        await expect(
          decideInboxCard(
            {
              businessId: business,
              actorId: actor,
              cardId: item.id,
              decision: "resolve",
              expectedVersion: card.version,
              operationId: randomUUID(),
            },
            viewer,
            now,
          ),
        ).rejects.toThrow("controlled response failure");
      } finally {
        failure.mockRestore();
      }
      expect((await control(item.id)).status).toBe("open");
      expect(
        await getDb()
          .select()
          .from(candidates)
          .where(eq(candidates.id, item.id)),
      ).toHaveLength(1);
    }, 30000);
    it("serializes publication against a stale decision using the same business lock", async () => {
      await clear();
      const item = await makeCard();
      const card = (await readInbox(business, viewer, now)).cards[0];
      let release!: () => void, ready!: () => void;
      const readyPromise = new Promise<void>((r) => (ready = r));
      const releasePromise = new Promise<void>((r) => (release = r));
      const publication = withDbTransaction(async (tx) => {
        await lockAnalyticsBusiness(tx, business);
        await tx
          .update(states)
          .set({ contextVersion: "ctx-2" })
          .where(eq(states.candidateId, item.id));
        await tx
          .update(candidates)
          .set({
            contextVersion: "ctx-2",
            parameters: { ...item.card, body: "New context B" },
          })
          .where(eq(candidates.id, item.id));
        ready();
        await releasePromise;
      });
      await readyPromise;
      const command = decideInboxCard(
        {
          businessId: business,
          actorId: actor,
          cardId: item.id,
          decision: "resolve",
          expectedVersion: card.version,
          operationId: randomUUID(),
        },
        viewer,
        now,
      );
      release();
      await publication;
      await expect(command).rejects.toMatchObject({
        status: 409,
        code: "card_context_changed",
      });
      expect((await readInbox(business, viewer, now)).cards[0].body).toBe(
        "New context B",
      );
    }, 30000);
    it("skips a busy first merchant and still cleans a later eligible merchant in the same invocation", async () => {
      await clear();
      const old = new Date(now.getTime() - 1);
      const busy = await makeCard("8", business, new Date(now.getTime() - 2));
      const available = await makeCard("8", other, old);
      let release!: () => void, ready!: () => void;
      const readyPromise = new Promise<void>((r) => (ready = r));
      const releasePromise = new Promise<void>((r) => (release = r));
      const holding = withDbTransaction(async (tx) => {
        await lockAnalyticsBusiness(tx, business);
        ready();
        await releasePromise;
      });
      await readyPromise;
      try {
        const result = await cleanupInbox(now, { batchSize: 1 });
        // Cleanup is global; assert our two IDs below, not an unrelated global count.
        expect(result.deleted).toBeGreaterThanOrEqual(1);
        expect(result.skipped).toBeGreaterThanOrEqual(1);
        expect(
          await getDb()
            .select()
            .from(candidates)
            .where(eq(candidates.id, available.id)),
        ).toHaveLength(0);
        expect(
          await getDb()
            .select()
            .from(candidates)
            .where(eq(candidates.id, busy.id)),
        ).toHaveLength(1);
      } finally {
        release();
        await holding;
      }
      expect((await cleanupInbox(now)).deleted).toBe(1);
    }, 30000);
  },
);
