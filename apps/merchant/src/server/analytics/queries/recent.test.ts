import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { recentMovementFromRow, recentMovementsStatement } from "./recent";
describe("monthly movements query contract", () => {
  it("binds guarded business, local month, currency and selected location, with a fixed bound", () => {
    const q = new PgDialect().sqlToQuery(
      recentMovementsStatement(
        "guarded",
        { today: "2026-10-18", currencyCode: "USD", minorUnit: 2 },
        "selected",
      ),
    );
    expect(q.params).toEqual([
      "guarded",
      "2026-10-18",
      "2026-10-18",
      "USD",
      2,
      "selected",
    ]);
    expect(q.sql).toContain("c.business_id=");
    expect(q.sql).toContain("l.business_id=c.business_id");
    expect(q.sql).toContain("c.location_id=");
    expect(q.sql).toContain("limit 4");
    expect(q.sql).toContain(
      "group by c.source_key,c.day,c.location_id,c.metric",
    );
    expect(q.sql).toContain("order by c.day desc,c.source_key desc");
  });
  it.each(["0", "-125", "9007199254740991"])(
    "preserves exact signed amount %s and exposes only display fields",
    (amount) => {
      expect(
        recentMovementFromRow({
          id: "stable",
          date: "2026-10-18",
          kind: "expense",
          label: "Servicios",
          amountMinor: amount,
          sourceKey: "private",
          customer: "private",
        }),
      ).toEqual({
        id: "stable",
        date: "2026-10-18",
        kind: "expense",
        label: "Servicios",
        amountMinor: Number(amount),
      });
    },
  );
  it("rejects overflow and unrecognized kinds", () => {
    expect(() =>
      recentMovementFromRow({ kind: "sale", amountMinor: "9007199254740992" }),
    ).toThrow();
    expect(() =>
      recentMovementFromRow({ kind: "customer", amountMinor: "1" }),
    ).toThrow();
  });
});
