import { describe, expect, it } from "vitest";
import { pushBody } from "./push-text";

/** Spec 0103 §5 — the campaign's own message, plus the coupon when there is one. */
describe("pushBody", () => {
  it("is the message alone without a coupon, and `message · coupon` with one", () => {
    expect(pushBody("¡Volvé!", null)).toBe("¡Volvé!");
    expect(pushBody("¡Volvé!", "2x1 en picadas")).toBe(
      "¡Volvé! · 2x1 en picadas",
    );
  });
});
