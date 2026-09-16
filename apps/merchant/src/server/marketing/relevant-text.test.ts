import { describe, expect, it } from "vitest";
import { composeRelevantText, RELEVANT_TEXT_CAP } from "./relevant-text";

const BALANCE = "Bar La Esquina: te faltan 2 sellos";
const CAMPAIGN = {
  businessName: "Bar La Esquina",
  message: "2x1 en picadas hasta el domingo",
};

/** How many times `needle` appears in `haystack`. */
function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("composeRelevantText", () => {
  it("fuses balance and message with the business name ONCE when both fit", () => {
    const text = composeRelevantText(BALANCE, CAMPAIGN, RELEVANT_TEXT_CAP);
    expect(text).toBe(
      "Bar La Esquina: te faltan 2 sellos · 2x1 en picadas hasta el domingo",
    );
    expect(text.length).toBe(68);
    expect(occurrences(text, "Bar La Esquina")).toBe(1);
  });

  it("drops the balance ENTIRE when the composed text does not fit: the message wins", () => {
    const text = composeRelevantText(BALANCE, CAMPAIGN, 50);
    expect(text).toBe("Bar La Esquina: 2x1 en picadas hasta el domingo");
    expect(text).not.toContain("sellos");
    expect(text).not.toContain("…");
    expect(text.length).toBeLessThanOrEqual(50);
  });

  it("returns the utility sentence untouched when there is no campaign", () => {
    expect(composeRelevantText(BALANCE, null, RELEVANT_TEXT_CAP)).toBe(BALANCE);
  });

  it("reads `{negocio}: {mensaje}` when there is only a turn", () => {
    expect(composeRelevantText(null, CAMPAIGN, RELEVANT_TEXT_CAP)).toBe(
      "Bar La Esquina: 2x1 en picadas hasta el domingo",
    );
  });

  it("never returns more than the cap, even with only the message left", () => {
    const text = composeRelevantText(BALANCE, CAMPAIGN, 20);
    expect(text.length).toBe(20);
    expect(text.endsWith("…")).toBe(true);
  });

  it("returns an empty text when there is nothing to say", () => {
    expect(composeRelevantText(null, null, RELEVANT_TEXT_CAP)).toBe("");
  });
});
