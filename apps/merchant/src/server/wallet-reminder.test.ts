import { describe, expect, it } from "vitest";
import {
  DEFAULT_REMINDER_MINUTE,
  REMINDER_BODIES,
  type ReminderInput,
  decideReminder,
  localMinuteOfDay,
  reminderTargetMinute,
} from "./wallet/reminder";

/**
 * The day-without-purchase reminder (spec 0111 D6), pure: the target time and the four
 * conditions of the table, one failing row each, plus the three reasons and their order.
 * The planner that turns a `send` into ONE queue row is `wallet-reminder.neon.integration`.
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
/** 13:00 in Guayaquil (UTC−5): past the default 12:30 target. */
const NOW = new Date("2026-09-29T18:00:00Z");
const ZONE = "America/Guayaquil";

function input(over: Partial<ReminderInput> = {}): ReminderInput {
  return {
    timeZone: ZONE,
    scanLocalMinutes: [],
    lastReminderAt: null,
    lastScanAt: null,
    lastOpenedAt: null,
    accountCreatedAt: new Date(NOW.getTime() - 10 * DAY),
    openCoupons: [],
    ...over,
  };
}

const ago = (ms: number) => new Date(NOW.getTime() - ms);
const ahead = (ms: number) => new Date(NOW.getTime() + ms);

describe("reminderTargetMinute", () => {
  it("12:30 with 0 scans", () => {
    expect(reminderTargetMinute([])).toBe(750);
    expect(DEFAULT_REMINDER_MINUTE).toBe(750);
  });

  it("12:30 with 2 scans (not enough history)", () => {
    expect(reminderTargetMinute([600, 610])).toBe(750);
  });

  it("with 3 scans: the median minus 30 minutes", () => {
    // median of 600, 900, 1000 is 900 (15:00) → 14:30
    expect(reminderTargetMinute([1000, 600, 900])).toBe(870);
  });

  it("an even count averages the two middle scans", () => {
    // sorted 600, 700, 800, 1000 → median 750 → 720
    expect(reminderTargetMinute([800, 1000, 600, 700])).toBe(720);
  });

  it("clamped to 9:00 at the bottom", () => {
    expect(reminderTargetMinute([400, 420, 450])).toBe(540);
  });

  it("clamped to 20:30 at the top (30 min before the 21:00 cutoff)", () => {
    expect(reminderTargetMinute([1400, 1410, 1420])).toBe(1230);
  });
});

describe("localMinuteOfDay", () => {
  it("reads the minute in the given zone (h23)", () => {
    expect(localMinuteOfDay(NOW, ZONE)).toBe(13 * 60);
    expect(localMinuteOfDay(new Date("2026-09-30T05:05:00Z"), ZONE)).toBe(5);
  });
});

describe("decideReminder — each condition of the table, failing alone", () => {
  it("CONTROL: an inactive consumer with nothing else is a send (inactive_48h)", () => {
    expect(decideReminder(input(), NOW)).toEqual({
      kind: "send",
      reason: "inactive_48h",
    });
  });

  it("1 — before the target time: not_yet", () => {
    const early = new Date("2026-09-29T17:29:00Z"); // 12:29 local
    expect(decideReminder(input(), early)).toEqual({
      kind: "skip",
      why: "not_yet",
    });
    const onTime = new Date("2026-09-29T17:30:00Z"); // 12:30 local
    expect(decideReminder(input(), onTime).kind).toBe("send");
  });

  it("1 — at or after 21:00 local: too_late (owner, 2026-09-29)", () => {
    const lastMinute = new Date("2026-09-30T01:59:00Z"); // 20:59 local
    expect(decideReminder(input(), lastMinute).kind).toBe("send");
    const cutoff = new Date("2026-09-30T02:00:00Z"); // 21:00 local
    expect(decideReminder(input(), cutoff)).toEqual({
      kind: "skip",
      why: "too_late",
    });
    const late = new Date("2026-09-30T04:00:00Z"); // 23:00 local
    expect(decideReminder(input(), late)).toEqual({
      kind: "skip",
      why: "too_late",
    });
  });

  it("1 — the target follows the consumer's habit", () => {
    // median 16:00 → target 15:30; at 13:00 it is not yet.
    const habit = input({ scanLocalMinutes: [960, 960, 960] });
    expect(decideReminder(habit, NOW)).toEqual({
      kind: "skip",
      why: "not_yet",
    });
  });

  it("2 — a reminder created in the last 20 h (any status): already", () => {
    expect(
      decideReminder(input({ lastReminderAt: ago(19 * HOUR) }), NOW),
    ).toEqual({ kind: "skip", why: "already" });
    expect(
      decideReminder(input({ lastReminderAt: ago(21 * HOUR) }), NOW).kind,
    ).toBe("send");
  });

  // ORACULO DE M5 (unit half).
  it("3 — a scan in the last 24 h (a day WITH purchase): scanned", () => {
    const withCoupon = input({
      lastScanAt: ago(2 * HOUR),
      openCoupons: [{ createdAt: ago(HOUR), validUntil: ahead(10 * DAY) }],
    });
    expect(decideReminder(withCoupon, NOW)).toEqual({
      kind: "skip",
      why: "scanned",
    });
    expect(
      decideReminder(input({ lastScanAt: ago(25 * HOUR) }), NOW).kind,
    ).toBe("skip"); // 25 h ago: not «scanned», and < 48 h inactive → nothing
    expect(decideReminder(input({ lastScanAt: ago(25 * HOUR) }), NOW)).toEqual({
      kind: "skip",
      why: "nothing",
    });
  });

  it("4 — nothing new and active in the last 48 h: nothing", () => {
    expect(decideReminder(input({ lastOpenedAt: ago(1 * HOUR) }), NOW)).toEqual(
      { kind: "skip", why: "nothing" },
    );
    // A brand-new account is not «inactive» either.
    expect(
      decideReminder(input({ accountCreatedAt: ago(47 * HOUR) }), NOW),
    ).toEqual({ kind: "skip", why: "nothing" });
  });
});

