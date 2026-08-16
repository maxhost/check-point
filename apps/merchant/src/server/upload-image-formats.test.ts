import { describe, expect, it, vi } from "vitest";

// The prep functions insert an upload row and then presign a PUT (brand first resolves the
// owner business via a select). Mock the DB and the presigner so the accept path can run
// without Neon/R2 — the assertion under test is the content-type allow-list gate, which is
// the shared `ACCEPTED_IMAGE_CONTENT_TYPE_SET` (regression guard: brand once shipped a
// narrow list that rejected Android/iPhone HEIC photos — this pins all three surfaces).
const OWNER_BUSINESS = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Café Demo",
  timezone: "UTC",
  currencyCode: "USD",
  brandPrimaryColor: "#176548",
  brandComplementaryColor: "#0E3B2E",
  brandAccentColor: "#E78132",
  logoObjectKey: null,
  brandRevision: 1,
  logoVersion: 0,
};
function selectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => rows,
  };
  return chain;
}
vi.mock("./db", () => ({
  getDb: () => ({
    select: () => selectChain([OWNER_BUSINESS]),
    insert: () => ({ values: async () => undefined }),
    delete: () => ({ where: async () => undefined }),
  }),
}));

vi.mock("./r2", async () => {
  const actual = await vi.importActual<typeof import("./r2")>("./r2");
  return {
    ...actual,
    createTemporaryUploadUrl: vi.fn(async () => "https://r2.example/upload"),
  };
});

import { createStampUpload } from "./loyalty-program/stamp";
import { createProductUpload } from "./catalog";
import { createLogoUpload } from "./brand";

const BUSINESS = "11111111-1111-4111-8111-111111111111";
const byteSize = 1024;

const MOBILE_TYPES = ["image/heic", "image/heif", "image/avif"] as const;

describe("stamp prep upload accepts mobile photo formats", () => {
  for (const contentType of MOBILE_TYPES) {
    it(`presigns an upload for ${contentType}`, async () => {
      const result = await createStampUpload(BUSINESS, {
        contentType,
        byteSize,
      });
      expect(result.uploadUrl).toBe("https://r2.example/upload");
      expect(result.uploadId).toBeTruthy();
    });
  }

  it("still rejects a non-image (application/pdf) with 422", async () => {
    await expect(
      createStampUpload(BUSINESS, {
        contentType: "application/pdf",
        byteSize,
      }),
    ).rejects.toMatchObject({ status: 422 });
  });
});

describe("catalog product prep upload accepts mobile photo formats", () => {
  for (const contentType of MOBILE_TYPES) {
    it(`presigns an upload for ${contentType}`, async () => {
      const result = await createProductUpload(BUSINESS, {
        contentType,
        byteSize,
      });
      expect(result.uploadUrl).toBe("https://r2.example/upload");
      expect(result.uploadId).toBeTruthy();
    });
  }

  it("still rejects a non-image (application/pdf) with 422", async () => {
    await expect(
      createProductUpload(BUSINESS, {
        contentType: "application/pdf",
        byteSize,
      }),
    ).rejects.toMatchObject({ status: 422 });
  });
});

// The bug this guards: brand shipped its own narrow ["jpeg","png","webp"] list, so Android
// (Samsung/Pixel HEIC) and iPhone photos were rejected on the logo upload. It now shares
// ACCEPTED_IMAGE_CONTENT_TYPE_SET like stamp/catalog. `createLogoUpload(userId, value)`
// resolves the owner business (mocked select) before validating the content type.
describe("brand logo prep upload accepts mobile photo formats", () => {
  for (const contentType of MOBILE_TYPES) {
    it(`presigns an upload for ${contentType}`, async () => {
      const result = await createLogoUpload("owner-user-id", {
        contentType,
        byteSize,
      });
      expect(result.uploadUrl).toBe("https://r2.example/upload");
      expect(result.uploadId).toBeTruthy();
    });
  }

  it("still rejects a non-image (application/pdf) with 422", async () => {
    await expect(
      createLogoUpload("owner-user-id", {
        contentType: "application/pdf",
        byteSize,
      }),
    ).rejects.toMatchObject({ status: 422 });
  });
});
