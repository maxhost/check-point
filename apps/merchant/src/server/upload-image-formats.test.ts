import { describe, expect, it, vi } from "vitest";

// Both prep functions insert an upload row and then presign a PUT. Mock the DB and the
// presigner so the accept path can run without Neon/R2 — the assertion under test is the
// content-type allow-list gate, which is the shared `ACCEPTED_IMAGE_CONTENT_TYPE_SET`.
vi.mock("./db", () => ({
  getDb: () => ({
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
