import { describe, expect, it } from "vitest";
import { isInPushWindow, localHour, nextSendableAt } from "./push-window";

/** Spec 0103 §5 — the business's push hours, `[start, end)` in its own zone. PURE. */
const AR = "America/Argentina/Buenos_Aires"; // UTC-3, no DST
const MADRID = "Europe/Madrid";
const at = (iso: string) => new Date(iso);

describe("push window", () => {
  it("08:59 local → the next 09:00; 09:00 and 20:59 → now; 21:00 → tomorrow 09:00", () => {
    // 08:59 in Buenos Aires = 11:59Z.
    expect(nextSendableAt(at("2026-09-26T11:59:00Z"), AR, 9, 21)).toEqual(
      at("2026-09-26T12:00:00Z"),
    );
    const nine = at("2026-09-26T12:00:00Z");
    expect(nextSendableAt(nine, AR, 9, 21)).toBe(nine);
    const lastMinute = at("2026-09-26T23:59:00Z"); // 20:59 local
    expect(nextSendableAt(lastMinute, AR, 9, 21)).toBe(lastMinute);
    // 21:00 local = 00:00Z of the 27th → 09:00 local of the 27th = 12:00Z.
    expect(nextSendableAt(at("2026-09-27T00:00:00Z"), AR, 9, 21)).toEqual(
      at("2026-09-27T12:00:00Z"),
    );
  });

  it("the window is [start, end): start is in, end is out", () => {
    expect(isInPushWindow(at("2026-09-26T12:00:00Z"), AR, 9, 21)).toBe(true);
    expect(isInPushWindow(at("2026-09-26T11:59:59Z"), AR, 9, 21)).toBe(false);
    expect(isInPushWindow(at("2026-09-27T00:00:00Z"), AR, 9, 21)).toBe(false);
    expect(isInPushWindow(at("2026-09-27T02:59:00Z"), AR, 0, 24)).toBe(true);
    expect(localHour(at("2026-09-27T03:00:00Z"), AR)).toBe(0);
  });

  it("Europe/Madrid on the days the clock changes lands on 09:00 LOCAL", () => {
    // 2026-03-29: 02:00 CET → 03:00 CEST. 00:30Z = 01:30 CET → 09:00 CEST = 07:00Z.
    expect(nextSendableAt(at("2026-03-29T00:30:00Z"), MADRID, 9, 21)).toEqual(
      at("2026-03-29T07:00:00Z"),
    );
    // 2026-10-25: 03:00 CEST → 02:00 CET. 00:30Z = 02:30 CEST → 09:00 CET = 08:00Z.
    expect(nextSendableAt(at("2026-10-25T00:30:00Z"), MADRID, 9, 21)).toEqual(
      at("2026-10-25T08:00:00Z"),
    );
  });

  it("an hour that never happens is a bug, not a case: it throws", () => {
    expect(() =>
      nextSendableAt(at("2026-09-26T00:30:00Z"), "Not/AZone", 9, 21),
    ).toThrow();
  });
});
