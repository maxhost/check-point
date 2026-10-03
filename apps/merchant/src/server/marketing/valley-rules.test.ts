import { describe, expect, it } from "vitest";
import { campaignKindEnabled } from "@mi-pasaporte/domain/server/marketing/enabled-campaigns";
import { decideCrossOffer } from "@mi-pasaporte/domain/server/marketing/cross-rules";
import { facts, member, offer } from "./cross-rules-fixtures";
import {
  effectiveWindows,
  localClock,
  openWindow,
  windowEndsAt,
} from "@mi-pasaporte/domain/server/marketing/valley-rules";

/**
 * Spec 0113 — the PURE rules of «Horas valle» that decide in time, and its audience
 * (`not_active`, resolved by the cross offer's `decideCrossOffer`). Every clock is
 * INJECTED: an instant plus the business's zone, never the real hour.
 */

const BA = "America/Argentina/Buenos_Aires"; // UTC-3, no DST
const NY = "America/New_York"; // DST

/** Tuesday 2026-10-06 in Buenos Aires. */
const tuesdayAt = (hh: string) => new Date(`2026-10-06T${hh}:00-03:00`);
const WINDOW = { weekday: 2, startHour: 15, endHour: 17 };

describe.skipIf(!campaignKindEnabled("valley"))(
  "valley rules — the window in the business's time",
  () => {
    it("the local clock reads the zone's weekday and hour", () => {
      expect(localClock(tuesdayAt("15:10"), BA)).toEqual({
        year: 2026,
        month: 10,
        day: 6,
        weekday: 2,
        hour: 15,
      });
      // 01:30 UTC of Wednesday is still Tuesday 22:30 in Buenos Aires.
      expect(localClock(new Date("2026-10-07T01:30:00Z"), BA)).toMatchObject({
        weekday: 2,
        hour: 22,
      });
    });

    it("a window is OPEN from start_hour and CLOSED at end_hour", () => {
      const at = (hh: string) =>
        openWindow([WINDOW], localClock(tuesdayAt(hh), BA));
      expect(at("14:59")).toBeNull();
      expect(at("15:00")).toEqual(WINDOW);
      expect(at("16:59")).toEqual(WINDOW);
      expect(at("17:00")).toBeNull();
      // Another weekday at the same hour: closed.
      expect(
        openWindow(
          [WINDOW],
          localClock(new Date("2026-10-07T15:30:00-03:00"), BA),
        ),
      ).toBeNull();
    });

    it("valid_until = today's close of the window: UTC-3", () => {
      const clock = localClock(tuesdayAt("15:10"), BA);
      expect(windowEndsAt(clock, WINDOW, BA).toISOString()).toBe(
        "2026-10-06T20:00:00.000Z",
      );
      // A window to 24 closes at the next local midnight.
      expect(
        windowEndsAt(clock, { ...WINDOW, endHour: 24 }, BA).toISOString(),
      ).toBe("2026-10-07T03:00:00.000Z");
    });

    it("valid_until in a zone with DST: summer and winter offsets, and the change day", () => {
      const july = new Date("2026-07-14T19:10:00Z"); // 15:10 EDT (UTC-4)
      expect(
        windowEndsAt(
          localClock(july, NY),
          { ...WINDOW, weekday: 2 },
          NY,
        ).toISOString(),
      ).toBe("2026-07-14T21:00:00.000Z");
      const january = new Date("2026-01-13T20:10:00Z"); // 15:10 EST (UTC-5)
      expect(
        windowEndsAt(
          localClock(january, NY),
          { ...WINDOW, weekday: 2 },
          NY,
        ).toISOString(),
      ).toBe("2026-01-13T22:00:00.000Z");
      // 2026-03-08: at 02:00 EST the clock jumps to 03:00 EDT. A 0–4 window claimed at
      // 01:30 EST closes at 04:00 EDT = 08:00Z (not 09:00Z, the EST reading).
      const change = new Date("2026-03-08T06:30:00Z");
      const clock = localClock(change, NY);
      expect(clock).toMatchObject({ weekday: 7, hour: 1 });
      expect(
        windowEndsAt(
          clock,
          { weekday: 7, startHour: 0, endHour: 4 },
          NY,
        ).toISOString(),
      ).toBe("2026-03-08T08:00:00.000Z");
    });

    it("the merchant's windows rule while they exist; else the network's", () => {
      const network = {
        weekday: 1,
        startHour: 10,
        endHour: 11,
        source: "network" as const,
      };
      const own = {
        weekday: 3,
        startHour: 16,
        endHour: 18,
        source: "merchant" as const,
      };
      expect(effectiveWindows([network, own])).toEqual({
        effective: "merchant",
        windows: [{ weekday: 3, startHour: 16, endHour: 18 }],
      });
      expect(effectiveWindows([network])).toEqual({
        effective: "network",
        windows: [{ weekday: 1, startHour: 10, endHour: 11 }],
      });
      expect(effectiveWindows([])).toEqual({
        effective: "network",
        windows: [],
      });
    });
  },
);

describe.skipIf(!campaignKindEnabled("valley"))(
  "decideCrossOffer — the valley audience `not_active`",
  () => {
    const valley = offer({ audience: "not_active", dormantDays: 30 });

    it("a non-member is in", () => {
      expect(decideCrossOffer(facts({ offer: valley })).ok).toBe(true);
    });

    it("an ACTIVE member (an order 3 days ago) is out", () => {
      expect(
        decideCrossOffer(facts({ offer: valley, membership: member(3) })),
      ).toEqual({ ok: false, reason: "audience" });
    });

    it("a DORMANT member (no order for dormantDays) is in", () => {
      expect(
        decideCrossOffer(facts({ offer: valley, membership: member(30) })).ok,
      ).toBe(true);
      expect(
        decideCrossOffer(facts({ offer: valley, membership: member(null) })).ok,
      ).toBe(true);
    });
  },
);
