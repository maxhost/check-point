import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_STATUSES,
  type CampaignAction,
  type CampaignStatus,
  isEditable,
  nextStatus,
} from "./campaign-transitions";
import {
  type CampaignInput,
  parseCampaignInput,
  parseCampaignPatch,
} from "./campaign-input";

const BASE = {
  name: "Dormidos de septiembre",
  message: "2x1 en picadas hasta el domingo",
  dormantDays: 45,
  startsAt: "2026-10-01T12:00:00.000Z",
  locationIds: ["11111111-1111-4111-8111-111111111111"],
};

function ok(body: Record<string, unknown>): CampaignInput {
  const parsed = parseCampaignInput(body);
  if (!parsed.ok)
    throw new Error(`esperaba ok: ${JSON.stringify(parsed.errors)}`);
  return parsed.value;
}

function errors(body: Record<string, unknown>): Record<string, string> {
  const parsed = parseCampaignInput(body);
  if (parsed.ok) throw new Error("esperaba errores y parseo bien");
  return parsed.errors;
}

describe("the campaign lifecycle table", () => {
  /**
   * The WHOLE table, both directions: every allowed pair AND every pair outside it. A test
   * that only listed the allowed ones would stay green if a transition were ADDED, which
   * is the mistake that matters here — the 409 is what stops an `ended` campaign from
   * going back to `active` and re-queueing an audience that already ran.
   */
  const ALLOWED: Record<CampaignAction, CampaignStatus[]> = {
    activate: ["draft", "paused"],
    pause: ["active"],
    end: ["active", "paused"],
    archive: ["ended", "paused"],
  };
  const LANDS: Record<CampaignAction, CampaignStatus> = {
    activate: "active",
    pause: "paused",
    end: "ended",
    archive: "archived",
  };

  it("answers exactly the allowed pairs and refuses every other one", () => {
    const allowed: string[] = [];
    const refused: string[] = [];
    for (const action of Object.keys(ALLOWED) as CampaignAction[]) {
      for (const status of CAMPAIGN_STATUSES) {
        const next = nextStatus(status, action);
        if (next === null) refused.push(`${status}:${action}`);
        else {
          allowed.push(`${status}:${action}`);
          expect(next).toBe(LANDS[action]);
        }
      }
    }
    expect(allowed.sort()).toEqual(
      Object.entries(ALLOWED)
        .flatMap(([action, froms]) => froms.map((from) => `${from}:${action}`))
        .sort(),
    );
    // 4 actions x 5 statuses = 20 pairs; 7 are allowed, so 13 must answer 409.
    expect(refused).toHaveLength(13);
  });

  it("keeps `archived` terminal and `draft` un-pausable", () => {
    expect(nextStatus("archived", "activate")).toBeNull();
    expect(nextStatus("draft", "pause")).toBeNull();
    expect(nextStatus("ended", "activate")).toBeNull();
  });

  it("allows editing only in draft and paused", () => {
    expect(CAMPAIGN_STATUSES.filter(isEditable)).toEqual(["draft", "paused"]);
  });
});

