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
    qrToken: "SUPER-SECRET-QR-TOKEN",
    createdAt: new Date("2026-08-14T00:00:00Z"),
    updatedAt: new Date("2026-08-14T00:00:00Z"),
  };

  it("account DTO omits the raw qrToken and derives phoneVerified", () => {
    const dto = consumerAccountResponse(account);
    expect(dto).not.toHaveProperty("qrToken");
    expect(JSON.stringify(dto)).not.toContain("SUPER-SECRET-QR-TOKEN");
    expect(dto).toMatchObject({
      id: "acc-1",
      firstName: "Marcos",
      lastName: "Pérez",
      phoneE164: "+593987654321",
      phoneVerified: false,
    });
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

describe("validateEnrollInput", () => {
  const valid = {
    firstName: "Marcos",
    lastName: "Pérez",
    phoneE164: "+593987654321",
  };

  it("accepts and trims a valid payload", () => {
    const out = validateEnrollInput({
      firstName: "  Marcos ",
      lastName: " Pérez ",
      phoneE164: " +593987654321 ",
    });
    expect(out).toEqual(valid);
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
