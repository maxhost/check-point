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
import {
  ACCEPTED_IMAGE_CONTENT_TYPES,
  ACCEPTED_IMAGE_CONTENT_TYPE_SET,
  isAcceptedImageType,
} from "../lib/image-formats";

const BUSINESS = "11111111-1111-4111-8111-111111111111";
const byteSize = 1024;

// image/jpg is the non-IANA alias several Android pickers/gallery apps report for .jpg
// files (image/jpeg is the registered type) — a real jpeg was bounced before it was added.
const MOBILE_TYPES = [
  "image/heic",
  "image/heif",
  "image/avif",
  "image/jpg",
] as const;

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

// The same bug, appearance after appearance (specs 0033, 0039, 0040 QA, and the 0040 review
// that found it still alive in the two demo pages): a narrow, hardcoded content-type list
// next to the shared one. A `<input accept="image/png,image/jpeg,image/webp">` stops an
// Android/iPhone user from even picking the HEIC photo that the presign and `sharp` accept.
//
// This reads the sources, because the merchant vitest env is `node` (no jsdom) and these are
// `.tsx` files the runner never executes. Two layers: an exact pin on the three upload
// surfaces, and a sweep over **every** `.tsx` under `app/` that catches both spellings of the
// attribute — `accept={...}` and `accept="..."`. The first version of the sweep only matched
// the braces form, which is precisely why the two demo pages survived it.
describe("the file inputs of the three upload surfaces share the accept list", () => {
  const EXPECTED = 'accept={isTouch ? "image/*" : ACCEPTED_IMAGE_ACCEPT_ATTR}';
  const SURFACES = {
    brand: "src/app/backoffice/brand/brand-page.tsx",
    stamp: "src/app/backoffice/loyalty/steps/step-card-design.tsx",
    catalog: "src/app/backoffice/catalog/product-image-field.tsx",
  } as const;

  for (const [surface, file] of Object.entries(SURFACES)) {
    it(`${surface} uses ACCEPTED_IMAGE_ACCEPT_ATTR and no hardcoded list`, async () => {
      const { readFile } = await import("node:fs/promises");
      const source = await readFile(
        new URL(`../../${file}`, import.meta.url),
        "utf8",
      );
      expect(source).toContain(EXPECTED);
      // …and imports it from the single source of truth rather than redeclaring it.
      expect(source).toMatch(
        /import \{[^}]*ACCEPTED_IMAGE_ACCEPT_ATTR[^}]*\} from "(\.\.\/)+lib\/image-formats"/s,
      );
      // No comma-joined MIME list anywhere in the file: that is the bug shape.
      expect(source).not.toMatch(/image\/[a-z+]+,image\//);
    });
  }

  // Both spellings: `accept={expr}` and `accept="literal"`. The demo pages used the second
  // one and went unnoticed for three rounds.
  const ACCEPT_ATTR = /accept=(?:\{([^}]*)\}|"([^"]*)")/g;

  it("finds no hardcoded accept list in ANY .tsx under app/ (demo pages included)", async () => {
    const { readdir, readFile } = await import("node:fs/promises");
    const root = new URL("../app/", import.meta.url);
    const offenders: string[] = [];
    let scanned = 0;
    let attributes = 0;
    const entries = await readdir(root, {
      recursive: true,
      withFileTypes: true,
    });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".tsx")) continue;
      scanned += 1;
      const path = `${entry.parentPath}/${entry.name}`;
      const source = await readFile(path, "utf8");
      for (const match of source.matchAll(ACCEPT_ATTR)) {
        attributes += 1;
        const value = match[1] ?? match[2] ?? "";
        if (!value.includes("ACCEPTED_IMAGE_ACCEPT_ATTR")) {
          offenders.push(`${path}: ${match[0]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
    // Guard against the sweep silently scanning nothing (a moved directory, a broken glob):
    // an empty run would make `offenders` trivially empty and the test permanently green.
    expect(scanned).toBeGreaterThan(50);
    expect(attributes).toBeGreaterThanOrEqual(5);
  });
});

// The other half of the same DoD line: the three hooks must validate against the shared
// `ACCEPTED_IMAGE_CONTENT_TYPE_SET` via `isAcceptedImageType`, not with a looser rule of
// their own. `use-catalog-image` used `file.type.startsWith("image/")`, which let an SVG
// through the browser guard to be rejected by the presign. Reverting any of the three now
// turns this red.
describe("the three upload hooks share the client-side type guard", () => {
  const HOOKS = {
    brand: "src/app/backoffice/brand/use-brand-logo.ts",
    stamp: "src/app/backoffice/loyalty/use-stamp-upload.ts",
    catalog: "src/app/backoffice/catalog/use-catalog-image.ts",
  } as const;

  for (const [surface, file] of Object.entries(HOOKS)) {
    it(`${surface} guards with isAcceptedImageType and nothing of its own`, async () => {
      const { readFile } = await import("node:fs/promises");
      const source = await readFile(
        new URL(`../../${file}`, import.meta.url),
        "utf8",
      );
      expect(source).toMatch(
        /import \{[^}]*isAcceptedImageType[^}]*\} from "(\.\.\/)+lib\/image-formats"/s,
      );
      expect(source).toContain("isAcceptedImageType(file.type)");
      // The looser rule this replaced.
      expect(source).not.toContain('startsWith("image/');
      // No MIME literal at all: a private list is the bug shape.
      expect(source).not.toMatch(/"image\/[a-z+]+"/);
    });
  }
});

// `isAcceptedImageType` is that shared guard. It mirrors the presign allow-list exactly —
// including the empty type, which the presign rejects (`""` is not in the set), so tolerating
// it in the browser would only swap a message naming the formats for a generic presign error.
describe("isAcceptedImageType mirrors the presign allow-list", () => {
  it("accepts every type in the shared list, mobile formats included", () => {
    for (const type of ACCEPTED_IMAGE_CONTENT_TYPES) {
      expect(isAcceptedImageType(type)).toBe(true);
    }
    expect(ACCEPTED_IMAGE_CONTENT_TYPES).toContain("image/heic");
    expect(ACCEPTED_IMAGE_CONTENT_TYPES).toContain("image/heif");
    expect(ACCEPTED_IMAGE_CONTENT_TYPES).toContain("image/avif");
  });

  it("rejects other image types, non-images and the empty/absent type", () => {
    expect(isAcceptedImageType("image/svg+xml")).toBe(false);
    expect(isAcceptedImageType("image/gif")).toBe(false);
    expect(isAcceptedImageType("application/pdf")).toBe(false);
    expect(isAcceptedImageType("")).toBe(false);
    expect(isAcceptedImageType(undefined)).toBe(false);
    expect(isAcceptedImageType(null)).toBe(false);
  });

  it("is exactly the set the presign checks — no extra tolerance", () => {
    for (const type of ["", "image/svg+xml", "image/gif", "application/pdf"]) {
      expect(ACCEPTED_IMAGE_CONTENT_TYPE_SET.has(type)).toBe(
        isAcceptedImageType(type),
      );
    }
  });
});
