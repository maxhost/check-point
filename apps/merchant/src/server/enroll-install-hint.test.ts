import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Spec 0050 — the enroll confirmation must NOT teach "add to home screen" any more.
 * Installing from that screen made iOS capture the enroll URL as the icon's start_url
 * (that page links no manifest), so the icon reopened the signup form. The hint lives in
 * `/wallet`, where the manifest carries the token (ADR 0048) and where it already hides
 * itself in standalone.
 *
 * There is no jsdom in this package (vitest `environment: "node"`, `*.test.ts` only), so
 * this is a static sweep of the sources. It is written to fail loudly rather than pass
 * vacuously: every file read is asserted non-trivial and the enroll tree is asserted to
 * hold the files it is supposed to hold.
 */

const CONSUMER = join(import.meta.dirname, "../app/(consumer)");

function source(relative: string): string {
  const text = readFileSync(join(CONSUMER, relative), "utf8");
  // A truncated/empty read must not read as "no hint here" (qr-tab.tsx is the
  // smallest file swept, ~800 bytes).
  expect(text.length, `${relative} looks empty`).toBeGreaterThan(400);
  return text;
}

describe("enroll confirmation no longer hosts the iOS install hint (spec 0050)", () => {
  const enrollForm = source("enroll/[programId]/enroll-form.tsx");

  it("does not reference IosInstallHint anywhere in the enroll tree", () => {
    const dir = join(CONSUMER, "enroll/[programId]");
    const files = readdirSync(dir).filter((f) => f.endsWith(".tsx"));
    // Floor: an empty listing (moved/renamed tree) must not pass as "clean".
    expect(files.length).toBeGreaterThanOrEqual(2);
    for (const file of files) {
      expect(source(`enroll/[programId]/${file}`), file).not.toContain(
        "IosInstallHint",
      );
    }
  });

  it("sends the consumer to the wallet instead", () => {
    expect(enrollForm).toContain('href="/wallet"');
  });

  it("keeps the Android/desktop Web Push opt-in on the confirmation (spec 0038)", () => {
    expect(enrollForm).toContain("<PushPrompt");
    expect(enrollForm).toContain("vapidPublicKey={vapidPublicKey}");
  });

  it("still short-circuits iOS Safari so PushPrompt cannot render the hint back in", () => {
    // `PushPrompt` returns <IosInstallHint/> when iOS && !standalone: rendering it
    // unconditionally here would reintroduce exactly what the spec removes.
    expect(enrollForm).toMatch(
      /isIosSafariBrowser\(\)\s*\?\s*null\s*:\s*\(?\s*<PushPrompt/,
    );
  });
});

describe("the iOS install hint still lives on /wallet (spec 0050 leaves it alone)", () => {
  it("qr-tab renders PushPrompt, which renders the hint outside standalone", () => {
    expect(source("wallet/qr-tab.tsx")).toContain("<PushPrompt");
    const pushPrompt = source("push-prompt.tsx");
    expect(pushPrompt).toContain("<IosInstallHint");
    expect(pushPrompt).toMatch(/isIos\s*&&\s*!isStandalone/);
  });

  it("standalone detection still covers both display-mode and navigator.standalone", () => {
    const hint = source("ios-install-hint.tsx");
    expect(hint).toContain('matchMedia("(display-mode: standalone)")');
    expect(hint).toContain("standalone === true");
  });
});
