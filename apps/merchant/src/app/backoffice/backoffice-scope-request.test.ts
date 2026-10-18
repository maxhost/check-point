import { describe, expect, it } from "vitest";
import {
  BackofficeScopeRequestError,
  backofficeScopeHeaders,
  isBackofficeContextChanged,
} from "./backoffice-scope-request";

describe("0238 opt-in scope classification", () => {
  it("leaves callers without a mark outside the protocol", () => {
    expect(backofficeScopeHeaders(undefined)).toBeUndefined();
    expect(backofficeScopeHeaders("a".repeat(64))).toEqual({
      "X-Backoffice-Scope": "a".repeat(64),
    });
  });

  it.each([
    "",
    "a".repeat(63),
    "a".repeat(65),
    "A".repeat(64),
    "g".repeat(64),
    " " + "a".repeat(64),
  ])("rejects malformed marks without including them in the error", (value) => {
    expect(() => backofficeScopeHeaders(value)).toThrow(
      BackofficeScopeRequestError,
    );
    try {
      backofficeScopeHeaders(value);
    } catch (error) {
      expect((error as Error).message).not.toContain(
        value || "X-Backoffice-Scope",
      );
    }
  });

  it("classifies the exact code rather than any HTTP409", () => {
    expect(
      isBackofficeContextChanged({
        code: "backoffice_context_changed",
        status: 409,
      }),
    ).toBe(true);
    for (const failure of [
      null,
      undefined,
      "backoffice_context_changed",
      { status: 409 },
      { status: 409, code: "version_conflict" },
      { status: 409, code: "module_requires" },
    ])
      expect(isBackofficeContextChanged(failure)).toBe(false);
  });
});
