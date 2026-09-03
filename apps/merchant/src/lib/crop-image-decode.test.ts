import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { canDecodeImage, decideImageChoice } from "./crop-image";

/**
 * The decode probe and the fallback branch it feeds (spec 0040, ADR 0047 §1).
 *
 * The merchant vitest env is `node`, so `Image` is `undefined` and `canDecodeImage` would
 * short-circuit on its own guard without exercising anything. These tests **inject a fake
 * `globalThis.Image`** so every path runs for real: `onerror`, a `load` that yields a 0-wide
 * image, a `decode()` that rejects, and the happy case. The object URL must be revoked in
 * all of them — a leak here holds the whole file in memory on a phone.
 */

type ImageBehaviour = {
  event: "load" | "error";
  naturalWidth?: number;
  naturalHeight?: number;
  decode?: () => Promise<void>;
};

let behaviour: ImageBehaviour = { event: "load" };

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 0;
  naturalHeight = 0;
  decode?: () => Promise<void>;
  #src = "";

  constructor() {
    if (behaviour.decode) this.decode = behaviour.decode;
  }

  get src() {
    return this.#src;
  }

  /** Assigning `src` is what starts the load in a browser; mirror that asynchronously. */
  set src(value: string) {
    this.#src = value;
    queueMicrotask(() => {
      if (behaviour.event === "error") {
        this.onerror?.();
        return;
      }
      this.naturalWidth = behaviour.naturalWidth ?? 0;
      this.naturalHeight = behaviour.naturalHeight ?? 0;
      this.onload?.();
    });
  }
}

type GlobalWithImage = { Image?: typeof Image };

const OBJECT_URL = "blob:merchant/fake-object-url";
const FILE = new Blob(["bytes"], { type: "image/heic" });

const realCreate = URL.createObjectURL;
const realRevoke = URL.revokeObjectURL;
let revoked: string[] = [];
let createFails = false;

beforeEach(() => {
  revoked = [];
  createFails = false;
  behaviour = { event: "load", naturalWidth: 4032, naturalHeight: 3024 };
  URL.createObjectURL = () => {
    if (createFails) throw new Error("no object URL");
    return OBJECT_URL;
  };
  URL.revokeObjectURL = (url: string) => {
    revoked.push(url);
  };
  (globalThis as GlobalWithImage).Image = FakeImage as unknown as typeof Image;
});

afterEach(() => {
  URL.createObjectURL = realCreate;
  URL.revokeObjectURL = realRevoke;
  delete (globalThis as GlobalWithImage).Image;
});

describe("canDecodeImage", () => {
  it("returns false when the image fires onerror (HEIC outside Safari)", async () => {
    behaviour = { event: "error" };
    await expect(canDecodeImage(FILE)).resolves.toBe(false);
    // Even on the error path the object URL is released.
    expect(revoked).toEqual([OBJECT_URL]);
  });

  it("returns false when it loads but has no pixels (naturalWidth 0)", async () => {
    behaviour = { event: "load", naturalWidth: 0, naturalHeight: 0 };
    await expect(canDecodeImage(FILE)).resolves.toBe(false);
    expect(revoked).toEqual([OBJECT_URL]);
  });

  it("returns false when the load fires but decode() rejects", async () => {
    behaviour = {
      event: "load",
      naturalWidth: 800,
      naturalHeight: 600,
      decode: () => Promise.reject(new Error("cannot rasterize")),
    };
    await expect(canDecodeImage(FILE)).resolves.toBe(false);
    expect(revoked).toEqual([OBJECT_URL]);
  });

  it("returns true for an image that loads with real dimensions", async () => {
    behaviour = {
      event: "load",
      naturalWidth: 4032,
      naturalHeight: 3024,
      decode: () => Promise.resolve(),
    };
    await expect(canDecodeImage(FILE)).resolves.toBe(true);
    expect(revoked).toEqual([OBJECT_URL]);
  });

  it("returns false without leaking a URL when createObjectURL throws", async () => {
    createFails = true;
    await expect(canDecodeImage(FILE)).resolves.toBe(false);
    expect(revoked).toEqual([]);
  });

  it("returns false where there is no Image constructor at all (SSR)", async () => {
    delete (globalThis as GlobalWithImage).Image;
    await expect(canDecodeImage(FILE)).resolves.toBe(false);
    expect(revoked).toEqual([]);
  });
});

describe("decideImageChoice (the fallback branch of the three hooks)", () => {
  const original = new File(["raw heic bytes"], "IMG_0042.HEIC", {
    type: "image/heic",
  });

  it("falls back to uploading the ORIGINAL file, untouched, when decode fails", () => {
    const choice = decideImageChoice(original, false);
    expect(choice.mode).toBe("fallback");
    if (choice.mode !== "fallback") throw new Error("unreachable");
    // Identity, not a copy: the pre-cropper behaviour is "upload this very file".
    expect(choice.selected).toBe(original);
    expect(choice.selected.name).toBe("IMG_0042.HEIC");
    expect(choice.selected.type).toBe("image/heic");
    expect(choice.selected.size).toBe(original.size);
    // …and it is not flagged as cropped, so the server keeps the 50 MP decode bound.
    expect(choice.cropped).toBe(false);
  });

  it("parks a decodable file for the cropper instead of uploading it", () => {
    const choice = decideImageChoice(original, true);
    expect(choice.mode).toBe("crop");
    if (choice.mode !== "crop") throw new Error("unreachable");
    expect(choice.pending).toBe(original);
  });

  it("wires the real probe to the real decision: undecodable ⇒ fallback", async () => {
    behaviour = { event: "error" };
    const choice = decideImageChoice(original, await canDecodeImage(original));
    expect(choice).toEqual({
      mode: "fallback",
      selected: original,
      cropped: false,
    });
  });
});
