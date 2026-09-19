import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.NEON_INTEGRATION_DATABASE_URL;
const enabled =
  Boolean(url) && process.env.NEON_INTEGRATION_ISOLATED === "true";
if (enabled) process.env.DATABASE_URL = url;

import { getDb } from "./db";
import {
  businesses,
  loyaltyProgramEvents,
  loyaltyPrograms,
  loyaltyRewards,
  memberships,
  users,
} from "./schema";
import { programForOwner, saveProgram } from "./loyalty-program";
import { stampForPublicProgram } from "./loyalty-program/stamp";
import { toClientProgram } from "./loyalty-program/client-view";
import { GET } from "../app/api/public/loyalty/[businessId]/[programId]/stamp/route";

/**
 * Spec 0077 §5 — el TERCER argumento de `saveProgram`, obligatorio para que el typecheck
 * fuerce a cada puerta a declarar con qué autorización escribe. Estos casos son de DOMINIO,
 * no del gate: escriben como un owner con el email verificado, igual que antes de la spec.
 */
const OWNER_VERIFICADO = { emailVerified: true, onboardingGrantActive: false };

/**
 * Spec 0069 §D5 — el placeholder del sello, CONTRA LA BASE.
 *
 * Tres propiedades que ningún test sin Neon puede dar:
 *
 * 1. Un programa creado sin sello sirve un **PNG de verdad** por la ruta pública.
 * 2. **ORÁCULO DE LA MUTACIÓN #3**: con un sello puesto, una versión VIEJA sigue siendo
 *    **404**, no placeholder. Si el placeholder tapara una versión vencida, un sello
 *    real recién subido se vería reemplazado por la letra — peor que el 404, porque el
 *    404 lo arregla recargar y esto no.
 * 3. **Regresión**: con la versión vigente, el programa con sello resuelve a su prefijo
 *    de R2 como siempre.
 *
 * El sello se escribe por SQL directo: subirlo de verdad exige R2, y lo que se mide acá
 * es el guard de versión, no el pipeline de imagen (que ya tiene sus propios tests).
 */
const PNG_MAGIC = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const STAMP_KEY = "loyalty/integration/placeholder/abc123";