describe("decideReminder — the three reasons and their priority", () => {
  it("coupon_new: a live coupon created after the last open", () => {
    const d = decideReminder(
      input({
        lastOpenedAt: ago(3 * HOUR),
        openCoupons: [{ createdAt: ago(HOUR), validUntil: ahead(10 * DAY) }],
      }),
      NOW,
    );
    expect(d).toEqual({ kind: "send", reason: "coupon_new" });
  });

  it("a coupon already seen (created before the last open) is not new", () => {
    const d = decideReminder(
      input({
        lastOpenedAt: ago(HOUR),
        openCoupons: [
          { createdAt: ago(3 * HOUR), validUntil: ahead(10 * DAY) },
        ],
      }),
      NOW,
    );
    expect(d).toEqual({ kind: "skip", why: "nothing" });
  });

  it("coupon_expiring: unredeemed and valid_until within 48 h", () => {
    const d = decideReminder(
      input({
        lastOpenedAt: ago(HOUR),
        openCoupons: [
          { createdAt: ago(5 * DAY), validUntil: ahead(47 * HOUR) },
        ],
      }),
      NOW,
    );
    expect(d).toEqual({ kind: "send", reason: "coupon_expiring" });
  });

  it("an expired coupon is neither new nor expiring", () => {
    const d = decideReminder(
      input({
        lastOpenedAt: ago(HOUR),
        openCoupons: [{ createdAt: ago(30 * HOUR), validUntil: ago(1) }],
      }),
      NOW,
    );
    expect(d).toEqual({ kind: "skip", why: "nothing" });
  });

  it("priority: coupon_expiring > coupon_new > inactive_48h", () => {
    const all = input({
      openCoupons: [
        { createdAt: ago(HOUR), validUntil: ahead(10 * DAY) },
        { createdAt: ago(5 * DAY), validUntil: ahead(HOUR) },
      ],
    });
    expect(decideReminder(all, NOW)).toEqual({
      kind: "send",
      reason: "coupon_expiring",
    });
    const newAndInactive = input({
      openCoupons: [{ createdAt: ago(HOUR), validUntil: ahead(10 * DAY) }],
    });
    expect(decideReminder(newAndInactive, NOW)).toEqual({
      kind: "send",
      reason: "coupon_new",
    });
  });
});

describe("reminder texts", () => {
  it("each body ends in the invite and is ≤ 80 characters", () => {
    for (const body of Object.values(REMINDER_BODIES)) {
      expect(body.endsWith("· Revisa tus beneficios en checkpass.club")).toBe(
        true,
      );
      expect([...body].length).toBeLessThanOrEqual(80);
    }
    expect(REMINDER_BODIES.coupon_expiring).toBe(
      "Tienes un cupón que vence pronto · Revisa tus beneficios en checkpass.club",
    );
  });
});