describe("the composer's body", () => {
  it("accepts the shape the composer sends", () => {
    expect(ok(BASE)).toMatchObject({
      name: "Dormidos de septiembre",
      dormantDays: 45,
      couponLabel: null,
      couponCost: null,
      couponMaxRedemptions: null,
      endsAt: null,
    });
  });

  it("defaults `dormantDays` to 30 and trims the free text", () => {
    const parsed = ok({ ...BASE, dormantDays: undefined, name: "  Hola  " });
    expect(parsed.dormantDays).toBe(30);
    expect(parsed.name).toBe("Hola");
  });

  it("reports the field that is wrong, by name", () => {
    expect(errors({ ...BASE, name: "" })).toHaveProperty("name");
    expect(errors({ ...BASE, message: "x".repeat(61) })).toHaveProperty(
      "message",
    );
    expect(errors({ ...BASE, dormantDays: 6 })).toHaveProperty("dormantDays");
    expect(errors({ ...BASE, dormantDays: 366 })).toHaveProperty("dormantDays");
    expect(errors({ ...BASE, dormantDays: 30.5 })).toHaveProperty(
      "dormantDays",
    );
    expect(errors({ ...BASE, startsAt: "no soy fecha" })).toHaveProperty(
      "startsAt",
    );
    expect(errors({ ...BASE, locationIds: [] })).toHaveProperty("locationIds");
    expect(errors({ ...BASE, locationIds: ["no-uuid"] })).toHaveProperty(
      "locationIds",
    );
  });

  it("refuses a `message` of 61 and takes one of 60", () => {
    // The boundary is the one the database checks; off by one here is a 503 with a
    // constraint name instead of a message next to the field.
    expect(ok({ ...BASE, message: "x".repeat(60) }).message).toHaveLength(60);
    expect(errors({ ...BASE, message: "x".repeat(61) })).toHaveProperty(
      "message",
    );
  });

  it("wants the end AFTER the start, not equal", () => {
    expect(errors({ ...BASE, endsAt: BASE.startsAt })).toHaveProperty("endsAt");
    expect(
      ok({ ...BASE, endsAt: "2026-10-02T12:00:00.000Z" }).endsAt,
    ).toBeInstanceOf(Date);
  });

  describe("the coupon is ALL OR NOTHING", () => {
    const FULL = {
      couponLabel: "2x1 en panes",
      couponCost: 1.5,
      couponMaxRedemptions: 50,
    };

    it("takes the three together", () => {
      expect(ok({ ...BASE, ...FULL })).toMatchObject({
        couponLabel: "2x1 en panes",
        couponCost: "1.50",
        couponMaxRedemptions: 50,
      });
    });

    it("refuses any incomplete pair or single", () => {
      for (const key of Object.keys(FULL) as (keyof typeof FULL)[]) {
        const partial = { ...FULL };
        delete partial[key];
        expect(errors({ ...BASE, ...partial })).toHaveProperty("couponLabel");
      }
      expect(errors({ ...BASE, couponCost: 1.5 })).toHaveProperty(
        "couponLabel",
      );
    });

    it("refuses a negative cost and a cap under 1", () => {
      expect(errors({ ...BASE, ...FULL, couponCost: -1 })).toHaveProperty(
        "couponCost",
      );
      expect(
        errors({ ...BASE, ...FULL, couponMaxRedemptions: 0 }),
      ).toHaveProperty("couponMaxRedemptions");
    });
  });
});

describe("the PATCH", () => {
  const current: CampaignInput & { status: CampaignStatus } = {
    ...ok({
      ...BASE,
      couponLabel: "2x1 en panes",
      couponCost: 1.5,
      couponMaxRedemptions: 50,
    }),
    status: "draft",
  };

  function patched(body: Record<string, unknown>): CampaignInput {
    const parsed = parseCampaignPatch(body, current);
    if (!parsed.ok)
      throw new Error(`esperaba ok: ${JSON.stringify(parsed.errors)}`);
    return parsed.value;
  }

  it("changes only what it names", () => {
    const next = patched({ message: "Nuevo mensaje" });
    expect(next.message).toBe("Nuevo mensaje");
    expect(next.name).toBe(current.name);
    expect(next.dormantDays).toBe(current.dormantDays);
  });

  it("carries the coupon over untouched when it does not name it", () => {
    expect(patched({ message: "Otro" })).toMatchObject({
      couponLabel: "2x1 en panes",
      couponCost: "1.50",
      couponMaxRedemptions: 50,
    });
  });

  it("replaces the coupon as a TRIO, never in halves", () => {
    // Naming one key replaces the whole coupon: sending `couponCost` alone over a
    // campaign that HAS a coupon must not leave a label with no cost behind.
    const parsed = parseCampaignPatch({ couponCost: 9 }, current);
    expect(parsed.ok).toBe(false);
    expect(parsed.ok === false && parsed.errors).toHaveProperty("couponLabel");
  });

  it("removes the coupon when it sends the three as null", () => {
    expect(
      patched({
        couponLabel: null,
        couponCost: null,
        couponMaxRedemptions: null,
      }),
    ).toMatchObject({ couponLabel: null, couponCost: null });
  });

  it("clears `endsAt` when it sends it as null, and keeps it when absent", () => {
    // `?? current` would be wrong here: `null` is a VALUE the owner can send («sin fin»),
    // and treating it as «no lo mandó» would make the date impossible to erase.
    const withEnd: CampaignInput & { status: CampaignStatus } = {
      ...current,
      endsAt: new Date("2026-10-05T12:00:00.000Z"),
    };
    const cleared = parseCampaignPatch({ endsAt: null }, withEnd);
    expect(cleared.ok && cleared.value.endsAt).toBeNull();
    const kept = parseCampaignPatch({ message: "Otro" }, withEnd);
    expect(kept.ok && kept.value.endsAt).toEqual(withEnd.endsAt);
  });
});
