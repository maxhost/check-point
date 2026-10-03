import { describe, expect, it, vi } from "vitest";
import { decideBudget } from "../wallet/push-budget";
import { BACKOFF_MS, COOLDOWN_MINUTES, COOLDOWN_MS } from "../wallet/push";
import { decideReminder } from "@mi-pasaporte/domain/server/wallet/reminder";
import { TEMPLATES } from "@mi-pasaporte/domain/server/marketing/templates";
import { CROSS_TEMPLATE } from "@mi-pasaporte/domain/server/marketing/cross-rules";
import { DEFAULT_PLACEMENT_LIMITS } from "@mi-pasaporte/domain/server/marketing/placement-plan";

/**
 * THE ORACLE OF «THE READER READS THE MODULE» (spec 0141 §3). The limits module is mocked
 * with SENTINEL values, all different from today's: a reader that kept a local copy of a
 * limit (with today's value) answers today's behavior and turns this red. The values
 * themselves are pinned by `limits.test.ts`.
 *
 * Budget sentinels are 1 counter / 2 with sound (not 1 / 1): with 1 / 1 no consistent budget
 * row (counter ≤ notifying) separates the counter cap from the total, so the counter would
 * be unwired-proof.
 */

const S = vi.hoisted(() => ({
  welcomeCap: { min: 2, max: 77, default: 9 },
  crossCap: { min: 3, max: 88, default: 11 },
  placement: {
    maxActiveTurns: 2,
    businessQuota: 7,
    minSeparationMeters: 123,
    holdoutRate: 0.5,
    cooldownDays: 4,
    utilitySlots: 1,
    windowDays: 2,
    maxSlots: 6,
    textCap: 33,
  },
}));

vi.mock("@mi-pasaporte/domain/server/notifications/limits", async (orig) => ({
  ...(await orig<object>()),
  COUNTER_NOTICES_PER_24H: 1,
  NOTIFYING_PER_24H: 2,
  COOLDOWN_MINUTES: 7,
  COOLDOWN_MS: 7 * 60 * 1000,
  // 13:00, exactly NOW in Guayaquil: the reminder is «too late» at the sentinel cutoff.
  REMINDER_CUTOFF_MINUTE: 13 * 60,
  WELCOME_MONTHLY_CAP: S.welcomeCap,
  CROSS_MONTHLY_CAP: S.crossCap,
  DEFAULT_PLACEMENT_LIMITS: S.placement,
}));

const NOW = new Date("2026-09-29T18:00:00Z");
const HOUR = 60 * 60 * 1000;
const oldest = new Date(NOW.getTime() - 5 * HOUR);

describe("decideBudget reads the module (sentinels: 1 counter, 2 with sound)", () => {
  it("the counter: after the first counter notice the next is suppressed", () => {
    // Today (2 / 3) this sends: 1 < 2 and 1 < 3.
    const b = {
      counterSent24h: 1,
      notifyingSent24h: 1,
      oldestNotifyingSentAt: oldest,
    };
    expect(decideBudget("transactional", b, NOW)).toEqual({
      kind: "suppress",
    });
  });

  it("the total: 2 sends with sound fill the window", () => {
    // Today this sends: counter 0 < 2 and 2 < 3. Only the total decides here.
    const b = {
      counterSent24h: 0,
      notifyingSent24h: 2,
      oldestNotifyingSentAt: oldest,
    };
    expect(decideBudget("transactional", b, NOW)).toEqual({
      kind: "suppress",
    });
    expect(decideBudget("reminder", b, NOW)).toEqual({ kind: "suppress" });
  });
});

describe("push.ts re-exports the module's cooldown", () => {
  it("COOLDOWN_MINUTES, COOLDOWN_MS and the backoff are the sentinel", () => {
    expect(COOLDOWN_MINUTES).toBe(7);
    expect(COOLDOWN_MS).toBe(7 * 60 * 1000);
    expect(BACKOFF_MS).toBe(7 * 60 * 1000);
  });
});

describe("decideReminder reads the module's cutoff", () => {
  it("at 13:00 local with a 13:00 cutoff it is too late", () => {
    // Today (cutoff 21:00) this sends `inactive_48h`.
    const decision = decideReminder(
      {
        timeZone: "America/Guayaquil",
        scanLocalMinutes: [],
        lastReminderAt: null,
        lastScanAt: null,
        lastOpenedAt: null,
        accountCreatedAt: new Date(NOW.getTime() - 10 * 24 * HOUR),
        openCoupons: [],
      },
      NOW,
    );
    expect(decision).toEqual({ kind: "skip", why: "too_late" });
  });
});

describe("the monthly caps of the catalog read the module", () => {
  it("«Bienvenida» in TEMPLATES exposes the sentinel cap", () => {
    const welcome = TEMPLATES.find((t) => t.key === "welcome");
    expect(welcome?.welcome?.monthlyCap).toEqual(S.welcomeCap);
  });

  it("«Oferta cruzada» exposes the sentinel cap", () => {
    expect(CROSS_TEMPLATE.cross?.monthlyCap).toEqual(S.crossCap);
  });
});

describe("placement-plan.ts re-exports the module's proximity limits", () => {
  it("DEFAULT_PLACEMENT_LIMITS is the sentinel", () => {
    expect(DEFAULT_PLACEMENT_LIMITS).toEqual(S.placement);
  });
});
