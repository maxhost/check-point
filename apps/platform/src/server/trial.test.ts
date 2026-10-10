import { describe, expect, it } from "vitest";
import { nextTrialEnd, parseTrialChange } from "./trial";

const NOW = new Date("2026-10-10T12:00:00.000Z");
const DAY = 86_400_000;

describe("nextTrialEnd (spec 0190 §D5)", () => {
  it("prueba vigente + 7 → suma sobre el fin actual", () => {
    const current = new Date(NOW.getTime() + 10 * DAY);
    expect(
      nextTrialEnd(current, NOW, { mode: "add_days", days: 7 }).getTime(),
    ).toBe(current.getTime() + 7 * DAY);
  });

  it("ORACULO DE LA FILA 3: prueba vencida + 7 → now + 7, no fin viejo + 7", () => {
    const current = new Date(NOW.getTime() - 30 * DAY);
    expect(
      nextTrialEnd(current, NOW, { mode: "add_days", days: 7 }).getTime(),
    ).toBe(NOW.getTime() + 7 * DAY);
  });

  it("sin fecha + 7 → now + 7", () => {
    expect(
      nextTrialEnd(null, NOW, { mode: "add_days", days: 7 }).getTime(),
    ).toBe(NOW.getTime() + 7 * DAY);
  });

  it("set_date → ese dia a las 23:59:59 de Ecuador (UTC-5)", () => {
    expect(
      nextTrialEnd(null, NOW, {
        mode: "set_date",
        date: "2026-12-31",
      }).toISOString(),
    ).toBe("2027-01-01T04:59:59.000Z");
  });
});

describe("parseTrialChange", () => {
  it.each([
    [
      { mode: "add_days", days: 1 },
      { mode: "add_days", days: 1 },
    ],
    [
      { mode: "add_days", days: 365 },
      { mode: "add_days", days: 365 },
    ],
    [
      { mode: "set_date", date: "2027-02-28" },
      { mode: "set_date", date: "2027-02-28", confirmBlock: false },
    ],
    [
      { mode: "set_date", date: "2026-01-01", confirmBlock: true },
      { mode: "set_date", date: "2026-01-01", confirmBlock: true },
    ],
  ])("acepta %j", (body, expected) => {
    expect(parseTrialChange(body)).toEqual(expected);
  });

  it.each([
    null,
    "x",
    {},
    { mode: "add_days", days: 0 },
    { mode: "add_days", days: 366 },
    { mode: "add_days", days: 1.5 },
    { mode: "add_days", days: "7" },
    { mode: "set_date", date: "2027-02-30" },
    { mode: "set_date", date: "31/12/2026" },
    { mode: "set_date", date: "2026-12-31", confirmBlock: "si" },
    { mode: "otro" },
  ])("rechaza %j", (body) => {
    expect(parseTrialChange(body)).toBeNull();
  });
});
