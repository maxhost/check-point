import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import {
  aiRequests,
  businesses,
  expenseConcepts,
  expenses,
  moduleEvents,
} from "@mi-pasaporte/db/schema";
import { ScriptedAiProvider, aiRaw } from "../../../server/ai/ai-test-support";
import { POST } from "../../../app/api/modules/[moduleId]/[[...path]]/route";
import {
  callModuleRoute,
  dropModuleWorld,
  enableModules,
  moduleStaff,
  modulesIntegrationEnabled,
  seedModuleWorld,
  type ModuleWorld,
} from "../../modules-integration-support";
import { buildDraft, buildPhotoDraft } from "../draft";
import { createExpenses } from "./writers";
const run = modulesIntegrationEnabled ? describe : describe.skip;
run(
  "0236 synchronous text/photo proposals use tenant concepts without recording payments",
  { timeout: 60000 },
  () => {
    let world: ModuleWorld, other: ModuleWorld, conceptId: string, png: Buffer;
    beforeAll(async () => {
      world = await seedModuleWorld("expense-draft");
      other = await seedModuleWorld("expense-draft-foreign");
      await enableModules(world, ["expenses"]);
      const [concept] = await getDb()
        .insert(expenseConcepts)
        .values({
          businessId: world.businessId,
          category: "personnel",
          name: "Luis",
          normalizedName: "luis",
        })
        .returning();
      conceptId = concept.id;
      await getDb().insert(expenseConcepts).values({
        businessId: other.businessId,
        category: "personnel",
        name: "Privado extranjero",
        normalizedName: "privado extranjero",
      });
      await getDb()
        .update(businesses)
        .set({ timezone: "Pacific/Kiritimati" })
        .where(eq(businesses.id, world.businessId));
      png = await sharp({
        create: { width: 30, height: 20, channels: 3, background: "#ccc" },
      })
        .png()
        .toBuffer();
    });
    afterAll(async () => {
      await dropModuleWorld(world);
      await dropModuleWorld(other);
    });
    const line = (changes: Record<string, unknown> = {}) => ({
      paidOn: "2024-02-29",
      amountMinor: "45000",
      category: "personnel",
      conceptId,
      conceptName: "Luis",
      name: "Sueldo Luis",
      isFixed: false,
      locationId: world.locationId,
      sourceText: "pagué a Luis 450",
      ...changes,
    });
    const scripted = (lines: unknown[]) =>
      new ScriptedAiProvider({
        id: "scripted",
        model: "test",
        run: () => aiRaw({ lines, unparsed: [] }),
      });
    function photoRequest(
      cookie = world.cookie,
      photo = png,
      location = "business",
    ) {
      const form = new FormData();
      form.append("locationId", location);
      form.append(
        "photos",
        new File([new Uint8Array(photo)], "private-receipt.png", {
          type: "image/png",
        }),
      );
      return new Request(
        "http://localhost/api/modules/expenses/entries/draft-photo",
        { method: "POST", headers: { cookie }, body: form },
      );
    }
    it("two expressions reuse own concept; foreign ID is unresolved and ambiguous date/money remain null", async () => {
      const [foreign] = await getDb()
        .select()
        .from(expenseConcepts)
        .where(eq(expenseConcepts.businessId, other.businessId));
      const provider = scripted([
        line(),
        line({
          conceptId: null,
          conceptName: " ＬＵＩＳ ",
          sourceText: "sueldo Luis 450",
        }),
        line({
          conceptId: foreign.id,
          conceptName: "Otro nombre",
          amountMinor: "NaN",
          paidOn: "2026-02-29",
        }),
      ]);
      const result = await buildDraft(
        world.businessId,
        world.ownerId,
        {
          text: "pagué a Luis 450, sueldo Luis 450",
          locationId: world.locationId,
        },
        provider,
      );
      expect(result.draft.lines.slice(0, 2).map((l) => l.conceptId)).toEqual([
        conceptId,
        conceptId,
      ]);
      expect(result.draft.lines[2]).toMatchObject({
        conceptId: null,
        paidOn: null,
        amountMinor: null,
      });
      expect(result.draft.unparsed).toContain("pagué a Luis 450");
      const context = JSON.parse(provider.calls[0].input.context!);
      expect(context.concepts).toHaveLength(1);
      expect(context.concepts[0].id).toBe(conceptId);
      expect(JSON.stringify(context)).not.toContain("Privado extranjero");
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Pacific/Kiritimati",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      expect(context).toMatchObject({
        today,
        timeZone: "Pacific/Kiritimati",
        currencyCode: "USD",
        minorUnit: 2,
      });
      expect(
        await getDb()
          .select()
          .from(expenses)
          .where(eq(expenses.businessId, world.businessId)),
      ).toEqual([]);
      expect(
        await getDb()
          .select()
          .from(moduleEvents)
          .where(eq(moduleEvents.businessId, world.businessId)),
      ).toEqual([]);
    });
    it("photo is normalized to JPEG per synchronous request, can be reanalysed and persists only usage metadata", async () => {
      const provider = scripted([line({ locationId: null })]);
      for (let i = 0; i < 2; i++) {
        const result = await buildPhotoDraft(
          world.businessId,
          world.ownerId,
          photoRequest(),
          provider,
        );
        expect(result.draft.lines[0].locationId).toBeNull();
      }
      expect(provider.calls).toHaveLength(2);
      expect(provider.calls[0].task).toMatchObject({
        id: "expenses.entry_photo",
        mode: "sync",
      });
      expect(provider.calls[0].input.images?.[0].jpeg.subarray(0, 3)).toEqual(
        Buffer.from([0xff, 0xd8, 0xff]),
      );
      const rows = await getDb()
        .select()
        .from(aiRequests)
        .where(
          and(
            eq(aiRequests.businessId, world.businessId),
            eq(aiRequests.task, "expenses.entry_photo"),
          ),
        );
      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({
        inputImages: 1,
        inputChars: 0,
        status: "ok",
        outputItems: 1,
      });
      expect(JSON.stringify(rows)).not.toMatch(
        /Sueldo Luis|private-receipt|base64|sourceText|imagePath|objectKey/,
      );
      expect(
        await getDb()
          .select()
          .from(expenses)
          .where(eq(expenses.businessId, world.businessId)),
      ).toEqual([]);
      const result = await buildPhotoDraft(
        world.businessId,
        world.ownerId,
        photoRequest(),
        provider,
      );
      const saved = await createExpenses(world.businessId, world.ownerId, {
        operationId: crypto.randomUUID(),
        expectedCurrencyCode: "USD",
        lines: result.draft.lines,
      });
      expect(saved.expenses).toHaveLength(1);
      expect(JSON.stringify(saved)).not.toMatch(
        /sourceText|base64|objectKey|photo/,
      );
    });
    it("real dispatcher requires expenses permission and validates actual bytes without AI calls", async () => {
      const denied = await moduleStaff(world, ["staff"]);
      const route = (request: Request) =>
        POST(request, {
          params: Promise.resolve({
            moduleId: "expenses",
            path: ["entries", "draft-photo"],
          }),
        });
      expect((await route(photoRequest(denied))).status).toBe(403);
      expect(
        (await route(photoRequest(world.cookie, Buffer.from("not-an-image"))))
          .status,
      ).toBe(415);
      const form = new FormData();
      form.append("locationId", "business");
      expect(
        (
          await route(
            new Request(
              "http://localhost/api/modules/expenses/entries/draft-photo",
              { method: "POST", headers: { cookie: world.cookie }, body: form },
            ),
          )
        ).status,
      ).toBe(422);
      const fake = await route(photoRequest());
      expect(fake.status).toBe(200);
      expect(await fake.json()).toEqual({ draft: { lines: [], unparsed: [] } });
      const response = await callModuleRoute(
        "POST",
        "/api/modules/expenses/entries/draft",
        world.cookie,
        { text: "", locationId: null },
      );
      expect(response.status).toBe(422);
    });
  },
);
