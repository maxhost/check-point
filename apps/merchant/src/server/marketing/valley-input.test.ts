import { describe, expect, it } from "vitest";
import { parseTemplateInput } from "./template-input";
import { templateByKey } from "@mi-pasaporte/domain/server/marketing/templates";
import { parseValleyWindows } from "./valley-input";
import { CUSTOM_ONLY_IN_VALLEY } from "@mi-pasaporte/domain/server/marketing/reward-input";

/**
 * Spec 0113 H3 — `enable` of «Horas valle» (and what the others refuse because of it), and
 * H2's body of the merchant's windows. PURE.
 */

const NOW = new Date("2026-10-06T12:00:00.000Z");
const valley = templateByKey("valley")!;
const REWARD = { couponLabel: "2x1 en cerveza", couponCost: "3.00" };

const errorsOf = (key: string, body: Record<string, unknown>) => {
  const parsed = parseTemplateInput(templateByKey(key)!, body, NOW);
  if (parsed.ok) throw new Error("se esperaba un 400");
  return parsed.errors;
};

describe("enable «Horas valle»", () => {
  it("defaults: no channel, no doors, cap 50, 30 days, the default message; a mandatory reward without cap", () => {
    const parsed = parseTemplateInput(valley, REWARD, NOW);
    expect(parsed).toMatchObject({
      ok: true,
      value: {
        channelProximity: false,
        channelPush: false,
        excludedLocationIds: [],
        dormantDays: 30,
        message: "Ahora hay lugar: te esperamos con un regalo",
        valleyMonthlyCap: 50,
        couponKind: "free_product",
        couponLabel: "2x1 en cerveza",
        couponCost: "3.00",
        couponMaxRedemptions: null,
        crossAudience: null,
        welcomeValidDays: null,
        endsAt: null,
      },
    });
  });

  it("the free-text reward (`custom`) is accepted here: only its label", () => {
    const parsed = parseTemplateInput(
      valley,
      { ...REWARD, couponKind: "custom", valleyMonthlyCap: 10000 },
      NOW,
    );
    expect(parsed).toMatchObject({
      ok: true,
      value: {
        couponKind: "custom",
        couponLabel: "2x1 en cerveza",
        couponProductId: null,
        couponDiscountUnit: null,
        couponExtraUnits: null,
        valleyMonthlyCap: 10000,
      },
    });
    expect(
      Object.keys(
        errorsOf("valley", {
          ...REWARD,
          couponKind: "custom",
          couponDiscountUnit: "percent",
          couponDiscountValue: 10,
        }),
      ).sort(),
    ).toEqual(["couponDiscountUnit", "couponDiscountValue"]);
  });

  it("400 on each forbidden field, a missing reward, a cap out of range", () => {
    expect(Object.keys(errorsOf("valley", {}))).toEqual(["couponLabel"]);
    for (const [body, field] of [
      [{ channels: ["push"] }, "channels"],
      [
        { excludedLocationIds: ["0113c0de-0000-4000-8000-000000000001"] },
        "excludedLocationIds",
      ],
      [{ couponMaxRedemptions: 5 }, "couponMaxRedemptions"],
      [{ welcomeValidDays: 15 }, "welcomeValidDays"],
      [{ crossAudience: "any" }, "crossAudience"],
      [{ valleyMonthlyCap: 0 }, "valleyMonthlyCap"],
      [{ valleyMonthlyCap: 10001 }, "valleyMonthlyCap"],
      [{ valleyMonthlyCap: 1.5 }, "valleyMonthlyCap"],
      [{ dormantDays: 45 }, "dormantDays"],
    ] as const)
      expect(Object.keys(errorsOf("valley", { ...REWARD, ...body }))).toContain(
        field,
      );
    // An empty list of doors is accepted, like in the cross offer.
    expect(
      parseTemplateInput(valley, { ...REWARD, excludedLocationIds: [] }, NOW)
        .ok,
    ).toBe(true);
  });

  it("V8 — `custom` in ANY other template is a 400 on couponKind", () => {
    const custom = {
      couponKind: "custom",
      couponLabel: "Algo",
      couponCost: "1",
    };
    expect(errorsOf("cross", custom)).toEqual({
      couponKind: CUSTOM_ONLY_IN_VALLEY,
    });
    expect(errorsOf("welcome", custom)).toEqual({
      couponKind: CUSTOM_ONLY_IN_VALLEY,
    });
    expect(
      errorsOf("win_back", {
        ...custom,
        couponMaxRedemptions: 10,
        endsAt: "2026-12-01T00:00:00Z",
      }),
    ).toEqual({ couponKind: CUSTOM_ONLY_IN_VALLEY });
  });

  it("`valleyMonthlyCap` in any other template is a 400", () => {
    expect(errorsOf("missed_you", { valleyMonthlyCap: 50 })).toEqual({
      valleyMonthlyCap: "Este campo es solo de la campaña «Horas valle».",
    });
  });

  it("the cross offer does NOT accept the internal audience `not_active`", () => {
    expect(
      errorsOf("cross", {
        couponLabel: "10%",
        couponCost: "1",
        crossAudience: "not_active",
      }),
    ).toHaveProperty("crossAudience");
  });
});

describe("parseValleyWindows — the merchant's windows", () => {
  it("accepts whole hours of one day, sorted", () => {
    expect(
      parseValleyWindows({
        windows: [
          { weekday: 5, startHour: 22, endHour: 24 },
          { weekday: 2, startHour: 15, endHour: 17 },
          { weekday: 2, startHour: 0, endHour: 1 },
        ],
      }),
    ).toEqual({
      ok: true,
      windows: [
        { weekday: 2, startHour: 0, endHour: 1 },
        { weekday: 2, startHour: 15, endHour: 17 },
        { weekday: 5, startHour: 22, endHour: 24 },
      ],
    });
  });

  it("`[]` (and no list) is 400 on `windows`: going back to the network is the DELETE", () => {
    for (const body of [{ windows: [] }, {}, null, { windows: "x" }])
      expect(parseValleyWindows(body)).toMatchObject({
        ok: false,
        fields: { windows: expect.any(String) },
      });
  });

  it("each bad window is a 400 on `windows.N`: range, order, fractions, overlap", () => {
    for (const window of [
      { weekday: 0, startHour: 1, endHour: 2 },
      { weekday: 8, startHour: 1, endHour: 2 },
      { weekday: 1, startHour: -1, endHour: 2 },
      { weekday: 1, startHour: 24, endHour: 25 },
      { weekday: 1, startHour: 3, endHour: 3 },
      { weekday: 1, startHour: 5, endHour: 4 },
      { weekday: 1, startHour: 1.5, endHour: 3 },
      { weekday: "1", startHour: 1, endHour: 3 },
    ])
      expect(
        parseValleyWindows({
          windows: [{ weekday: 7, startHour: 10, endHour: 11 }, window],
        }),
      ).toMatchObject({
        ok: false,
        fields: { "windows.1": expect.any(String) },
      });
    expect(
      parseValleyWindows({
        windows: [
          { weekday: 3, startHour: 10, endHour: 13 },
          { weekday: 3, startHour: 12, endHour: 14 },
        ],
      }),
    ).toEqual({
      ok: false,
      fields: { "windows.1": "Esta franja se pisa con otra del mismo día." },
    });
    // Touching is not overlapping; another day never is.
    expect(
      parseValleyWindows({
        windows: [
          { weekday: 3, startHour: 10, endHour: 12 },
          { weekday: 3, startHour: 12, endHour: 14 },
          { weekday: 4, startHour: 11, endHour: 13 },
        ],
      }).ok,
    ).toBe(true);
  });
});
