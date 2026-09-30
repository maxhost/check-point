import { describe, expect, it } from "vitest";
import { parseHours } from "./hours-input";

/**
 * Spec 0113 H1 — the body of `PUT /api/locations/{id}/hours`: every error with its key, and
 * the shapes the contract names (cortado, a range past midnight).
 */

type Range = { opens: string; closes: string };

const week = (over: Record<number, unknown> = {}) => ({
  days: Array.from({ length: 7 }, (_, i) => ({
    weekday: i + 1,
    ranges: (over[i + 1] as Range[] | undefined) ?? [],
  })),
});

const fieldsOf = (value: unknown) => {
  const parsed = parseHours(value);
  if (parsed.ok) throw new Error("se esperaba un 400");
  return parsed.fields;
};

describe("parseHours — the week", () => {
  it("accepts the «cortado» (2 ranges), a range past midnight (V1) and closed days", () => {
    const parsed = parseHours(
      week({
        1: [
          { opens: "16:00", closes: "21:00" },
          { opens: "08:00", closes: "13:00" },
        ],
        6: [{ opens: "20:00", closes: "02:00" }],
      }),
    );
    expect(parsed).toEqual({
      ok: true,
      days: [
        {
          weekday: 1,
          // Stored in the order of the day, whatever order they came in.
          ranges: [
            { opens: "08:00", closes: "13:00" },
            { opens: "16:00", closes: "21:00" },
          ],
        },
        { weekday: 2, ranges: [] },
        { weekday: 3, ranges: [] },
        { weekday: 4, ranges: [] },
        { weekday: 5, ranges: [] },
        { weekday: 6, ranges: [{ opens: "20:00", closes: "02:00" }] },
        { weekday: 7, ranges: [] },
      ],
    });
  });

  it("the days come in any order and leave sorted", () => {
    const body = week();
    body.days.reverse();
    const parsed = parseHours(body);
    expect(parsed.ok && parsed.days.map((d) => d.weekday)).toEqual([
      1, 2, 3, 4, 5, 6, 7,
    ]);
  });

  it("fields.days: not a list, missing, repeated or out-of-range days", () => {
    expect(Object.keys(fieldsOf({}))).toEqual(["days"]);
    expect(Object.keys(fieldsOf(null))).toEqual(["days"]);
    const six = week();
    six.days.pop();
    expect(Object.keys(fieldsOf(six))).toEqual(["days"]);
    const repeated = week();
    repeated.days[6].weekday = 1;
    expect(Object.keys(fieldsOf(repeated))).toEqual(["days"]);
    const eight = week();
    eight.days[6].weekday = 8;
    expect(Object.keys(fieldsOf(eight))).toEqual(["days"]);
    const text = week();
    (text.days[0] as { weekday: unknown }).weekday = "1";
    expect(Object.keys(fieldsOf(text))).toEqual(["days"]);
  });

  it("days.N.ranges: the ranges are not a list", () => {
    const body = week();
    (body.days[2] as { ranges: unknown }).ranges = "cerrado";
    expect(fieldsOf(body)).toEqual({
      "days.2.ranges": expect.any(String),
    });
  });

  it("days.N.ranges.M: format, step, same opening and closing", () => {
    for (const range of [
      { opens: "8:00", closes: "13:00" },
      { opens: "08:00", closes: "24:00" },
      { opens: "08:00" },
      { opens: 800, closes: "13:00" },
      { opens: "08:15", closes: "13:00" },
      { opens: "08:00", closes: "13:45" },
      { opens: "10:00", closes: "10:00" },
    ])
      expect(fieldsOf(week({ 3: [range] }))).toEqual({
        "days.2.ranges.0": expect.any(String),
      });
  });

  it("days.N.ranges.M: the two ranges of a day overlap — past midnight too (V1)", () => {
    expect(
      fieldsOf(
        week({
          1: [
            { opens: "08:00", closes: "13:00" },
            { opens: "12:30", closes: "18:00" },
          ],
        }),
      ),
    ).toEqual({ "days.0.ranges.1": "Los dos rangos del día se pisan." });
    expect(
      fieldsOf(
        week({
          5: [
            { opens: "20:00", closes: "02:00" },
            { opens: "22:00", closes: "23:30" },
          ],
        }),
      ),
    ).toEqual({ "days.4.ranges.1": "Los dos rangos del día se pisan." });
    // Touching is not overlapping.
    expect(
      parseHours(
        week({
          1: [
            { opens: "08:00", closes: "13:00" },
            { opens: "13:00", closes: "18:00" },
          ],
        }),
      ).ok,
    ).toBe(true);
  });

  it("days.N.ranges.M: a third range", () => {
    expect(
      fieldsOf(
        week({
          7: [
            { opens: "08:00", closes: "10:00" },
            { opens: "11:00", closes: "13:00" },
            { opens: "15:00", closes: "17:00" },
          ],
        }),
      ),
    ).toEqual({ "days.6.ranges.2": "Un día tiene como máximo 2 rangos." });
  });
});
