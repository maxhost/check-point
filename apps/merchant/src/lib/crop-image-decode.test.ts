import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DECODE_PROBE_TIMEOUT_MS,
  resolveDecodableImage,
} from "./image-decode-probe";

/**
 * The decode probe and the fallback branch it feeds (spec 0040, ADR 0047 §1, rewritten by
 * spec 0052 after the iPhone QA: the camera cropped fine, the Photo Library never did).
 *
 * The merchant vitest env is `node`, so `Image` and `FileReader` are `undefined` and the
 * probe would short-circuit on its own guard without exercising anything. These tests
 * **inject fakes for `Image`, `FileReader` and `URL.createObjectURL`** so every layer runs
 * for real: the blob URL attempt, the data URL retry, the timeout, and the revoking that
 * must happen on all three — a leaked object URL pins the whole file in a phone's memory.
 *
 * The fake `Image` reacts to the `src` it is given, which is the only way to tell the two
 * paths apart: `blob:` vs `data:`.
 */

type Outcome = {
  event: "load" | "error" | "never";
  naturalWidth?: number;
  naturalHeight?: number;
};

const OBJECT_URL = "blob:merchant/fake-object-url";
const DATA_URL = "data:image/png;base64,ZmFrZQ==";
const FILE = new Blob(["bytes"], { type: "image/heic" });

const LOADS: Outcome = {
  event: "load",
  naturalWidth: 4032,
  naturalHeight: 3024,
};
const FAILS: Outcome = { event: "error" };
const HANGS: Outcome = { event: "never" };

/** What the fake `Image` does per kind of src, plus what the fake `FileReader` returns. */
let onBlobUrl: Outcome = LOADS;
let onDataUrl: Outcome = LOADS;
let dataUrlResult: "ok" | "error" | "never" = "ok";
let decodeCalls = 0;
let createFails = false;
let revoked: string[] = [];
let loaded: string[] = [];

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 0;
  naturalHeight = 0;
  /**
   * Present and **rejecting**, like WebKit does for Photo Library blob URLs. The probe must
   * never call it; `decodeCalls` is asserted to stay at 0.
   */
  decode = () => {
    decodeCalls += 1;
    return Promise.reject(new Error("cannot rasterize"));
  };
  #src = "";

  get src() {
    return this.#src;
  }

  /** Assigning `src` is what starts the load in a browser; mirror that asynchronously. */
  set src(value: string) {
    this.#src = value;
    loaded.push(value);
    const outcome = value.startsWith("data:") ? onDataUrl : onBlobUrl;
    if (outcome.event === "never") return;
    queueMicrotask(() => {
      if (outcome.event === "error") {
        this.onerror?.();
        return;
      }
      this.naturalWidth = outcome.naturalWidth ?? 0;
      this.naturalHeight = outcome.naturalHeight ?? 0;
      this.onload?.();
    });
  }
}

class FakeFileReader {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  result: string | null = null;

  readAsDataURL() {
    if (dataUrlResult === "never") return;
    queueMicrotask(() => {
      if (dataUrlResult === "error") {
        this.onerror?.();
        return;
      }
      this.result = DATA_URL;
      this.onload?.();
    });
  }
}

type Globals = { Image?: typeof Image; FileReader?: typeof FileReader };
const realCreate = URL.createObjectURL;
const realRevoke = URL.revokeObjectURL;

beforeEach(() => {
  revoked = [];
  loaded = [];
  decodeCalls = 0;
  createFails = false;
  onBlobUrl = LOADS;
  onDataUrl = LOADS;
  dataUrlResult = "ok";
  URL.createObjectURL = () => {
    if (createFails) throw new Error("no object URL");
    return OBJECT_URL;
  };
  URL.revokeObjectURL = (url: string) => {
    revoked.push(url);
  };
  (globalThis as Globals).Image = FakeImage as unknown as typeof Image;
  (globalThis as Globals).FileReader =
    FakeFileReader as unknown as typeof FileReader;
});

afterEach(() => {
  URL.createObjectURL = realCreate;
  URL.revokeObjectURL = realRevoke;
  delete (globalThis as Globals).Image;
  delete (globalThis as Globals).FileReader;
});

