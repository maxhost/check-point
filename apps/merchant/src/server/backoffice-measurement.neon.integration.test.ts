/** M0 fixture only. Explicit setup persists; cleanup is a separate protected invocation.
 * BACKOFFICE_MEASUREMENT_SETUP=true BACKOFFICE_MEASUREMENT_OPERATION=setup|inspect|stabilize|cleanup|login
 * BACKOFFICE_MEASUREMENT_MANIFEST=/private/tmp/<campaign>/fixture.json
 * BACKOFFICE_MEASUREMENT_ENDPOINT_SHA12=<reserved CI endpoint fingerprint>
 * Run ONLY via tools/neon-test.sh src/server/backoffice-measurement.neon.integration.test.ts
 * No cookie/session is fabricated: login through existing owner OTP flow after setup.
 */
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import {
  users,
  businesses,
  memberships,
  subscriptions,
  businessModules,
  businessOnboardingTours,
  analyticsCardCandidates as candidates,
  analyticsCardStates as states,
  analyticsEvaluationRuns as runs,
} from "@mi-pasaporte/db/schema";
import { ANALYTICS_POLICY as policy } from "@mi-pasaporte/domain/analytics/policy/index";
import { localDay } from "@mi-pasaporte/domain/analytics/date";
import type { CardCandidate } from "@mi-pasaporte/domain/analytics/types";
import { readInbox } from "./analytics/lifecycle";
import { ONBOARDING_TOURS } from "./onboarding/tours";
import { loginFixtures } from "./backoffice-measurement-login.test-support";
import {
  guard,
  validate,
  assertOwned,
  checkStored,
  type Manifest,
} from "./backoffice-measurement.test-support";

const enabled = process.env.BACKOFFICE_MEASUREMENT_SETUP === "true";
const viewer = { role: "owner", permissions: ["analytics"] };

