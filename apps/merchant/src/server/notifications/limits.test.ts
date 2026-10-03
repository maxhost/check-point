import { describe, expect, it } from "vitest";
import {
  BUDGET_WINDOW_MS,
  COOLDOWN_MINUTES,
  COOLDOWN_MS,
  COUNTER_NOTICES_PER_24H,
  CROSS_LOTTERY_BEHIND_MAX,
  CROSS_LOTTERY_BEHIND_MIN,
  CROSS_LOTTERY_DECAY_METERS,
  CROSS_LOTTERY_EPSILON,
  CROSS_LOTTERY_NEW_CUSTOMER_BONUS,
  CROSS_LOTTERY_POLICY,
  CROSS_MONTHLY_CAP,
  DEFAULT_PLACEMENT_LIMITS,
  NOTIFYING_PER_24H,
  REMINDER_CUTOFF_MINUTE,
  REMINDER_EARLIEST_MINUTE,
  REMINDER_LATEST_MINUTE,
  REMINDER_SPACING_MS,
  VALLEY_MONTHLY_CAP,
  WELCOME_MONTHLY_CAP,
} from "@mi-pasaporte/domain/server/notifications/limits";

/**
 * THE ORACLE OF «THE VALUES OF TODAY» (spec 0141 / ADR 0115 §5). Every limit against its
 * LITERAL, never against another constant: a test that imports the constant it checks does
 * not see a change of value. Changing a limit means changing it in `limits.ts` AND here —
 * this test goes red on purpose. (It lives in `apps/merchant` because no vitest project
 * runs tests under `packages/`.)
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

describe("notification limits — the values of today", () => {
  it("24 h budget: 2 counter notices, 3 with sound, a 24 h window", () => {
    expect(COUNTER_NOTICES_PER_24H).toBe(2);
    expect(NOTIFYING_PER_24H).toBe(3);
    expect(BUDGET_WINDOW_MS).toBe(24 * HOUR);
  });

  it("3 minutes between two pushes to the same consumer", () => {
    expect(COOLDOWN_MINUTES).toBe(3);
    expect(COOLDOWN_MS).toBe(3 * MINUTE);
  });

  it("reminder: cutoff 21:00, clamp [9:00, 20:30], one every 20 h", () => {
    expect(REMINDER_CUTOFF_MINUTE).toBe(21 * 60);
    expect(REMINDER_EARLIEST_MINUTE).toBe(9 * 60);
    expect(REMINDER_LATEST_MINUTE).toBe(20 * 60 + 30);
    expect(REMINDER_SPACING_MS).toBe(20 * HOUR);
  });

  it("monthly caps: 1–10000, default 50, for welcome, cross and valley", () => {
    expect(WELCOME_MONTHLY_CAP).toEqual({ min: 1, max: 10000, default: 50 });
    expect(CROSS_MONTHLY_CAP).toEqual({ min: 1, max: 10000, default: 50 });
    expect(VALLEY_MONTHLY_CAP).toEqual({ min: 1, max: 10000, default: 50 });
  });

  it("cross sale lottery (spec 0143): ε 20 %, 1 km decay, behind in [0.5, 2], bonus 1.5, h4-v1", () => {
    expect(CROSS_LOTTERY_EPSILON).toBe(0.2);
    expect(CROSS_LOTTERY_DECAY_METERS).toBe(1000);
    expect(CROSS_LOTTERY_BEHIND_MIN).toBe(0.5);
    expect(CROSS_LOTTERY_BEHIND_MAX).toBe(2);
    expect(CROSS_LOTTERY_NEW_CUSTOMER_BONUS).toBe(1.5);
    expect(CROSS_LOTTERY_POLICY).toBe("h4-v1");
  });

  it("proximity: the placement defaults, field by field", () => {
    expect(DEFAULT_PLACEMENT_LIMITS).toEqual({
      maxActiveTurns: 5,
      businessQuota: 50,
      minSeparationMeters: 400,
      holdoutRate: 0.1,
      cooldownDays: 30,
      utilitySlots: 3,
      windowDays: 5,
      maxSlots: 10,
      textCap: 120,
    });
  });
});
