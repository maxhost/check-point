import { describe, expect, it, vi } from "vitest";
import {
  addMonths,
  expiresOn,
  localDate,
  nextSince,
  noticeDue,
  shouldExpire,
} from "@mi-pasaporte/domain/server/loyalty-program/balance-expiry";
import { buildExpiryBody } from "@mi-pasaporte/domain/server/wallet/push-text";

/**
 * Spec 0195 §D2 / ADR 0136 — the pure balance-expiry rule, and the validation of
 * `PUT /api/loyalty-program/expiry` (it rejects before touching the base).
 */

vi.mock("./api-permission", () => ({
  requireApiPermissionSinGateDeEmail: async () => ({
    business: { id: "b-1", status: "active" },
    userId: "u-1",
  }),
}));

const TZ = "America/Guayaquil";

describe("addMonths / localDate", () => {
  it("clamps to the end of the month, leap years included", () => {
    expect(addMonths("2027-01-31", 1)).toBe("2027-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-10-10", 6)).toBe("2027-04-10");
    expect(addMonths("2026-11-30", 3)).toBe("2027-02-28");
  });

  it("uses the business zone, not UTC (02:00 UTC is still yesterday in Ecuador)", () => {
    expect(localDate(new Date("2026-10-11T02:00:00Z"), TZ)).toBe("2026-10-10");
  });
});

describe("expiresOn", () => {
  const since = new Date("2026-10-10T15:00:00Z");
  it("counts from the last visit when it is after `since`", () => {
    expect(
      expiresOn({
        lastVisitAt: new Date("2026-12-01T15:00:00Z"),
        enrolledAt: new Date("2026-01-01T15:00:00Z"),
        since,
        months: 6,
        timezone: TZ,
      }),
    ).toBe("2027-06-01");
  });

  it("never before `since`: a visit a year earlier counts from the day the rule was turned on", () => {
    expect(
      expiresOn({
        lastVisitAt: new Date("2025-10-01T15:00:00Z"),
        enrolledAt: new Date("2025-01-01T15:00:00Z"),
        since,
        months: 3,
        timezone: TZ,
      }),
    ).toBe("2027-01-10");
  });

  it("falls back to the enrollment when the consumer never came", () => {
    expect(
      expiresOn({
        lastVisitAt: null,
        enrolledAt: new Date("2026-11-05T15:00:00Z"),
        since,
        months: 12,
        timezone: TZ,
      }),
    ).toBe("2027-11-05");
  });
});

describe("noticeDue", () => {
  const expiry = "2027-04-30";
  const today = (daysLeft: number) => addDays(expiry, -daysLeft);
  it.each([
    [21, null],
    [20, 20],
    [11, 20],
    [10, 10],
    [6, 10],
    [5, 5],
    [1, 5],
    [0, 0],
    [-3, 0],
  ])("%i days left → %s", (daysLeft, due) => {
    expect(
      noticeDue({ today: today(daysLeft), expiresOn: expiry, sent: [] }),
    ).toBe(due);
  });

  it("never repeats a threshold already issued for this date (a late cron sends one, not a burst)", () => {
    expect(
      noticeDue({ today: today(4), expiresOn: expiry, sent: [5] }),
    ).toBeNull();
    expect(
      noticeDue({ today: today(4), expiresOn: expiry, sent: [20, 10] }),
    ).toBe(5);
  });
});

describe("shouldExpire", () => {
  it("needs the day to have ended AND the «hoy vencen» notice issued on an earlier day", () => {
    const base = { today: "2027-05-01", expiresOn: "2027-04-30" };
    expect(shouldExpire({ ...base, zeroNoticeOn: "2027-04-30" })).toBe(true);
    expect(shouldExpire({ ...base, zeroNoticeOn: null })).toBe(false);
    expect(shouldExpire({ ...base, zeroNoticeOn: "2027-05-01" })).toBe(false);
    expect(
      shouldExpire({
        today: "2027-04-30",
        expiresOn: "2027-04-30",
        zeroNoticeOn: "2027-04-30",
      }),
    ).toBe(false);
  });
});

describe("nextSince", () => {
  const now = new Date("2026-10-10T15:00:00Z");
  const old = new Date("2026-01-01T15:00:00Z");
  it("on / shorter → now; longer → keeps; off → null", () => {
    expect(
      nextSince({ prevMonths: null, nextMonths: 6, since: null, now }),
    ).toBe(now);
    expect(nextSince({ prevMonths: 12, nextMonths: 6, since: old, now })).toBe(
      now,
    );
    expect(nextSince({ prevMonths: 6, nextMonths: 12, since: old, now })).toBe(
      old,
    );
    expect(
      nextSince({ prevMonths: 6, nextMonths: null, since: old, now }),
    ).toBeNull();
  });
});

describe("buildExpiryBody", () => {
  it("writes the days, the units and the day-of wording", () => {
    expect(buildExpiryBody(120, "points", 20)).toContain(
      "Tus 120 puntos vencen en 20 días si no compras antes",
    );
    expect(buildExpiryBody(1, "stamps", 0)).toContain(
      "Hoy vence tu 1 sello. Pasa hoy y no lo pierdas",
    );
  });
});

describe("PUT /api/loyalty-program/expiry — validation", () => {
  const put = async (body: string) => {
    const { PUT } = await import("../app/api/loyalty-program/expiry/route");
    return PUT(
      new Request("http://x/api/loyalty-program/expiry", {
        method: "PUT",
        body,
      }),
    );
  };

  it.each([["1"], ["7"], ['"6"'], ["true"]])(
    "months=%s → 400 invalid_expiry",
    async (value) => {
      const response = await put(`{"months":${value}}`);
      expect(response.status).toBe(400);
      expect((await response.json()).code).toBe("invalid_expiry");
    },
  );

  it("no months key → 400 invalid_expiry; not JSON → 400 invalid_body", async () => {
    expect((await (await put("{}")).json()).code).toBe("invalid_expiry");
    const bad = await put("nope");
    expect(bad.status).toBe(400);
    expect((await bad.json()).code).toBe("invalid_body");
  });
});

function addDays(day: string, days: number): string {
  const at = new Date(`${day}T12:00:00Z`);
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
}