describe("resolveDecodableImage", () => {
  it("accepts an image that loads with real dimensions even if decode() rejects", async () => {
    // The exact false negative of the iPhone gallery: `load` fired with 4032×3024 and the
    // old probe still answered "undecodable" because `decode()` rejected (spec 0052 §1).
    const resolved = await resolveDecodableImage(FILE);
    expect(resolved?.src).toBe(OBJECT_URL);
    expect(decodeCalls).toBe(0);
    resolved?.cleanup();
    expect(revoked).toEqual([OBJECT_URL]);
  });

  it("retries through a data URL when the blob URL fires onerror, and returns THAT src", async () => {
    onBlobUrl = FAILS;
    const resolved = await resolveDecodableImage(FILE);
    expect(resolved?.src).toBe(DATA_URL);
    // Both paths were attempted, in order, and the useless blob URL was freed already.
    expect(loaded).toEqual([OBJECT_URL, DATA_URL]);
    expect(revoked).toEqual([OBJECT_URL]);
    // `cleanup` on the data URL path is a harmless no-op (nothing left to revoke).
    resolved?.cleanup();
    expect(revoked).toEqual([OBJECT_URL]);
  });

  it("retries through a data URL when the blob URL never answers at all", async () => {
    // The other half of the WebKit quirk: the file provider never materialises the blob, so
    // neither `load` nor `error` ever fires. Without the retry this hung forever.
    vi.useFakeTimers();
    try {
      onBlobUrl = HANGS;
      const pending = resolveDecodableImage(FILE, 400);
      // Half the budget goes to the blob URL; when it expires the retry still has its share.
      await vi.advanceTimersByTimeAsync(400);
      const resolved = await pending;
      expect(resolved?.src).toBe(DATA_URL);
      expect(loaded).toEqual([OBJECT_URL, DATA_URL]);
      expect(revoked).toEqual([OBJECT_URL]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns null when the load succeeds but there are no pixels (naturalWidth 0)", async () => {
    onBlobUrl = { event: "load", naturalWidth: 0, naturalHeight: 0 };
    onDataUrl = { event: "load", naturalWidth: 0, naturalHeight: 0 };
    await expect(resolveDecodableImage(FILE)).resolves.toBeNull();
    expect(revoked).toEqual([OBJECT_URL]);
  });

  it("returns null when BOTH paths fail (HEIC outside Safari) and revokes the URL", async () => {
    onBlobUrl = FAILS;
    onDataUrl = FAILS;
    const resolved = await resolveDecodableImage(FILE);
    expect(resolved).toBeNull();
    expect(loaded).toEqual([OBJECT_URL, DATA_URL]);
    expect(revoked).toEqual([OBJECT_URL]);
  });

  it("returns null when the blob URL fails and the FileReader fails too", async () => {
    onBlobUrl = FAILS;
    dataUrlResult = "error";
    await expect(resolveDecodableImage(FILE)).resolves.toBeNull();
    expect(loaded).toEqual([OBJECT_URL]);
    expect(revoked).toEqual([OBJECT_URL]);
  });

  it("still resolves via the data URL when createObjectURL throws, without leaking", async () => {
    createFails = true;
    const resolved = await resolveDecodableImage(FILE);
    expect(resolved?.src).toBe(DATA_URL);
    expect(revoked).toEqual([]);
  });

  it("returns null where there is no Image constructor at all (SSR)", async () => {
    delete (globalThis as Globals).Image;
    await expect(resolveDecodableImage(FILE)).resolves.toBeNull();
    expect(revoked).toEqual([]);
  });

  it("returns null when no path answers: the timeout settles it and revokes the URL", async () => {
    vi.useFakeTimers();
    try {
      onBlobUrl = HANGS;
      dataUrlResult = "never";
      expect(DECODE_PROBE_TIMEOUT_MS).toBe(8_000); // the budget of spec 0052 §4
      const pending = resolveDecodableImage(FILE, DECODE_PROBE_TIMEOUT_MS);
      let settled = false;
      void pending.then(() => {
        settled = true;
      });
      // One tick short of the budget nothing has answered — and nothing has resolved either.
      await vi.advanceTimersByTimeAsync(DECODE_PROBE_TIMEOUT_MS - 1);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(await pending).toBeNull();
      expect(settled).toBe(true);
      // The URL created for the load that never answered is released anyway.
      expect(revoked).toEqual([OBJECT_URL]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not leave the timer running once an answer arrives", async () => {
    vi.useFakeTimers();
    try {
      const resolved = await resolveDecodableImage(FILE);
      expect(resolved?.src).toBe(OBJECT_URL);
      // A pending timer here would keep a phantom callback alive for 8 s per pick.
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("has an idempotent cleanup: revoking twice revokes once", async () => {
    const resolved = await resolveDecodableImage(FILE);
    resolved?.cleanup();
    resolved?.cleanup();
    expect(revoked).toEqual([OBJECT_URL]);
  });
});
