import { readdir, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The probe↔cropper contract of spec 0052 §3: **one resolution, zero divergence**.
 *
 * Before this spec the probe approved a file through its own object URL and the modal
 * created a second one to render — so on an iPhone, where the Photo Library's blob URLs are
 * flaky, "the browser can decode it" and "the modal shows it" were answers to two different
 * questions. The hook now owns the `src` the probe actually loaded (and its revoke), and
 * `ImageCropper` only renders what it is handed.
 *
 * This reads sources because the merchant vitest env is `node` (no jsdom) and `.tsx` files
 * are never executed by the runner. Two lessons from `CLAUDE.md` are baked in: the sweep
 * matches **both** JSX spellings (`prop={expr}` and `prop="literal"`), and it asserts a
 * floor on what it scanned — a sweep that silently scans nothing is green and worthless.
 */

const APP = new URL("../", import.meta.url);
const CROPPER = new URL("./image-cropper.tsx", import.meta.url);
const HOOKS = [
  "backoffice/brand/use-brand-logo.ts",
  "backoffice/catalog/use-catalog-image.ts",
  "backoffice/loyalty/use-stamp-upload.ts",
] as const;

/** Both spellings of a JSX attribute: `name={expr}` and `name="literal"`. */
function attribute(name: string) {
  return new RegExp(`${name}=(?:\\{([^}]*)\\}|"([^"]*)")`);
}

async function tsxUnderApp() {
  const entries = await readdir(APP, { recursive: true, withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".tsx")) continue;
    files.push(`${entry.parentPath}/${entry.name}`);
  }
  return files;
}

describe("the cropper renders the src the probe resolved, and mints none of its own", () => {
  it("takes a `src` prop and never calls createObjectURL", async () => {
    const source = await readFile(CROPPER, "utf8");
    expect(source).toMatch(/^\s*src: string;$/m);
    // The bug shape: a second URL for the same file, created where the probe cannot see it.
    expect(source).not.toContain("createObjectURL");
    expect(source).not.toContain("revokeObjectURL");
    // …and both the preview and the export read that same src.
    expect(source).toContain("image={src}");
    expect(source).toContain("loadImageElement(src)");
  });

  it("is mounted with `src` (never `file`) everywhere it is used", async () => {
    const files = await tsxUnderApp();
    const element = /<ImageCropper\b([\s\S]*?)\/>/g;
    const offenders: string[] = [];
    let mounts = 0;
    for (const path of files) {
      const source = await readFile(path, "utf8");
      for (const match of source.matchAll(element)) {
        mounts += 1;
        const props = match[1] ?? "";
        const src = attribute("src").exec(props);
        const value = src?.[1] ?? src?.[2];
        if (!value?.includes("pendingSrc")) {
          offenders.push(`${path}: src is ${value ?? "missing"}`);
        }
        // The old prop is gone; a leftover would mean a surface still passes the raw File.
        if (attribute("file").test(props))
          offenders.push(`${path}: still passes file=`);
      }
    }
    expect(offenders).toEqual([]);
    // Floors: an empty sweep would make `offenders` trivially empty and this test permanent
    // decoration. Three surfaces mount the cropper (brand, stamp, catalog).
    expect(files.length).toBeGreaterThan(50);
    expect(mounts).toBe(3);
  });
});

describe("the three upload hooks own the resolved src", () => {
  it("each hook resolves once, exposes `pendingSrc` and releases it", async () => {
    for (const hook of HOOKS) {
      const source = await readFile(new URL(hook, APP), "utf8");
      expect(source).toContain("resolveDecodableImage");
      // Semantics of `decideImageChoice` unchanged: it is fed `resolved !== null`.
      expect(source).toContain("decideImageChoice(file, resolved !== null)");
      expect(source).toContain("setPendingSrc(resolved.src)");
      expect(source).toContain("releasePending.current = resolved.cleanup");
      // Cancel, confirm, remove and unmount all go through the single release path.
      expect(source).toContain("releasePending.current?.()");
      expect(source).toMatch(/\n {4}pendingSrc,\n/);
      expect(source).not.toContain("canDecodeImage");
    }
  });

  it("nothing in the app still imports the removed canDecodeImage probe", async () => {
    const entries = await readdir(new URL("../", APP), {
      recursive: true,
      withFileTypes: true,
    });
    const offenders: string[] = [];
    let scanned = 0;
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!/\.tsx?$/.test(entry.name)) continue;
      // Tests name the removed API in prose on purpose; only shipped code is swept.
      if (/\.test\.tsx?$/.test(entry.name)) continue;
      scanned += 1;
      const path = `${entry.parentPath}/${entry.name}`;
      const source = await readFile(path, "utf8");
      if (source.includes("canDecodeImage")) offenders.push(path);
    }
    expect(offenders).toEqual([]);
    expect(scanned).toBeGreaterThan(100);
  });
});
