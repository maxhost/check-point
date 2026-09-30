import { describe, expect, it } from "vitest";
import { decideCrossOffer } from "./cross-rules";
import {
  CAFE,
  DAY,
  GYM,
  NOW,
  ORIGIN,
  facts,
  member,
  north,
  offer,
  position,
} from "./cross-rules-fixtures";

/**
 * The PURE rules of «Oferta cruzada», reasons 4–7 (spec 0112 «Elegibilidad»): the audience
 * (`dormant` exactly at `now - dormantDays` is in), the opt-out, one per consumer, the cap —
 * and that the reason is the FIRST that applies. Reasons 1–3 are in `cross-rules.test.ts`.
 */

describe("decideCrossOffer — audience, opt-out, claimed, cap", () => {
  it("4. audience non_members — a member of the business is out", () => {
    expect(decideCrossOffer(facts({ membership: member(200) }))).toEqual({
      ok: false,
      reason: "audience",
    });
  });

  it("4. audience dormant — a non-member is out; a member is in exactly at now - dormantDays and out a second later", () => {
    const dormant = offer({ audience: "dormant", dormantDays: 30 });
    expect(decideCrossOffer(facts({ offer: dormant }))).toEqual({
      ok: false,
      reason: "audience",
    });
    expect(
      decideCrossOffer(facts({ offer: dormant, membership: member(30) })).ok,
    ).toBe(true);
    expect(
      decideCrossOffer(
        facts({
          offer: dormant,
          membership: {
            ...member(null),
            lastOrderAt: new Date(NOW.getTime() - 30 * DAY + 1000),
          },
        }),
      ),
    ).toEqual({ ok: false, reason: "audience" });
    expect(
      decideCrossOffer(facts({ offer: dormant, membership: member(5) })),
    ).toEqual({ ok: false, reason: "audience" });
    // Enrolled recently and never bought: the enrolment is what has to be old enough.
    expect(
      decideCrossOffer(
        facts({
          offer: dormant,
          membership: {
            enrolledAt: new Date(NOW.getTime() - 5 * DAY),
            lastOrderAt: null,
            optedOut: false,
          },
        }),
      ),
    ).toEqual({ ok: false, reason: "audience" });
  });

  it("4. audience any — member or not", () => {
    const any = offer({ audience: "any" });
    expect(decideCrossOffer(facts({ offer: any })).ok).toBe(true);
    expect(
      decideCrossOffer(facts({ offer: any, membership: member(1) })).ok,
    ).toBe(true);
  });

  it("5. opt_out — the promotions of the business are off", () => {
    expect(
      decideCrossOffer(
        facts({
          offer: offer({ audience: "any" }),
          membership: { ...member(1), optedOut: true },
        }),
      ),
    ).toEqual({ ok: false, reason: "opt_out" });
  });

  it("6. claimed — one per consumer and campaign", () => {
    expect(decideCrossOffer(facts({ claimed: true }))).toEqual({
      ok: false,
      reason: "claimed",
    });
  });

  it("7. cap_reached — the cap is strict: cap N gives N", () => {
    expect(
      decideCrossOffer(
        facts({ offer: offer({ monthlyCap: 3 }), claimedThisMonth: 2 }),
      ).ok,
    ).toBe(true);
    expect(
      decideCrossOffer(
        facts({ offer: offer({ monthlyCap: 3 }), claimedThisMonth: 3 }),
      ),
    ).toEqual({ ok: false, reason: "cap_reached" });
  });

  it("the reason is the FIRST that applies, in the spec's order", () => {
    const everything = facts({
      position: position({ lastScanCategory: GYM }),
      offer: offer({ locations: [north(ORIGIN, 5000)], monthlyCap: 1 }),
      membership: { ...member(1), optedOut: true },
      claimed: true,
      claimedThisMonth: 9,
    });
    expect(decideCrossOffer(everything)).toEqual({
      ok: false,
      reason: "same_category",
    });
    expect(
      decideCrossOffer({
        ...everything,
        position: position({ lastScanCategory: CAFE }),
      }),
    ).toEqual({ ok: false, reason: "too_far" });
    const near = offer({ locations: [north(ORIGIN, 100)], monthlyCap: 1 });
    expect(
      decideCrossOffer({
        ...everything,
        position: position(),
        offer: near,
      }),
    ).toEqual({ ok: false, reason: "audience" });
    expect(
      decideCrossOffer({
        ...everything,
        position: position(),
        offer: { ...near, audience: "any" },
      }),
    ).toEqual({ ok: false, reason: "opt_out" });
    expect(
      decideCrossOffer({
        ...everything,
        position: position(),
        offer: { ...near, audience: "any" },
        membership: member(1),
      }),
    ).toEqual({ ok: false, reason: "claimed" });
  });
});
