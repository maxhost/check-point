import { describe, expect, it } from "vitest";
import {
  type ConsumerAccountRow,
  consumerAccountResponse,
  generateOpaqueToken,
  hashToken,
  membershipResponse,
} from "@mi-pasaporte/domain/server/consumer/core";
import {
  E164,
  composeE164,
  flagEmoji,
  isValidCountryIso,
} from "@mi-pasaporte/domain/lib/countries";

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
    email: "marcos@example.test",
    countryIso: "EC",
    qrToken: "SUPER-SECRET-QR-TOKEN",
    webViewToken: "SUPER-SECRET-WEB-VIEW-TOKEN",
    createdAt: new Date("2026-08-14T00:00:00Z"),
    updatedAt: new Date("2026-08-14T00:00:00Z"),
  };

  it("account DTO omits the raw qrToken/webViewToken", () => {
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
      email: "marcos@example.test",
      countryIso: "EC",
    });
    // Spec 0119: no `phoneVerified` anymore (the identity is the provider's, ADR 0111).
    expect(dto).not.toHaveProperty("phoneVerified");
  });

  it("account DTO exposes countryIso (metadata, not a secret) incl. null", () => {
    expect(consumerAccountResponse(account).countryIso).toBe("EC");
    expect(
      consumerAccountResponse({ ...account, countryIso: null }).countryIso,
    ).toBeNull();
  });

  it("account DTO of an account born from a provider: phone and country null (spec 0119)", () => {
    const dto = consumerAccountResponse({
      ...account,
      phoneE164: null,
      countryIso: null,
    });
    expect(dto.phoneE164).toBeNull();
    expect(dto.countryIso).toBeNull();
  });

  it("membership DTO exposes only its public fields", () => {
    const dto = membershipResponse({
      id: "mem-1",
      programId: "prog-1",
      businessId: "biz-1",
      enrolledAt: new Date("2026-08-14T00:00:00Z"),
      originLocationId: "loc-1",
    });
    expect(dto).not.toHaveProperty("tokenHash");
    expect(dto).not.toHaveProperty("qrToken");
    // origin_location_id is internal attribution (ADR 0042); never in the client DTO.
    expect(dto).not.toHaveProperty("originLocationId");
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

describe("E164 (the merchant's search by phone)", () => {
  it("accepts an international number and rejects the rest", () => {
    expect(E164.test("+593987654321")).toBe(true);
    for (const phone of ["593987654321", "+0987654321", "abc", "+", ""]) {
      expect(E164.test(phone)).toBe(false);
    }
  });
});