async function confirmInbox(m: Manifest) {
  for (const f of m.fixtures) {
    const inbox = await readInbox(f.businessId, viewer);
    expect(inbox).toMatchObject({
      state: "ready",
      timezone: m.timezone,
      policyVersion: m.policyVersion,
      nextReminderAt: null,
    });
    expect(inbox.cards.map((c) => c.id).sort()).toEqual(
      f.cards.map((c) => c.id).sort(),
    );
    for (const card of inbox.cards) {
      const expected = f.cards.find((c) => c.id === card.id)!;
      expect(card.version).toMatch(/^[a-f0-9]{64}$/);
      expect(card.action).not.toBeNull();
      expect(card.decisions.length).toBeGreaterThan(0);
      if (expected.version) {
        expect(card.version).toBe(expected.version);
        expect(card.action).toEqual(expected.action);
      }
      expected.version = card.version;
      expected.action = card.action;
      expected.title = card.title;
      expected.decisions = card.decisions;
    }
  }
}
describe.skipIf(!enabled)(
  "0238 explicit protected persistent measurement fixtures",
  () => {
    it("executes only the requested fixture operation", async () => {
      const { file, endpoint } = await guard();
      const operation = process.env.BACKOFFICE_MEASUREMENT_OPERATION;
      expect(["setup", "inspect", "stabilize", "cleanup", "login"]).toContain(
        operation,
      );
      if (operation === "setup") {
        const now = new Date(),
          runId = randomUUID(),
          day = localDay(now, "America/Guayaquil");
        const lifetimeMs = policy.lifetime.days * 86_400_000;
        expect(lifetimeMs).toBeGreaterThan(3_600_000);
        const m: Manifest = {
          kind: "backoffice-measurement-v1",
          runId,
          endpoint,
          day,
          timezone: "America/Guayaquil",
          currency: "USD",
          policyVersion: policy.version,
          createdAt: now.toISOString(),
          expiresAt: new Date(+now + lifetimeMs).toISOString(),
          phase: "allocating",
          fixtures: ([0, 5] as const).map((count) => ({
            userId: randomUUID(),
            businessId: randomUUID(),
            email: `bo0238-${runId}-${count}@example.test`,
            slug: `bo0238-${runId}-${count}`,
            count,
            cards:
              count === 0
                ? []
                : ["3", "4", "5", "8", "9"].map((key) => ({
                    id: randomUUID(),
                    key,
                    subject: randomUUID(),
                  })),
          })),
        };
        validate(m, endpoint);
        // Exclusive manifest exists BEFORE any write: failure leaves IDs for safe explicit cleanup.
        await writeFile(file, JSON.stringify(m, null, 2), {
          flag: "wx",
          mode: 0o600,
        });
        await withDbTransaction(async (tx) => {
          for (const f of m.fixtures) {
            await tx.insert(users).values({
              id: f.userId,
              name: `Owner M0 ${f.count}`,
              email: f.email,
              emailVerified: true,
              createdAt: now,
              updatedAt: now,
            });
            await tx.insert(businesses).values({
              id: f.businessId,
              name: `Fixture M0 ${f.count}`,
              slug: f.slug,
              countryCode: "EC",
              timezone: m.timezone,
              currencyCode: "USD",
              status: "active",
              categoryGcid: "gcid:store",
            });
            await tx.insert(memberships).values({
              userId: f.userId,
              businessId: f.businessId,
              role: "owner",
              status: "active",
              pinMustChange: false,
            });
            await tx.insert(subscriptions).values({
              businessId: f.businessId,
              plan: "trial",
              status: "active",
              trialEndsAt: new Date(+now + 30 * 86_400_000),
            });
            await tx.insert(businessModules).values(
              ["stock", "expenses"].map((moduleId) => ({
                businessId: f.businessId,
                moduleId,
                enabled: true,
              })),
            );
            await tx.insert(businessOnboardingTours).values(
              ONBOARDING_TOURS.map((tourId) => ({
                businessId: f.businessId,
                tourId,
                status: "completed",
              })),
            );
            await tx.insert(runs).values({
              businessId: f.businessId,
              day,
              status: "ready",
              policyVersion: policy.version,
              preparedAt: now,
            });
            for (const c of f.cards) {
              const rule = policy.rules.find((r) => r.id === c.key)!;
              expect(rule.enabled).toBe(true);
              expect(rule.category).not.toBe("marketing");
              const card: CardCandidate = {
                cardKey: c.key,
                subjectKey: c.subject,
                sender: `Fixture ${rule.handler}`,
                title: `Aviso sintético ${c.key}`,
                body: "Datos sintéticos para medir la carga inicial.",
                amountMinor: 10000,
                currencyCode: "USD",
                minorUnit: 2,
                quality: "observed",
                actionKey: rule.actionKey,
                urgency: 1,
                weight: 100,
                fingerprint: c.id,
                locationId: null,
              };
              const common = {
                businessId: f.businessId,
                cardKey: c.key,
                subjectKey: c.subject,
                fingerprint: c.id,
                policyVersion: policy.version,
                contextVersion: `m0:${c.id}`,
                episodeStartedAt: now,
                expiresAt: new Date(m.expiresAt),
              };
              await tx.insert(states).values({
                ...common,
                candidateId: c.id,
                status: "open",
                shownDays: 0,
                lastShownDay: day,
                context: { kind: "measurement", runId },
                revision: 0,
              });
              await tx.insert(candidates).values({
                ...common,
                id: c.id,
                day,
                weight: "100",
                amountMinor: 10000n,
                currencyCode: "USD",
                minorUnit: 2,
                category: rule.category,
                parameters: card,
                period: { from: day, to: day, label: "Fixture de medición" },
              });
            }
          }
        });
        await checkStored(m);
        await confirmInbox(m);
        // Validation uses the REAL lifecycle, then restores unexposed state outside timing.
        for (const f of m.fixtures)
          await getDb()
            .update(states)
            .set({ shownDays: 0, lastShownDay: day, updatedAt: now })
            .where(eq(states.businessId, f.businessId));
        await checkStored(m);
        m.phase = "ready-unexposed";
        await writeFile(file, JSON.stringify(m, null, 2), { mode: 0o600 });
        return;
      }
      const m = JSON.parse(await readFile(file, "utf8")) as Manifest;
      validate(m, endpoint);
      if (operation === "cleanup") {
        // Validate ALL ownership before the first delete, even for partial failed setup.
        for (const f of m.fixtures) await assertOwned(f);
        await withDbTransaction(async (tx) => {
          for (const f of m.fixtures) {
            await tx
              .delete(businesses)
              .where(
                and(
                  eq(businesses.id, f.businessId),
                  eq(businesses.slug, f.slug),
                ),
              );
            await tx
              .delete(users)
              .where(and(eq(users.id, f.userId), eq(users.email, f.email)));
          }
        });
        m.phase = "cleaned";
      } else {
        await checkStored(m);
        if (operation === "login") await loginFixtures(m);
        if (operation === "stabilize") {
          await confirmInbox(m);
          await checkStored(m);
          m.phase = "ready-exposed";
        }
        // Inspect never invokes readInbox: observing does not silently expose cards.
      }
      await writeFile(file, JSON.stringify(m, null, 2), { mode: 0o600 });
    }, 120_000);
  },
);
