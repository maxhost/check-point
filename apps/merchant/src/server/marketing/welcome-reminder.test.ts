import { describe, expect, it } from "vitest";
import {
  type ReminderFacts,
  decideReminderGate,
  reminderBody,
  reminderDaysLeft,
  reminderDueAt,
} from "@mi-pasaporte/domain/server/marketing/welcome-reminder";

/** The PURE half of the welcome expiry notice (spec 0107 §5). Guayaquil, hours 9–21. */
const NOON = new Date("2026-10-14T17:00:00.000Z"); // 12:00 local
const facts = (over: Partial<ReminderFacts> = {}): ReminderFacts => ({
  redeemed: false,
  validUntil: new Date("2026-10-17T02:00:00.000Z"),
  membershipExists: true,
  optedOut: false,
  timeZone: "America/Guayaquil",
  windowStart: 9,
  windowEnd: 21,
  ...over,
});

describe("decideReminderGate", () => {
  it("sends with no click id when nothing stops it", () => {
    expect(decideReminderGate(facts(), NOON)).toEqual({ kind: "send" });
  });

  it("ORACULO DE M10: a redeemed coupon cancels, before anything else", () => {
    expect(
      decideReminderGate(facts({ redeemed: true, optedOut: true }), NOON),
    ).toEqual({ kind: "cancel", reason: "redeemed" });
  });

  it("expired, membership gone, opt-out cancel, in that order", () => {
    expect(
      decideReminderGate(facts({ validUntil: NOON, optedOut: true }), NOON),
    ).toEqual({ kind: "cancel", reason: "expired" });
    expect(
      decideReminderGate(
        facts({ membershipExists: false, optedOut: true }),
        NOON,
      ),
    ).toEqual({ kind: "cancel", reason: "membership_gone" });
    expect(decideReminderGate(facts({ optedOut: true }), NOON)).toEqual({
      kind: "cancel",
      reason: "opt_out",
    });
  });

  it("outside the hours reschedules to the next opening (9:00 local = 14:00Z)", () => {
    expect(
      decideReminderGate(facts(), new Date("2026-10-14T03:00:00.000Z")),
    ).toEqual({
      kind: "reschedule",
      notBefore: new Date("2026-10-14T14:00:00.000Z"),
    });
  });
});

describe("the moment and the text of the notice", () => {
  it("is due reminder_days BEFORE valid_until", () => {
    expect(
      reminderDueAt(new Date("2026-10-17T02:00:00.000Z"), 3).toISOString(),
    ).toBe("2026-10-14T02:00:00.000Z");
  });

  it("counts whole days left, rounded up, at least 1", () => {
    const until = new Date("2026-10-17T02:00:00.000Z");
    expect(reminderDaysLeft(until, new Date("2026-10-14T15:00:00.000Z"))).toBe(
      3,
    );
    expect(reminderDaysLeft(until, new Date("2026-10-14T02:00:00.000Z"))).toBe(
      3,
    );
    expect(reminderDaysLeft(until, new Date("2026-10-17T01:00:00.000Z"))).toBe(
      1,
    );
    expect(reminderBody(3)).toBe("Tu regalo de bienvenida vence en 3 días");
    expect(reminderBody(1)).toBe("Tu regalo de bienvenida vence en 1 día");
  });
});