describe.skipIf(!enabled)(
  "el sello placeholder contra Neon (spec 0069 §D5)",
  () => {
    const ownerId = `stamp-ph-${randomUUID()}`;
    const businessId = randomUUID();
    const businessName = "Ángeles Café";
    let programId = "";

    const get = (version: string) =>
      GET(
        new Request(
          `http://localhost:3001/api/public/loyalty/${businessId}/${programId}/stamp?v=${version}`,
        ),
        {
          params: Promise.resolve({ businessId, programId }),
        },
      );

    beforeAll(async () => {
      const db = getDb();
      await db.insert(users).values({
        id: ownerId,
        name: "Owner Placeholder",
        email: `${ownerId}@example.test`,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await db.insert(businesses).values({
        id: businessId,
        name: businessName,
        slug: `placeholder-${businessId.slice(0, 12)}`,
        categoryGcid: "gcid:cafe",
        countryCode: "EC",
        timezone: "America/Guayaquil",
      });
      await db
        .insert(memberships)
        .values({ businessId, userId: ownerId, role: "owner" });
      await saveProgram(
        ownerId,
        {
          kind: "stamps",
          configuration: { unitName: "sello", target: 8 },
          clauses: [{ text: "Términos del sello." }],
          accrual: { mode: "per_purchase", grant: 1, blockAmount: null },
          rewards: [{ type: "custom", label: "Café gratis" }],
        },
        OWNER_VERIFICADO,
      );
      programId = (await programForOwner(ownerId))!.program!.id;
    }, 60_000);

    afterAll(async () => {
      const db = getDb();
      await db
        .delete(loyaltyProgramEvents)
        .where(eq(loyaltyProgramEvents.businessId, businessId));
      await db
        .delete(loyaltyRewards)
        .where(eq(loyaltyRewards.businessId, businessId));
      await db
        .delete(loyaltyPrograms)
        .where(eq(loyaltyPrograms.businessId, businessId));
      await db
        .delete(memberships)
        .where(eq(memberships.businessId, businessId));
      await db.delete(businesses).where(eq(businesses.id, businessId));
      await db.delete(users).where(eq(users.id, ownerId));
    }, 60_000);

    it("el programa SIN sello expone un stampImagePath no nulo, y apunta a v=0", async () => {
      const context = await programForOwner(ownerId);
      expect(context?.program?.stampImageObjectKey).toBeNull();
      const dto = toClientProgram(
        context!.program!,
        businessId,
        context!.rewards,
      );
      expect(dto?.stampImagePath).toBe(
        `/api/public/loyalty/${businessId}/${programId}/stamp?v=0`,
      );
      expect(JSON.stringify(dto)).not.toContain("ObjectKey");
    }, 30_000);

    it("esa URL responde 200 image/png con el magic number PNG", async () => {
      const response = await get("0");
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("image/png");
      const bytes = Buffer.from(await response.arrayBuffer());
      expect(bytes.subarray(0, 8)).toEqual(PNG_MAGIC);
      expect(bytes.byteLength).toBeGreaterThan(500);
    }, 30_000);

    it("sin sello, una versión que no es la vigente ya es 404", async () => {
      expect((await get("7")).status).toBe(404);
    }, 30_000);

    it("un programa que no existe es 404, no un placeholder", async () => {
      const response = await GET(
        new Request(
          `http://localhost:3001/api/public/loyalty/${businessId}/${randomUUID()}/stamp?v=0`,
        ),
        {
          params: Promise.resolve({ businessId, programId: randomUUID() }),
        },
      );
      expect(response.status).toBe(404);
    }, 30_000);

    describe("con un sello puesto", () => {
      beforeAll(async () => {
        await getDb()
          .update(loyaltyPrograms)
          .set({ stampImageObjectKey: STAMP_KEY, stampImageVersion: 1 })
          .where(eq(loyaltyPrograms.id, programId));
      }, 30_000);

      // === MUTACIÓN #3 ===
      it("una versión VIEJA sigue siendo 404, NO el placeholder", async () => {
        expect(
          await stampForPublicProgram(businessId, programId, "0"),
        ).toBeNull();
        const response = await get("0");
        expect(response.status).toBe(404);
        expect(await response.text()).toBe("");
      }, 30_000);

      // === REGRESIÓN ===
      it("con la versión vigente resuelve al prefijo de R2 de siempre", async () => {
        expect(await stampForPublicProgram(businessId, programId, "1")).toEqual(
          {
            kind: "stamp",
            objectKey: STAMP_KEY,
          },
        );
      }, 30_000);

      // AISLAMIENTO — el oráculo que faltaba, agregado tras el PASS del revisor de la
      // 0069. `stampForPublicProgram` filtra por el PAR (businessId, programId), pero
      // NADA lo pinneaba: el revisor quitó ese `eq(businessId)` y los 6 archivos que
      // tocan la superficie pasaron igual (23 tests verdes con la mutación viva). Sin
      // esta aserción, un refactor futuro puede dejar que el id de un negocio lea el
      // sello de otro y ningún gate lo nota.
      it("otro negocio NO puede leer este sello aunque acierte el programId", async () => {
        expect(
          await stampForPublicProgram(randomUUID(), programId, "1"),
        ).toBeNull();
        const otherBusinessId = randomUUID();
        const response = await GET(
          new Request(
            `http://localhost:3001/api/public/loyalty/${otherBusinessId}/${programId}/stamp?v=1`,
          ),
          {
            params: Promise.resolve({
              businessId: otherBusinessId,
              programId,
            }),
          },
        );
        expect(response.status).toBe(404);
      }, 30_000);

      it("y el DTO del owner apunta a esa versión, sin serializar la key", async () => {
        const context = await programForOwner(ownerId);
        const dto = toClientProgram(
          context!.program!,
          businessId,
          context!.rewards,
        );
        expect(dto?.stampImagePath).toBe(
          `/api/public/loyalty/${businessId}/${programId}/stamp?v=1`,
        );
        expect(JSON.stringify(dto)).not.toContain(STAMP_KEY);
        expect(JSON.stringify(dto)).not.toContain("ObjectKey");
      }, 30_000);
    });
  },
);
