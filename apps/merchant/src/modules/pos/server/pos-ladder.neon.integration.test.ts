import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// better-auth necesita estas dos para construirse; valores de test sobre la rama aislada.
process.env.BETTER_AUTH_SECRET ||= "integration-secret-at-least-32-chars-xx";
process.env.BETTER_AUTH_URL ||= "http://localhost:3001";

import { getDb } from "@mi-pasaporte/db";
import { businesses, subscriptions, users } from "@mi-pasaporte/db/schema";
import {
  type Seed,
  dropBusiness,
  integrationEnabled,
  seedBusiness,
  seedMember,
} from "../../../server/counter-integration-support";
import { openMerchantSession } from "../../../server/merchant-session";
import {
  capturePosScope,
  scopedPos,
  setPosModule,
} from "./pos-integration-support";

/**
 * Spec 0220 §Autorizacion — LA ESCALERA DEL POS ES LA DEL DESPACHADOR (`requireApiPermission` y
 * despues el modulo, ADR 0141 §Consecuencias): mismo orden que tenia `requirePosOperator`, contra
 * Neon y con sesiones reales, sobre `GET /api/modules/pos/orders`. Cada caso deshace su cambio en
 * `finally` (`protocolo-de-verificacion` 2.0-octies).
 */

const DAY = 86_400_000;
let a: Seed;
let ownerCookie: string;
const extraUsers: string[] = [];

const scopes = new Map<string, string>();
const cookieOf = async (userId: string) => {
  const cookie = (await openMerchantSession(userId)).split(";")[0];
  scopes.set(cookie, await capturePosScope(cookie, a.business.id));
  return cookie;
};
const orders = (cookie: string) =>
  scopedPos(cookie, scopes.get(cookie)!).list();

beforeAll(async () => {
  a = await seedBusiness({
    name: "Escalera POS",
    kind: "stamps",
    mode: "per_purchase",
    grant: 1,
    blockAmount: null,
  });
  await setPosModule(a.business.id, true);
  ownerCookie = await cookieOf(a.userId);
}, 60_000);

afterAll(async () => {
  await dropBusiness(a.business.id);
  for (const id of extraUsers)
    await getDb().delete(users).where(eq(users.id, id));
}, 60_000);

async function staff(permissions: string[], pinMustChange = false) {
  const userId = await seedMember({
    businessId: a.business.id,
    permissions,
    pinMustChange,
  });
  extraUsers.push(userId);
  return cookieOf(userId);
}

async function expectCode(response: Response, status: number, code: string) {
  expect(response.status).toBe(status);
  expect((await response.json()).code).toBe(code);
}

describe.skipIf(!integrationEnabled)("la escalera del POS (spec 0220)", () => {
  it("control: owner y staff con `pos` leen (200)", async () => {
    expect((await orders(ownerCookie)).status).toBe(200);
    expect((await orders(await staff(["pos"]))).status).toBe(200);
  }, 60_000);

  it("staff SIN `pos` y el POS apagado → `missing_permission`, no `module_disabled` (no se entera del modulo)", async () => {
    const cajero = await staff(["counter"]);
    await setPosModule(a.business.id, false);
    try {
      await expectCode(await orders(cajero), 403, "missing_permission");
      await expectCode(await orders(ownerCookie), 403, "module_disabled");
    } finally {
      await setPosModule(a.business.id, true);
    }
  }, 60_000);

  it("owner con el email sin verificar → 403 `email_not_verified`", async () => {
    await getDb()
      .update(users)
      .set({ emailVerified: false })
      .where(eq(users.id, a.userId));
    try {
      await expectCode(await orders(ownerCookie), 403, "email_not_verified");
    } finally {
      await getDb()
        .update(users)
        .set({ emailVerified: true })
        .where(eq(users.id, a.userId));
    }
  }, 60_000);

  it("negocio suspendido → 403 `business_suspended` (owner y staff)", async () => {
    const mozo = await staff(["pos"]);
    await getDb()
      .update(businesses)
      .set({ status: "suspended", suspensionReason: "Prueba." })
      .where(eq(businesses.id, a.business.id));
    try {
      for (const cookie of [ownerCookie, mozo])
        await expectCode(await orders(cookie), 403, "business_suspended");
    } finally {
      await getDb()
        .update(businesses)
        .set({ status: "active", suspensionReason: null })
        .where(eq(businesses.id, a.business.id));
    }
  }, 60_000);

  it("prueba vencida sin suscripcion → 402 `payment_required`", async () => {
    await getDb()
      .update(subscriptions)
      .set({ trialEndsAt: new Date(Date.now() - 1000) })
      .where(eq(subscriptions.businessId, a.business.id));
    try {
      await expectCode(await orders(ownerCookie), 402, "payment_required");
    } finally {
      await getDb()
        .update(subscriptions)
        .set({ trialEndsAt: new Date(Date.now() + 30 * DAY) })
        .where(eq(subscriptions.businessId, a.business.id));
    }
  }, 60_000);

  it("staff con `pos` y PIN temporal → 403 `pin_change_required`", async () => {
    await expectCode(
      await orders(await staff(["pos"], true)),
      403,
      "pin_change_required",
    );
  }, 60_000);
});
