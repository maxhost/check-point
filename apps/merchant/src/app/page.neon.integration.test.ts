import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Revisor independiente spec 0163: la rama CON sesion de `app/page.tsx` contra Neon.
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
  type Seed,
} from "../server/counter-integration-support";
import { getDb } from "@mi-pasaporte/db";
import { sessions, users } from "@mi-pasaporte/db/schema";
import { openMerchantSession } from "../server/merchant-session";
import { requireBackofficeSession } from "../server/auth-guards";
import MerchantEntryPage from "./page";

const cookieFor = async (userId: string) =>
  (await openMerchantSession(userId)).split(";")[0];

async function landing(cookie: string): Promise<string> {
  req.cookie = cookie;
  try {
    const element = await MerchantEntryPage();
    return element ? "portada" : "nada";
  } catch (error) {
    return (error as Error).message;
  }
}

describe.skipIf(!integrationEnabled)("app/page.tsx — spec 0163", () => {
  let seed: Seed;
  let ownerCookie: string;
  const orphan = { userId: "", cookie: "" };

  beforeAll(async () => {
    seed = await seedBusiness({
      name: `Entrada ${randomUUID().slice(0, 8)}`,
      kind: "points",
      mode: "per_amount",
      grant: 10,
      blockAmount: "1.00",
    });
    ownerCookie = await cookieFor(seed.userId);
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
    await dropBusiness(seed.business.id);
    await getDb().delete(sessions).where(eq(sessions.userId, orphan.userId));
    await getDb().delete(users).where(eq(users.id, orphan.userId));
  }, 60_000);

  it("sin cookie y con cookie basura: onboarding", async () => {
    expect(await landing("")).toBe("redirect:/es/business/onboarding");
    expect(await landing("better-auth.session_token=basura")).toBe(
      "redirect:/es/business/onboarding",
    );
  });

  it("sesion valida con negocio: conserva la portada", async () => {
    expect(await landing(ownerCookie)).toBe("portada");
  });

  it("sesion valida SIN membresia: guard rebota a / y / muestra portada (sin ciclo)", async () => {
    req.cookie = orphan.cookie;
    await expect(requireBackofficeSession()).rejects.toThrow("redirect:/");
    expect(await landing(orphan.cookie)).toBe("portada");
  });

  it("cookie firmada cuya fila se borro: onboarding", async () => {
    const cookie = await cookieFor(orphan.userId);
    await getDb().delete(sessions).where(eq(sessions.userId, orphan.userId));
    expect(await landing(cookie)).toBe("redirect:/es/business/onboarding");
  });
});
