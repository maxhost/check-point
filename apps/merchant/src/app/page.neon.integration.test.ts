import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Spec 0166 (antes 0163): la raíz del merchant contra Neon, con el guard REAL y la misma
// cookie. Con sesión válida y sin `?e=` → el panel; con `?e=` → la portada, nunca un redirect;
// y ningún rebote del guard, pasado a la raíz, vuelve a `/backoffice` (anti-ciclo).
process.env.BETTER_AUTH_SECRET ||= "integration-secret-at-least-32-chars-xx";
process.env.BETTER_AUTH_URL ||= "http://localhost:3001";

const req = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(req.cookie ? { cookie: req.cookie } : {}),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
}));

import {
  dropBusiness,
  integrationEnabled,
  seedBusiness,
  seedMember,
  type Seed,
} from "../server/counter-integration-support";
import { getDb } from "@mi-pasaporte/db";
import { businesses, sessions, users } from "@mi-pasaporte/db/schema";
import { openMerchantSession } from "../server/merchant-session";
import { requireBackofficeSession } from "../server/auth-guards";
import MerchantEntryPage from "./page";

const cookieFor = async (userId: string) =>
  (await openMerchantSession(userId)).split(";")[0];

/** La raíz pedida en `path` (`/` o `/?e=…`, tal como la devuelve el guard) con `cookie`. */
async function landing(cookie: string, path = "/"): Promise<string> {
  req.cookie = cookie;
  const query = new URL(path, "http://merchant.test").searchParams;
  const searchParams: Record<string, string> = {};
  query.forEach((value, key) => {
    searchParams[key] = value;
  });
  try {
    const element = await MerchantEntryPage({
      searchParams: Promise.resolve(searchParams),
    });
    return element ? "portada" : "nada";
  } catch (error) {
    return (error as Error).message;
  }
}

/** El destino al que el guard REAL rebota a `cookie` (sin el prefijo `redirect:`). */
async function guardBounce(cookie: string): Promise<string> {
  req.cookie = cookie;
  try {
    await requireBackofficeSession();
  } catch (error) {
    const message = (error as Error).message;
    expect(message.startsWith("redirect:")).toBe(true);
    return message.slice("redirect:".length);
  }
  throw new Error("el guard no rebotó");
}

const semilla = (name: string) =>
  seedBusiness({
    name: `${name} ${randomUUID().slice(0, 8)}`,
    kind: "points",
    mode: "per_amount",
    grant: 10,
    blockAmount: "1.00",
  });

describe.skipIf(!integrationEnabled)("app/page.tsx — spec 0166", () => {
  let active: Seed;
  let closed: Seed;
  let suspended: Seed;
  let ownerCookie: string;
  let closedOwnerCookie: string;
  let suspendedStaffCookie: string;
  let suspendedStaffId: string;
  const orphan = { userId: "", cookie: "" };

  beforeAll(async () => {
    active = await semilla("Entrada");
    closed = await semilla("Entrada cerrada");
    suspended = await semilla("Entrada suspendida");
    await getDb()
      .update(businesses)
      .set({ status: "closed", suspensionReason: null })
      .where(eq(businesses.id, closed.business.id));
    await getDb()
      .update(businesses)
      .set({ status: "suspended", suspensionReason: "Pago rechazado" })
      .where(eq(businesses.id, suspended.business.id));
    // Integrante con la forma de producción del seed: `emailVerified: false` (default).
    suspendedStaffId = await seedMember({ businessId: suspended.business.id });

    ownerCookie = await cookieFor(active.userId);
    closedOwnerCookie = await cookieFor(closed.userId);
    suspendedStaffCookie = await cookieFor(suspendedStaffId);

    orphan.userId = `entry-int-${randomUUID()}`;
    await getDb()
      .insert(users)
      .values({
        id: orphan.userId,
        name: "Sin negocio",
        email: `${orphan.userId}@example.test`,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    orphan.cookie = await cookieFor(orphan.userId);
  }, 120_000);

  afterAll(async () => {
    for (const seed of [active, closed, suspended]) {
      if (seed) await dropBusiness(seed.business.id);
    }
    const ids = [
      active?.userId,
      closed?.userId,
      suspended?.userId,
      suspendedStaffId,
      orphan.userId,
    ].filter((id): id is string => Boolean(id));
    await getDb().delete(sessions).where(inArray(sessions.userId, ids));
    await getDb().delete(users).where(inArray(users.id, ids));
  }, 60_000);

  it("sin cookie y con cookie basura: onboarding", async () => {
    expect(await landing("")).toBe("redirect:/es/business/onboarding");
    expect(await landing("better-auth.session_token=basura")).toBe(
      "redirect:/es/business/onboarding",
    );
  });

  it("sesion valida con negocio y sin `?e=`: el panel", async () => {
    expect(await landing(ownerCookie)).toBe("redirect:/backoffice");
    // `?e=` vacio cuenta como ausente: una sesion viva no se queda en la portada.
    expect(await landing(ownerCookie, "/?e=")).toBe("redirect:/backoffice");
  });

  it("con `?e=`: la portada, con y sin sesion, sin redirect", async () => {
    expect(await landing("", "/?e=algo")).toBe("portada");
    expect(await landing("better-auth.session_token=basura", "/?e=algo")).toBe(
      "portada",
    );
    expect(await landing(ownerCookie, "/?e=magic_link_invalid")).toBe(
      "portada",
    );
  });

  it.each([
    [
      "negocio `closed` (owner)",
      () => closedOwnerCookie,
      "/?e=business_closed",
    ],
    [
      "integrante de negocio `suspended`",
      () => suspendedStaffCookie,
      "/?e=business_suspended",
    ],
  ])(
    "anti-ciclo, %s: el destino del guard no vuelve al panel",
    async (_, cookie, expected) => {
      const dest = await guardBounce(cookie());
      expect(dest).toBe(expected);
      const next = await landing(cookie(), dest);
      expect(next).not.toBe("redirect:/backoffice");
      expect(next).toBe("portada");
    },
  );

  it("anti-ciclo, sesion SIN membresia: el guard revoca y la raiz manda al alta", async () => {
    const dest = await guardBounce(orphan.cookie);
    expect(dest).toBe("/");
    const left = await getDb()
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.userId, orphan.userId));
    expect(left).toHaveLength(0);
    const next = await landing(orphan.cookie, dest);
    expect(next).not.toBe("redirect:/backoffice");
    expect(next).toBe("redirect:/es/business/onboarding");
  });

  it("cookie firmada cuya fila se borro: onboarding", async () => {
    const cookie = await cookieFor(orphan.userId);
    await getDb().delete(sessions).where(eq(sessions.userId, orphan.userId));
    expect(await landing(cookie)).toBe("redirect:/es/business/onboarding");
  });
});
