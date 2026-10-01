import { describe, expect, it } from "vitest";
import {
  type GateFacts,
  decideCampaignGate,
} from "@mi-pasaporte/domain/server/marketing/push-delivery";

/** Spec 0103 §6 — the gate's decision, PURE and in the spec's order. The wiring (the
 * worker calling it) is pinned by `marketing-push-delivery.neon.integration.test.ts`. */
const NOON_AR = new Date("2026-09-26T15:00:00.000Z"); // 12:00 in Buenos Aires

const facts = (over: Partial<GateFacts> = {}): GateFacts => ({
  pushId: "p-1",
  campaignStatus: "active",
  endsAt: null,
  membershipExists: true,
  optedOut: false,
  visitedSinceDecision: false,
  timeZone: "America/Argentina/Buenos_Aires",
  windowStart: 9,
  windowEnd: 21,
  ...over,
});

describe("decideCampaignGate", () => {
  it("everything in order sends with the push id as click id; an orphan row sends without", () => {
    expect(decideCampaignGate(facts(), NOON_AR)).toEqual({
      kind: "send",
      clickId: "p-1",
    });
    expect(decideCampaignGate(null, NOON_AR)).toEqual({ kind: "send" });
  });

  it("cancels, first reason wins: inactive/expired → membership → opt-out → visited", () => {
    const all = {
      campaignStatus: "paused",
      membershipExists: false,
      optedOut: true,
      visitedSinceDecision: true,
    };
    const reason = (over: Partial<GateFacts>) => {
      const gate = decideCampaignGate(facts(over), NOON_AR);
      return gate.kind === "cancel" ? gate.reason : gate.kind;
    };
    expect(reason(all)).toBe("campaign_inactive");
    expect(reason({ endsAt: NOON_AR })).toBe("campaign_inactive");
    expect(reason({ ...all, campaignStatus: "active" })).toBe(
      "membership_gone",
    );
    expect(
      reason({ ...all, campaignStatus: "active", membershipExists: true }),
    ).toBe("opt_out");
    expect(reason({ visitedSinceDecision: true })).toBe("visited");
  });

  it("outside the window it reschedules to the next opening instead of sending", () => {
    // 22:00 in Buenos Aires = 01:00Z of the 27th → 09:00 local = 12:00Z.
    expect(
      decideCampaignGate(facts(), new Date("2026-09-27T01:00:00.000Z")),
    ).toEqual({
      kind: "reschedule",
      notBefore: new Date("2026-09-27T12:00:00.000Z"),
    });
  });
});
