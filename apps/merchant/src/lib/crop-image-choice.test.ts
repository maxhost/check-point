import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decideImageChoice } from "./crop-image";
import { resolveDecodableImage } from "./image-decode-probe";

/**
 * The branch of the three upload hooks: probe answers → `crop` or silent `fallback`
 * (spec 0040, ADR 0047 §1). `decideImageChoice` keeps the semantics it always had; what
 * changed in spec 0052 is the input — `resolved !== null` instead of `canDecodeImage`.
 *
 * The last two cases wire the **real** probe to the **real** decision through a fake
 * `Image`, which is what pins the regression: an image that fires `load` with real
 * dimensions but whose `decode()` rejects (the iPhone gallery case) must end up in `crop`.
 * The probe layers themselves are covered in `crop-image-decode.test.ts`.
 */

let event: "load" | "error" = "load";
const OBJECT_URL = "blob:merchant/choice";

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 0;
  naturalHeight = 0;
  /** Rejecting, like WebKit does for Photo Library blob URLs. */
  decode = () => Promise.reject(new Error("cannot rasterize"));
  #src = "";

  get src() {
    return this.#src;
  }

  set src(value: string) {
    this.#src = value;
    queueMicrotask(() => {
      if (event === "error") {
        this.onerror?.();
        return;
      }
      this.naturalWidth = 1200;
      this.naturalHeight = 900;
      this.onload?.();
    });
  }
}

type Globals = { Image?: typeof Image; FileReader?: typeof FileReader };
const realCreate = URL.createObjectURL;
const realRevoke = URL.revokeObjectURL;

beforeEach(() => {
  event = "load";
  URL.createObjectURL = () => OBJECT_URL;
  URL.revokeObjectURL = () => undefined;
  (globalThis as Globals).Image = FakeImage as unknown as typeof Image;
});

afterEach(() => {
  URL.createObjectURL = realCreate;
  URL.revokeObjectURL = realRevoke;
  delete (globalThis as Globals).Image;
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
    // No `FileReader` in this file's globals either, so the data URL retry has nowhere to go.
    event = "error";
    const resolved = await resolveDecodableImage(original);
    const choice = decideImageChoice(original, resolved !== null);
    expect(choice).toEqual({
      mode: "fallback",
      selected: original,
      cropped: false,
    });
  });

  it("wires the real probe to the real decision: a rejecting decode() ⇒ crop", async () => {
    // The regression of spec 0052: this used to come back as `fallback`.
    const resolved = await resolveDecodableImage(original);
    const choice = decideImageChoice(original, resolved !== null);
    expect(choice).toEqual({ mode: "crop", pending: original });
    resolved?.cleanup();
  });
});
