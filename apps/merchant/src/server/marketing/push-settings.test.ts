import { describe, expect, it } from "vitest";
import { parsePushWindowPatch } from "./push-settings";

/** Spec 0103 §11 — the body of `PATCH /api/marketing/settings`. PURE. */
describe("parsePushWindowPatch", () => {
  it("accepts whole hours with start 0–23, end 1–24 and start < end", () => {
    for (const [startHour, endHour] of [
      [9, 21],
      [0, 24],
      [23, 24],
      [0, 1],
    ])
      expect(
        parsePushWindowPatch({ pushWindow: { startHour, endHour } }),
      ).toEqual({ ok: true, value: { startHour, endHour } });
  });

  it("anything else is a `pushWindow` field error", () => {
    for (const pushWindow of [
      { startHour: 21, endHour: 9 },
      { startHour: 9, endHour: 9 },
      { startHour: -1, endHour: 9 },
      { startHour: 9, endHour: 25 },
      { startHour: 24, endHour: 24 },
      { startHour: 9.5, endHour: 21 },
      { startHour: "9", endHour: 21 },
      { startHour: 9 },
      null,
    ]) {
      const parsed = parsePushWindowPatch({ pushWindow });
      expect(parsed.ok).toBe(false);
      expect(!parsed.ok && Object.keys(parsed.errors)).toEqual(["pushWindow"]);
    }
    expect(parsePushWindowPatch("nope").ok).toBe(false);
  });
});
