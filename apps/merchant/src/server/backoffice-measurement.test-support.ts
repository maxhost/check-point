/** Private manifest, ownership and protected CI checks for the opt-in M0 fixture. */
import { createHash } from "node:crypto";
import { lstat, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";
import { and, eq } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
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
import {
  neonEndpointId,
  PROD_DB_ENDPOINT_SHA12,
} from "../../../../packages/db/src/local";
import { ANALYTICS_POLICY as policy } from "@mi-pasaporte/domain/analytics/policy/index";
import { localDay } from "@mi-pasaporte/domain/analytics/date";
import type { InboxCard } from "@mi-pasaporte/domain/analytics/types";
import { ONBOARDING_TOURS } from "./onboarding/tours";
import { MODULES } from "../modules/registry";

export type Fixture = {
  userId: string;
  businessId: string;
  email: string;
  slug: string;
  count: 0 | 5;
  cards: {
    id: string;
    key: string;
    subject: string;
    version?: string;
    action?: InboxCard["action"];
    title?: string;
    decisions?: InboxCard["decisions"];
  }[];
};
export type Manifest = {
  kind: "backoffice-measurement-v1";
  runId: string;
  endpoint: string;
  day: string;
  timezone: string;
  currency: "USD";
  policyVersion: string;
  createdAt: string;
  expiresAt: string;
  phase: string;
  observations?: unknown[];
  fixtures: Fixture[];
  moduleIds: string[];
};
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex").slice(0, 12);
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export async function guard() {
  expect(process.env.NEON_INTEGRATION_ISOLATED).toBe("true");
  const url = process.env.NEON_INTEGRATION_DATABASE_URL;
  if (!url) throw new Error("Missing protected CI integration URL");
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error("Invalid protected URL");
  }
  const endpoint = neonEndpointId(url),
    fingerprint = hash(endpoint);
  expect(host).toMatch(/^ep-[a-z0-9-]+\.[a-z0-9.-]+\.neon\.tech$/);
  expect(fingerprint).not.toBe(PROD_DB_ENDPOINT_SHA12);
  expect(process.env.BACKOFFICE_MEASUREMENT_ENDPOINT_SHA12).toBe(fingerprint);
  const file = process.env.BACKOFFICE_MEASUREMENT_MANIFEST;
  if (!file || !isAbsolute(file) || !file.endsWith(".json"))
    throw new Error("Absolute private manifest .json required");
  const parent = await realpath(dirname(file));
  const temporary = await realpath(tmpdir());
  if (
    ![temporary, "/private/tmp", "/tmp"].some((root) => {
      const part = relative(root, parent);
      return part === "" || (!part.startsWith("..") && !isAbsolute(part));
    })
  )
    throw new Error(
      "Manifest must be under a private temporary directory outside repository",
    );
  const destination = resolve(parent, file.split("/").at(-1)!);
  const repository = await realpath(
    fileURLToPath(new URL("../../../../", import.meta.url)),
  );
  const inRepository = relative(repository, destination);
  if (!inRepository.startsWith("..") && !isAbsolute(inRepository))
    throw new Error("Manifest inside repository forbidden");
  const existing = await lstat(destination).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
      return null;
    },
  );
  if (existing && (!existing.isFile() || existing.isSymbolicLink()))
    throw new Error("Manifest must be a regular private file");
  process.env.DATABASE_URL = url;
  return {
    file: resolve(parent, file.split("/").at(-1)!),
    endpoint: fingerprint,
  };
}
function validateModuleIds(ids: string[]) {
  expect(Array.isArray(ids)).toBe(true);
  expect(ids.length).toBeGreaterThan(0);
  expect(new Set(ids).size).toBe(ids.length);
  for (const id of ids) {
    expect(typeof id).toBe("string");
    const manifest = MODULES.find((module) => module.id === id);
    expect(manifest).toBeDefined();
    for (const dependency of manifest!.requires)
      expect(ids).toContain(dependency);
  }
}
export function validate(m: Manifest, endpoint: string) {
  validateModuleIds(m.moduleIds);
  expect(m.kind).toBe("backoffice-measurement-v1");
  expect(m.runId).toMatch(uuid);
  expect(m.endpoint).toBe(endpoint);
  expect(m.timezone).toBe("America/Guayaquil");
  expect(m.currency).toBe("USD");
  expect(m.fixtures.map((f) => f.count)).toEqual([0, 5]);
  for (const f of m.fixtures) {
    expect(f.userId).toMatch(uuid);
    expect(f.businessId).toMatch(uuid);
    expect(f.email).toBe(`bo0238-${m.runId}-${f.count}@example.test`);
    expect(f.slug).toBe(`bo0238-${m.runId}-${f.count}`);
    expect(f.cards).toHaveLength(f.count);
    for (const c of f.cards) {
      expect(c.id).toMatch(uuid);
      expect(c.subject).toMatch(uuid);
    }
  }
}
export async function assertOwned(f: Fixture) {
  const db = getDb();
  const [user] = await db
    .select({ email: users.email, verified: users.emailVerified })
    .from(users)
    .where(eq(users.id, f.userId));
  const [business] = await db
    .select({
      slug: businesses.slug,
      status: businesses.status,
      timezone: businesses.timezone,
      currency: businesses.currencyCode,
    })
    .from(businesses)
    .where(eq(businesses.id, f.businessId));
  if (user) expect(user.email).toBe(f.email);
  if (business) expect(business.slug).toBe(f.slug);
  return { user, business };
}
export async function checkStored(m: Manifest) {
  const observations: unknown[] = [];
  expect(m.policyVersion).toBe(policy.version);
  expect(localDay(new Date(), m.timezone)).toBe(m.day);
  expect(Date.parse(m.expiresAt) - Date.now()).toBeGreaterThan(3_600_000);
  for (const f of m.fixtures) {
    const owned = await assertOwned(f);
    expect(owned.user).toMatchObject({ verified: true });
    expect(owned.business).toMatchObject({
      status: "active",
      timezone: m.timezone,
      currency: m.currency,
    });
    const db = getDb();
    const modules = await db
      .select({ id: businessModules.moduleId })
      .from(businessModules)
      .where(
        and(
          eq(businessModules.businessId, f.businessId),
          eq(businessModules.enabled, true),
        ),
      );
    expect(modules.map((r) => r.id).sort()).toEqual([...m.moduleIds].sort());
    const tours = await db
      .select({ id: businessOnboardingTours.tourId })
      .from(businessOnboardingTours)
      .where(eq(businessOnboardingTours.businessId, f.businessId));
    expect(tours.map((r) => r.id).sort()).toEqual([...ONBOARDING_TOURS].sort());
    const [member] = await db
      .select({
        role: memberships.role,
        status: memberships.status,
        pinMustChange: memberships.pinMustChange,
      })
      .from(memberships)
      .where(
        and(
          eq(memberships.businessId, f.businessId),
          eq(memberships.userId, f.userId),
        ),
      );
    expect(member).toEqual({
      role: "owner",
      status: "active",
      pinMustChange: false,
    });
    const [billing] = await db
      .select({
        plan: subscriptions.plan,
        trialEndsAt: subscriptions.trialEndsAt,
      })
      .from(subscriptions)
      .where(eq(subscriptions.businessId, f.businessId));
    expect(billing?.plan).toBe("trial");
    expect(billing?.trialEndsAt!.getTime()).toBeGreaterThan(
      Date.now() + 3_600_000,
    );
    const [run] = await db
      .select()
      .from(runs)
      .where(and(eq(runs.businessId, f.businessId), eq(runs.day, m.day)));
    expect(run).toMatchObject({
      status: "ready",
      policyVersion: m.policyVersion,
    });
    const content = await db
      .select()
      .from(candidates)
      .where(eq(candidates.businessId, f.businessId));
    const control = await db
      .select()
      .from(states)
      .where(eq(states.businessId, f.businessId));
    expect(content.map((c) => c.id).sort()).toEqual(
      f.cards.map((c) => c.id).sort(),
    );
    expect(control).toHaveLength(f.count);
    for (const c of control) {
      expect(c).toMatchObject({
        status: "open",
        policyVersion: m.policyVersion,
        revision: 0,
        remindAt: null,
      });
      expect(c.expiresAt.toISOString()).toBe(m.expiresAt);
      expect(+c.expiresAt - +c.episodeStartedAt).toBe(
        policy.lifetime.days * 86_400_000,
      );
      expect(content.find((r) => r.id === c.candidateId)).toMatchObject({
        cardKey: c.cardKey,
        subjectKey: c.subjectKey,
        contextVersion: c.contextVersion,
        policyVersion: m.policyVersion,
      });
    }
    observations.push({
      businessId: f.businessId,
      observedAt: new Date().toISOString(),
      candidates: content.length,
      controls: control.length,
      visibleExpected: f.count,
      trialEndsAt: billing.trialEndsAt,
      exposure: control.map(
        ({
          candidateId,
          shownDays,
          lastShownDay,
          revision,
          remindAt,
          expiresAt,
        }) => ({
          candidateId,
          shownDays,
          lastShownDay,
          revision,
          remindAt,
          expiresAt,
        }),
      ),
    });
  }
  m.observations = observations;
}
