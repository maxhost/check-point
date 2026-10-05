import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// better-auth necesita estas dos para construirse; valores de test sobre la rama aislada.
process.env.BETTER_AUTH_SECRET ||= "integration-secret-at-least-32-chars-xx";
process.env.BETTER_AUTH_URL ||= "http://localhost:3001";

import {
  type Seed,
  dropBusiness,
  integrationEnabled,
  seedBusiness,
  seedMember,
} from "./counter-integration-support";
import { getMerchantAuth } from "./auth";
import { getDb } from "@mi-pasaporte/db";
import { businesses, memberships, sessions } from "@mi-pasaporte/db/schema";
import { type QaAccount, qaLoginPost } from "./qa-login";

/**
 * Spec 0150 — el login de QA (temporal) contra Neon: la cookie de verdad y el paso 3
 * (membresia `owner` `active` de ESE comercio, comercio `active`).
 *
 * NUNCA siembra las uuids de PROD: la tabla se inyecta (`qaLoginPost(request, accounts)`)
 * con cuentas sembradas en la rama de CI. El cableado de la ruta con la tabla fija y con el
 * apagado lo prueba `app/api/merchant/auth/qa-login/route.test.ts`.
 */
const request = (account: string) =>
  new Request("http://localhost:3001/api/merchant/auth/qa-login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ account }),
  });

const sessionCount = async (userId: string) =>
  (
    await getDb()
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.userId, userId))
  ).length;

const setMembership = (
  businessId: string,
  userId: string,
  status: "active" | "disabled",
) =>
  getDb()
    .update(memberships)
    .set({ status })
    .where(
      and(
        eq(memberships.businessId, businessId),
        eq(memberships.userId, userId),
      ),
    );

describe.skipIf(!integrationEnabled)(
  "login de QA sin link magico (spec 0150)",
  () => {
    let a: Seed;
    let b: Seed;
    let staffId: string;
    let accounts: QaAccount[];

    beforeAll(async () => {
      a = await seedBusiness({
        name: "QA Panaderia",
        kind: "stamps",
        mode: "per_purchase",
        grant: 1,
        blockAmount: null,
      });
      b = await seedBusiness({
        name: "QA Barberia",
        kind: "stamps",
        mode: "per_purchase",
        grant: 1,
        blockAmount: null,
      });
      staffId = await seedMember({ businessId: a.business.id, role: "staff" });
      accounts = [
        {
          account: "ok",
          label: "Ok",
          businessId: a.business.id,
          userId: a.userId,
        },
        // El owner de B apuntando al comercio A: es owner, pero NO de ESE comercio.
        {
          account: "ajeno",
          label: "Ajeno",
          businessId: a.business.id,
          userId: b.userId,
        },
        {
          account: "staff",
          label: "Staff",
          businessId: a.business.id,
          userId: staffId,
        },
        {
          account: "cerrado",
          label: "Cerrado",
          businessId: b.business.id,
          userId: b.userId,
        },
      ];
    }, 60_000);

    afterAll(async () => {
      await dropBusiness(a.business.id);
      await dropBusiness(b.business.id);
    }, 30_000);

    it("valido → 200 con Set-Cookie que abre la sesion del `user_id` de la tabla", async () => {
      const response = await qaLoginPost(request("ok"), accounts);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ redirectTo: "/backoffice" });
      const cookie = response.headers.get("set-cookie") ?? "";
      expect(cookie).toContain("HttpOnly");
      const session = await getMerchantAuth().api.getSession({
        headers: new Headers({ cookie: cookie.split(";")[0] }),
      });
      expect(session?.user.id).toBe(a.userId);
    }, 60_000);

    it("membresia `disabled` → 403 qa_account_unavailable, sin sesion", async () => {
      await setMembership(a.business.id, a.userId, "disabled");
      try {
        const before = await sessionCount(a.userId);
        const response = await qaLoginPost(request("ok"), accounts);
        expect(response.status).toBe(403);
        expect((await response.json()).code).toBe("qa_account_unavailable");
        expect(response.headers.get("set-cookie")).toBeNull();
        expect(await sessionCount(a.userId)).toBe(before);
      } finally {
        await setMembership(a.business.id, a.userId, "active");
      }
    }, 60_000);

    it("rol `staff` activo → 403, sin sesion", async () => {
      const response = await qaLoginPost(request("staff"), accounts);
      expect(response.status).toBe(403);
      expect((await response.json()).code).toBe("qa_account_unavailable");
      expect(await sessionCount(staffId)).toBe(0);
    }, 60_000);

    it("owner de OTRO comercio → 403, sin sesion", async () => {
      const before = await sessionCount(b.userId);
      const response = await qaLoginPost(request("ajeno"), accounts);
      expect(response.status).toBe(403);
      expect(await sessionCount(b.userId)).toBe(before);
    }, 60_000);

    it.each(["suspended", "closed"] as const)(
      "comercio `%s` → 403, sin sesion",
      async (status) => {
        await getDb()
          .update(businesses)
          .set({ status })
          .where(eq(businesses.id, b.business.id));
        try {
          const before = await sessionCount(b.userId);
          const response = await qaLoginPost(request("cerrado"), accounts);
          expect(response.status).toBe(403);
          expect((await response.json()).code).toBe("qa_account_unavailable");
          expect(await sessionCount(b.userId)).toBe(before);
        } finally {
          await getDb()
            .update(businesses)
            .set({ status: "active" })
            .where(eq(businesses.id, b.business.id));
        }
      },
      60_000,
    );

    it("control: con todo activo, la misma cuenta del comercio B entra", async () => {
      const response = await qaLoginPost(request("cerrado"), accounts);
      expect(response.status).toBe(200);
    }, 60_000);
  },
);
