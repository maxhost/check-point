import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { and, eq } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import {
  analyticsMetricContributions as contributions,
  analyticsDimensionLabels as labels,
  locations,
} from "@mi-pasaporte/db/schema";
import {
  permisosIntegrationEnabled,
  seedOwnerDeNegocio,
  limpiarNegocios,
} from "../../permissions-integration-support";
import { readRecentMovements } from "./recent";
const a = randomUUID(),
  b = randomUUID(),
  ua = randomUUID(),
  ub = randomUUID(),
  la = randomUUID(),
  lb = randomUUID(),
  foreign = randomUUID(),
  concept = randomUUID();
const context = { today: "2026-10-18", currencyCode: "USD", minorUnit: 2 };
describe.skipIf(!permisosIntegrationEnabled)(
  "monthly movements real SQL isolation",
  () => {
    beforeAll(async () => {
      await seedOwnerDeNegocio(ua, a, `recent-a-${a}`);
      await seedOwnerDeNegocio(ub, b, `recent-b-${b}`);
      await getDb()
        .insert(locations)
        .values(
          [
            { id: la, businessId: a, name: "Centro" },
            { id: lb, businessId: a, name: "Norte" },
            { id: foreign, businessId: b, name: "Ajeno" },
          ].map((row) => ({
            ...row,
            addressLabel: row.name,
            countryCode: "EC",
            addressSnapshot: {},
          })),
        );
      await getDb()
        .insert(labels)
        .values([
          {
            businessId: a,
            kind: "concept",
            id: concept,
            label: "Alquiler",
            updatedAt: new Date(),
          },
          {
            businessId: b,
            kind: "concept",
            id: concept,
            label: "Privado ajeno",
            updatedAt: new Date(),
          },
        ]);
      const base = {
        businessId: a,
        sourceRevision: 1,
        locationId: la,
        day: "2026-10-18",
        metric: "revenue",
        dimensionKind: "none",
        dimensionId: null,
        currencyCode: "USD",
        minorUnit: 2,
        quantity: "0",
        count: 1,
      };
      await getDb()
        .insert(contributions)
        .values([
          { ...base, sourceKey: "z-current", amountMinor: 1000n },
          { ...base, sourceKey: "z-current", amountMinor: 500n },
          {
            ...base,
            sourceKey: "z-current",
            metric: "product_revenue",
            dimensionKind: "product",
            dimensionId: randomUUID(),
            amountMinor: 1500n,
          },
          {
            ...base,
            sourceKey: "y-expense",
            day: "2026-10-17",
            metric: "expense_fixed",
            dimensionKind: "concept",
            dimensionId: concept,
            amountMinor: 300n,
          },
          { ...base, sourceKey: "x-zero", day: "2026-10-16", amountMinor: 0n },
          {
            ...base,
            sourceKey: "w-negative",
            day: "2026-10-15",
            metric: "expense_variable",
            amountMinor: -200n,
          },
          {
            ...base,
            sourceKey: "v-fifth",
            day: "2026-10-14",
            amountMinor: 10n,
          },
          {
            ...base,
            sourceKey: "prior-month",
            day: "2026-09-30",
            amountMinor: 888n,
          },
          {
            ...base,
            sourceKey: "future",
            day: "2026-10-19",
            amountMinor: 888n,
          },
          {
            ...base,
            sourceKey: "wrong-currency",
            currencyCode: "EUR",
            amountMinor: 888n,
          },
          { ...base, sourceKey: "wrong-unit", minorUnit: 0, amountMinor: 888n },
          {
            ...base,
            sourceKey: "other-local",
            locationId: lb,
            amountMinor: 7777n,
          },
          {
            ...base,
            businessId: b,
            sourceKey: "foreign",
            locationId: foreign,
            metric: "expense_fixed",
            dimensionKind: "concept",
            dimensionId: concept,
            amountMinor: 999999n,
          },
        ]);
    }, 120000);
    afterAll(async () => {
      await limpiarNegocios([a, b], [ua, ub]);
    }, 120000);
    it("limits and groups current month operations without mixing tenant/local/currency or product rows", async () => {
      const rows = await readRecentMovements(a, context, la);
      expect(rows.map((r) => [r.date, r.kind, r.amountMinor])).toEqual([
        ["2026-10-18", "sale", 1500],
        ["2026-10-17", "expense", 300],
        ["2026-10-16", "sale", 0],
        ["2026-10-15", "expense", -200],
      ]);
      expect(rows[1]!.label).toBe("Alquiler");
      expect(new Set(rows.map((r) => r.id)).size).toBe(4);
      expect(JSON.stringify(rows)).not.toContain("Privado ajeno");
      expect(await readRecentMovements(a, context, foreign)).toEqual([]);
      expect(
        (await readRecentMovements(b, context, foreign)).map(
          (r) => r.amountMinor,
        ),
      ).toEqual([999999]);
      expect(
        (await readRecentMovements(a, context)).some(
          (r) => r.amountMinor === 7777,
        ),
      ).toBe(true);
    });
    it("does not show a removed source contribution", async () => {
      await getDb()
        .delete(contributions)
        .where(
          and(
            eq(contributions.businessId, a),
            eq(contributions.sourceKey, "z-current"),
          ),
        );
      expect(
        (await readRecentMovements(a, context, la)).some(
          (r) => r.amountMinor === 1500,
        ),
      ).toBe(false);
    });
  },
);
