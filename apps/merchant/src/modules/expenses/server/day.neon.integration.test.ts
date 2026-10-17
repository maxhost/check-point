import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { businesses } from "@mi-pasaporte/db/schema";
import { ScriptedAiProvider, aiRaw } from "../../../server/ai/ai-test-support";
import { modulesIntegrationEnabled } from "../../modules-integration-support";
import { buildDraft } from "../draft";
import { createExpenses } from "./writers";
import { listExpenses } from "./queries";
import { useExpenseWorld } from "./integration-support";
const run = modulesIntegrationEnabled ? describe : describe.skip;
run(
  "0236 commercial payment day across UTC month boundary",
  { timeout: 60000 },
  () => {
    const f = useExpenseWorld();
    it("today in Guayaquil stays in December although the UTC instant is in January", async () => {
      await getDb()
        .update(businesses)
        .set({ timezone: "America/Guayaquil" })
        .where(eq(businesses.id, f.world.businessId));
      const provider = new ScriptedAiProvider({
        id: "scripted",
        model: "test",
        run: (request) => {
          const context = JSON.parse(request.input.context!);
          expect(context).toMatchObject({
            today: "2025-12-31",
            timeZone: "America/Guayaquil",
          });
          return aiRaw({
            lines: [
              {
                paidOn: context.today,
                amountMinor: "2000",
                category: "water",
                conceptId: null,
                conceptName: "Agua",
                name: "Pago de agua",
                isFixed: false,
                locationId: null,
                sourceText: "hoy pagué agua20",
              },
            ],
            unparsed: [],
          });
        },
      });
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-01-01T00:30:00.000Z"));
      try {
        expect(new Date().toISOString().slice(0, 10)).toBe("2026-01-01");
        const { draft } = await buildDraft(
          f.world.businessId,
          f.world.ownerId,
          { text: "hoy pagué agua20", locationId: null },
          provider,
        );
        const saved = await createExpenses(
          f.world.businessId,
          f.world.ownerId,
          {
            operationId: randomUUID(),
            expectedCurrencyCode: "USD",
            lines: draft.lines,
          },
        );
        const expense = saved.expenses[0];
        expect(expense).toMatchObject({
          paidOn: "2025-12-31",
          paymentTimeZone: "America/Guayaquil",
          amountMinor: "2000",
          isFixed: false,
          locationId: null,
        });
        const december = await listExpenses(
          f.world.businessId,
          new URLSearchParams("from=2025-12-01&to=2025-12-31"),
        );
        expect(december.map((e) => e.id)).toEqual([expense.id]);
        expect(
          await listExpenses(
            f.world.businessId,
            new URLSearchParams("from=2026-01-01&to=2026-01-31"),
          ),
        ).toEqual([]);
        expect((await f.eventsFor(expense.id))[0].payload).toMatchObject({
          paidOn: "2025-12-31",
          paymentTimeZone: "America/Guayaquil",
          amountMinor: "2000",
        });
      } finally {
        vi.useRealTimers();
      }
    });
  },
);
