import { describe, expect, it } from "vitest";
import { ownerGateErrors, type OwnerGateErrorCode } from "./api-error";

describe("ownerGateErrors", () => {
  it("mapea los cinco códigos del gate a acciones distintas", () => {
    const codes: OwnerGateErrorCode[] = [
      "unauthorized",
      "not_owner",
      "email_not_verified",
      "business_suspended",
      "business_closed",
    ];

    expect(Object.keys(ownerGateErrors).sort()).toEqual([...codes].sort());
    expect(
      new Set(codes.map((code) => ownerGateErrors[code].action)).size,
    ).toBe(codes.length);
  });
});
