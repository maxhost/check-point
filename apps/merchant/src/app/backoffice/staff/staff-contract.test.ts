import { describe, expect, it } from "vitest";
import { errorCopy } from "./staff-contract";

describe("staff error copy", () => {
  it.each([
    "permissions_required",
    "unknown_permission",
    "permission_not_grantable",
    "self_permission_edit",
    "target_is_owner",
    "staff_not_found",
    "unauthorized",
    "not_member",
    "missing_permission",
    "email_not_verified",
    "business_suspended",
    "business_closed",
    "invalid_body",
    "name_required",
    "name_too_long",
    "permissions_not_here",
    "handle_taken",
    "target_disabled",
  ])("has actionable Spanish copy for %s", (code) => {
    const copy = errorCopy({ code, error: "server copy" }, "fallback");
    expect(copy).not.toBe("server copy");
    expect(copy).not.toBe("fallback");
    expect(copy.length).toBeGreaterThan(20);
  });

  it("uses server copy for an unknown future code", () => {
    expect(
      errorCopy({ code: "future", error: "Detalle útil" }, "fallback"),
    ).toBe("Detalle útil");
  });
});
