import { describe, expect, it } from "vitest";
import { memberEmailFailure } from "./member-email-gate";

describe("member owner-email gate", () => {
  it.each([false, undefined, null, "true", 1])(
    "fails closed for owner %s",
    (value) => {
      expect(memberEmailFailure("owner", value)).toMatchObject({
        status: 403,
        code: "email_not_verified",
      });
    },
  );
  it("accepts the strict verified boolean and preserves custom copy", () => {
    expect(memberEmailFailure("owner", true)).toBeNull();
    expect(
      memberEmailFailure("owner", false, "Verifica tu email.")?.message,
    ).toBe("Verifica tu email.");
  });
  it.each([false, undefined, true])("does not email-gate staff %s", (value) => {
    expect(memberEmailFailure("staff", value)).toBeNull();
  });
});
