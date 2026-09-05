/**
 * "Can this browser open this file, and through which `src`?" — the decode probe behind the
 * best-effort cropper (spec 0040, ADR 0047 §1; rebuilt by spec 0052).
 *
 * It lives apart from `crop-image.ts` because it answers a different question: that module is
 * crop geometry and canvas export, this one is the browser's decoder. Neither imports
 * `react-easy-crop`, so both travel with the page instead of the deferred cropper chunk.
 *
 * The iPhone QA that forced the rewrite: photos from the **camera** cropped fine, files from
 * the **Photo Library** never opened the modal — not even a PNG. Three quirks of WebKit,
 * three layers below.
 */

/** Total budget for the probe: blob URL attempt **plus** data URL retry (spec 0052 §4). */
export const DECODE_PROBE_TIMEOUT_MS = 8_000;

/**
 * A file the browser proved it can paint, together with **the exact `src` that worked**.
 *
 * The cropper renders this `src` instead of minting its own object URL: before spec 0052 the
 * probe approved through one URL and the modal loaded through another, so a browser that
 * only manages one of the two got a modal with nothing in it (or no modal at all).
 */
export type DecodableImage = {
  src: string;
  /** Idempotent. Revokes the object URL when `src` is one; a no-op for a data URL. */
  cleanup: () => void;
};

/**
 * Loads `src` into an `<img>` and answers whether the browser actually painted pixels.
 *
 * **`image.decode()` is deliberately absent** (spec 0052 §1). WebKit rejects it spuriously
 * for blob URLs of Photo Library files, and the old probe treated that rejection as a veto
 * *even after* `load` had fired with real dimensions — which is the browser telling us it
 * already decoded the image in order to measure it. Formats a browser cannot open (HEIC
 * outside Safari — ADR 0047) fire `error`, not `load`, so the genuine fallback survives.
 */
function probeSrc(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const image = new Image();
      image.onload = () =>
        resolve(image.naturalWidth > 0 && image.naturalHeight > 0);
      image.onerror = () => resolve(false);
      image.src = src;
    } catch {
      resolve(false);
    }
  });
}

/** `FileReader` → data URL, never throwing: a failure is just "no retry available". */
function readDataUrl(file: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof FileReader === "undefined") {
      resolve(null);
      return;
    }
    try {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Settles `promise`, or `fallback` if it has not settled within `ms`. Used twice: once per
 * step, so a load that never answers still leaves budget for the retry, and once over the
 * whole thing, so `resolveDecodableImage` always settles.
 */
function within<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

/**
 * Asks the browser the only question that matters — "can you open this file?" — and hands
 * back the `src` through which it answered yes, or `null` for the silent fallback.
 *
 * Detection is **by behaviour, never by user-agent** (spec 0040, decision 3). Three layers,
 * all of them born from the iPhone QA of spec 0052 (camera worked, gallery never did):
 *
 * 1. the blob URL attempt, without the `decode()` veto;
 * 2. **one** retry through a data URL, because iOS Safari materialises Photo Library files
 *    lazily and their blob URLs are flaky — the retry has to fire when the blob URL *fails*
 *    **and** when it simply never answers, which is why the first step gets half the budget
 *    rather than waiting on a load that will never come;
 * 3. a total timeout, because a probe that never settles leaves `choose()` hanging — no
 *    modal *and* no fallback, which is strictly worse than a fallback too many.
 */
export async function resolveDecodableImage(
  file: Blob,
  timeoutMs: number = DECODE_PROBE_TIMEOUT_MS,
): Promise<DecodableImage | null> {
  if (typeof Image === "undefined") return null;
  const live = new Set<string>();
  const revoke = (url: string) => {
    if (!live.delete(url)) return;
    try {
      URL.revokeObjectURL(url);
    } catch {
      // A revoke that throws cannot be recovered from and must not mask the answer.
    }
  };
  const cleanup = () => {
    for (const url of [...live]) revoke(url);
  };
  /** Per-step slice of the budget, so one silent load cannot eat the retry's share. */
  const step = Math.max(1, Math.round(timeoutMs / 2));

  const attempt = async (): Promise<DecodableImage | null> => {
    if (
      typeof URL !== "undefined" &&
      typeof URL.createObjectURL === "function"
    ) {
      let objectUrl: string | null = null;
      try {
        objectUrl = URL.createObjectURL(file);
      } catch {
        objectUrl = null;
      }
      if (objectUrl) {
        live.add(objectUrl);
        const ok = await within(probeSrc(objectUrl), step, false);
        if (ok) return { src: objectUrl, cleanup };
        // Useless now: free it before spending memory on the base64 copy.
        revoke(objectUrl);
      }
    }
    const dataUrl = await within(readDataUrl(file), step, null);
    if (dataUrl && (await probeSrc(dataUrl))) return { src: dataUrl, cleanup };
    return null;
  };

  // Losing the total race leaves the pending load dangling inside the browser; what must
  // not dangle is the object URL, so it is revoked here and a late `attempt` finds nothing.
  const resolved = await within(attempt(), timeoutMs, null);
  if (!resolved) cleanup();
  return resolved;
}
