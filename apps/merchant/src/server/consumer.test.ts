import { describe, expect, it } from "vitest";
import {
  type ConsumerAccountRow,
  ConsumerError,
  consumerAccountResponse,
  generateOpaqueToken,
  hashToken,
  membershipResponse,
} from "./consumer/core";
import { validateEnrollInput } from "./consumer/validation";
import { composeE164, flagEmoji, isValidCountryIso } from "../lib/countries";

describe("consumer opaque tokens", () => {
  it("emits unguessable tokens of at least 128 bits with no PII", () => {
    const a = generateOpaqueToken();
    const b = generateOpaqueToken();
    // base64url, url-safe alphabet only.
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    // 32 random bytes = 256 bits, well over the 128-bit floor.
    expect(Buffer.from(a, "base64url").length).toBeGreaterThanOrEqual(16);
    // Randomness: two draws never collide.
    expect(a).not.toEqual(b);
  });

  it("hashes tokens deterministically to a 64-char hex digest", () => {
    const token = generateOpaqueToken();
    const digest = hashToken(token);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).toEqual(digest);
    // The hash is not the token in the clear.
    expect(digest).not.toEqual(token);
  });
});

describe("consumer DTOs never leak secrets", () => {
  const account: ConsumerAccountRow = {
    id: "acc-1",
    phoneE164: "+593987654321",
    phoneVerifiedAt: null,
    firstName: "Marcos",
    lastName: "Pérez",
    countryIso: "EC",
    qrToken: "SUPER-SECRET-QR-TOKEN",
    webViewToken: "SUPER-SECRET-WEB-VIEW-TOKEN",
    createdAt: new Date("2026-08-14T00:00:00Z"),
    updatedAt: new Date("2026-08-14T00:00:00Z"),
  };

  it("account DTO omits the raw qrToken/webViewToken and derives phoneVerified", () => {
    const dto = consumerAccountResponse(account);
    expect(dto).not.toHaveProperty("qrToken");
    expect(dto).not.toHaveProperty("webViewToken");
    expect(dto).not.toHaveProperty("tokenHash");
    expect(JSON.stringify(dto)).not.toContain("SUPER-SECRET-QR-TOKEN");
    expect(JSON.stringify(dto)).not.toContain("SUPER-SECRET-WEB-VIEW-TOKEN");
    expect(dto).toMatchObject({
      id: "acc-1",
      firstName: "Marcos",
      lastName: "Pérez",
      phoneE164: "+593987654321",
      countryIso: "EC",
      phoneVerified: false,
    });
  });

  it("account DTO exposes countryIso (metadata, not a secret) incl. null", () => {
    expect(consumerAccountResponse(account).countryIso).toBe("EC");
    expect(
      consumerAccountResponse({ ...account, countryIso: null }).countryIso,
    ).toBeNull();
  });

  it("account DTO reports phoneVerified true once verified", () => {
    const dto = consumerAccountResponse({
      ...account,
      phoneVerifiedAt: new Date("2026-08-14T00:00:00Z"),
    });
    expect(dto.phoneVerified).toBe(true);
  });

  it("membership DTO exposes only its public fields", () => {
    const dto = membershipResponse({
      id: "mem-1",
      programId: "prog-1",
      businessId: "biz-1",
      enrolledAt: new Date("2026-08-14T00:00:00Z"),
    });
    expect(dto).not.toHaveProperty("tokenHash");
    expect(dto).not.toHaveProperty("qrToken");
    expect(dto).toMatchObject({
      id: "mem-1",
      programId: "prog-1",
      businessId: "biz-1",
    });
  });
});

describe("countries", () => {
  it("derives flag emoji from ISO-2 via regional indicators", () => {
    expect(flagEmoji("EC")).toBe("🇪🇨");
    expect(flagEmoji("BR")).toBe("🇧🇷");
    expect(flagEmoji("ec")).toBe("🇪🇨"); // lower-case is upper-cased
    expect(flagEmoji("X")).toBe(""); // not two letters
  });

  it("recognizes valid ISO codes and rejects unknown/empty", () => {
    expect(isValidCountryIso("EC")).toBe(true);
    expect(isValidCountryIso("BR")).toBe(true);
    expect(isValidCountryIso("XX")).toBe(false);
    expect(isValidCountryIso("")).toBe(false);
  });
});

describe("composeE164", () => {
  it("prepends the dial to a national number, stripping non-digits and trunk zeros", () => {
    expect(composeE164("593", "0987654321")).toBe("+593987654321"); // trunk 0 dropped
    expect(composeE164("593", "98 765-4321")).toBe("+593987654321"); // spaces/dashes
    expect(composeE164("34", "612345678")).toBe("+34612345678"); // ES
  });

  it("respects a full international number pasted with '+' (no double dial)", () => {
    expect(composeE164("593", "+593987654321")).toBe("+593987654321");
    expect(composeE164("55", "+55 11 99999-8888")).toBe("+5511999998888");
  });

  it("does NOT strip a bare-digit dial prefix that is really a local area code", () => {
    // Brazil dial 55, area code 55 (Rio Grande do Sul): "55 9999-8888" typed local
    // must still get the country code prepended → not treated as duplicated dial.
    expect(composeE164("55", "5599998888")).toBe("+55" + "5599998888");
  });
});

describe("validateEnrollInput", () => {
  const valid = {
    firstName: "Marcos",
    lastName: "Pérez",
    phoneE164: "+593987654321",
    countryIso: "EC",
  };

  it("accepts and trims a valid payload", () => {
    const out = validateEnrollInput({
      firstName: "  Marcos ",
      lastName: " Pérez ",
      phoneE164: " +593987654321 ",
      countryIso: " ec ",
    });
    expect(out).toEqual(valid);
  });

  it("accepts a known countryIso and rejects an unknown one with 422", () => {
    expect(validateEnrollInput({ ...valid, countryIso: "br" }).countryIso).toBe(
      "BR",
    );
    for (const iso of ["XX", "", "123", undefined]) {
      expect(() =>
        validateEnrollInput({ ...valid, countryIso: iso }),
      ).toThrowError(
        expect.objectContaining({ status: 422, code: "invalid_country" }),
      );
    }
  });

  it("rejects a non-E.164 phone with 422 invalid_phone", () => {
    for (const phone of ["593987654321", "+0987654321", "abc", "+", ""]) {
      expect(() =>
        validateEnrollInput({ ...valid, phoneE164: phone }),
      ).toThrowError(
        expect.objectContaining({ status: 422, code: "invalid_phone" }),
      );
    }
  });

  it("rejects an empty name with 422", () => {
    expect(() =>
      validateEnrollInput({ ...valid, firstName: "   " }),
    ).toThrowError(
      expect.objectContaining({ status: 422, code: "invalid_name" }),
    );
  });

  it("rejects a name over 120 chars with 422", () => {
    expect(() =>
      validateEnrollInput({ ...valid, lastName: "x".repeat(121) }),
    ).toThrowError(
      expect.objectContaining({ status: 422, code: "invalid_name" }),
    );
  });

  it("rejects a non-object body with 422", () => {
    expect(() => validateEnrollInput(null)).toThrowError(ConsumerError);
    expect(() => validateEnrollInput("nope")).toThrowError(ConsumerError);
  });
});
