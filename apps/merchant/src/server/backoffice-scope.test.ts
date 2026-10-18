import { describe, expect, it } from "vitest";
import { backofficeScopeKey } from "./backoffice-scope";
const identity = {
  sessionId: "session-a",
  userId: "user-a",
  businessId: "business-a",
};
const secret = "a".repeat(32);
describe("backoffice identity HMAC", () => {
  it("matches the canonical v1 tuple independent fixed vector", () => {
    expect(backofficeScopeKey(identity, secret)).toBe(
      "df07f4bdb29ef38208e49f19b72ae8db8856e9974b3ea445f10a8df97486841d",
    );
  });
  it.each(["sessionId", "userId", "businessId"] as const)(
    "binds %s without serializing raw identities",
    (field) => {
      const key = backofficeScopeKey(identity, secret);
      expect(
        backofficeScopeKey({ ...identity, [field]: "other" }, secret),
      ).not.toBe(key);
      expect(key).toMatch(/^[a-f0-9]{64}$/);
      expect(key).not.toContain(identity[field]);
    },
  );
  it("is stable for the same session and differs with the auth secret", () => {
    expect(backofficeScopeKey(identity, secret)).toBe(
      backofficeScopeKey({ ...identity }, secret),
    );
    expect(backofficeScopeKey(identity, "b".repeat(32))).not.toBe(
      backofficeScopeKey(identity, secret),
    );
  });
  it.each([undefined, "", "short"])("rejects missing/short secret", (value) => {
    expect(() => backofficeScopeKey(identity, value)).toThrow(
      "valid auth secret",
    );
  });
  it.each(["sessionId", "userId", "businessId"] as const)(
    "does not sign missing %s",
    (field) => {
      expect(() =>
        backofficeScopeKey({ ...identity, [field]: " " }, secret),
      ).toThrow("complete authenticated identity");
    },
  );
});
