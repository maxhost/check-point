import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Spec 0051 / ADR 0049 — the enroll confirmation is BACK to being the install surface:
 * felicitación + "add to home screen" instructions + Apple Wallet button on ONE screen.
 * What made this safe again (the 0050 bug was real): the 201 now hands the client
 * `walletManifestPath` and the confirmation injects it as `<link rel="manifest">`, so an
 * icon added from that screen opens `/c/<token>` (the consumer's wallet), not the form.
 *
 * There is no jsdom in this package (vitest `environment: "node"`, `*.test.ts` only), so
 * this is a static sweep of the sources. It is written to fail loudly rather than pass
 * vacuously: every file read is asserted non-trivial and the enroll tree is asserted to
 * hold the files it is supposed to hold.
 */

const CONSUMER = join(import.meta.dirname, "../app/(consumer)");

function source(relative: string): string {
  const text = readFileSync(join(CONSUMER, relative), "utf8");
  // A truncated/empty read must not read as "nothing here" (qr-tab.tsx is the
  // smallest file swept, ~800 bytes).
  expect(text.length, `${relative} looks empty`).toBeGreaterThan(400);
  return text;
}

function enrollTreeFiles(): string[] {
  const files = readdirSync(join(CONSUMER, "enroll/[programId]")).filter((f) =>
    f.endsWith(".tsx"),
  );
  // Floor: an empty listing (moved/renamed tree) must not pass as "clean".
  expect(files.length).toBeGreaterThanOrEqual(3);
  return files;
}

describe("the enroll confirmation hosts the install hint again (spec 0051 / ADR 0049)", () => {
  const confirmation = source("enroll/[programId]/enroll-confirmation.tsx");
  const enrollForm = source("enroll/[programId]/enroll-form.tsx");

  it("renders IosInstallHint DIRECTLY for iOS Safari — gated only by the browser check, never by vapidPublicKey", () => {
    // The exact pre-0050 shape: browser check ? hint : push prompt. A hint reachable
    // only through PushPrompt would vanish whenever VAPID is unconfigured.
    expect(confirmation).toMatch(
      /isIosSafariBrowser\(\)\s*\?\s*\(?\s*<IosInstallHint/,
    );
    expect(confirmation).not.toMatch(/vapidPublicKey[^\n]*<IosInstallHint/);
  });

  it("keeps the Android/desktop Web Push opt-in as the non-iOS branch (spec 0038)", () => {
    expect(confirmation).toContain("<PushPrompt");
    expect(confirmation).toContain("vapidPublicKey={vapidPublicKey}");
  });

  it("keeps the Wallet buttons and demotes /wallet to a secondary text link", () => {
    expect(confirmation).toContain("<WalletButtons");
    expect(confirmation).toContain('href="/wallet"');
    // Secondary means link-shaped, not the brand-painted primary button.
    const link = confirmation.slice(confirmation.indexOf('href="/wallet"'));
    expect(link.slice(0, 400)).toContain("textDecoration");
    expect(link.slice(0, 400)).not.toContain("brandPrimaryColor");
  });

  it("is rendered by the form only in the done state", () => {
    expect(enrollForm).toMatch(
      /if \(screen\.kind === "done"\)[\s\S]{0,600}<EnrollConfirmation/,
    );
  });
});

describe("the per-consumer manifest link is injected only on the confirmation (ADR 0049)", () => {
  const confirmation = source("enroll/[programId]/enroll-confirmation.tsx");

  it("injects <link rel=manifest> with the path handed over by the 201, and cleans up on unmount", () => {
    expect(confirmation).toContain('document.createElement("link")');
    expect(confirmation).toMatch(/rel = "manifest"/);
    expect(confirmation).toMatch(/href = walletManifestPath/);
    expect(confirmation).toContain("document.head.appendChild(link)");
    // useEffect cleanup: the link must not outlive the confirmation.
    expect(confirmation).toMatch(/return \(\) =>[\s\S]{0,60}link\.remove\(\)/);
  });

  it("injects nothing when the 201 did not carry the path (older server, odd failure)", () => {
    expect(confirmation).toMatch(/if \(!walletManifestPath\) return/);
  });

  it("the form takes the path ONLY from the 201 response", () => {
    const enrollForm = source("enroll/[programId]/enroll-form.tsx");
    expect(enrollForm).toMatch(
      /if \(res\.status === 201\) \{[\s\S]{0,400}walletManifestPath/,
    );
    // Never a hardcoded/manufactured path client-side: the token lives server-side.
    expect(enrollForm).not.toContain("manifest.webmanifest");
  });

  it("no file in the enroll tree injects or statically links a manifest besides the confirmation", () => {
    for (const file of enrollTreeFiles()) {
      if (file === "enroll-confirmation.tsx") continue;
      const text = source(`enroll/[programId]/${file}`);
      expect(text, file).not.toContain('createElement("link")');
      // Both JSX spellings — a static <link rel="manifest"> would apply to the FORM
      // (pre-201, no session) and reintroduce the icon-opens-the-form bug.
      expect(text, file).not.toMatch(/rel=["{]"?manifest/);
      expect(text, file).not.toContain("manifest:");
    }
  });
});

describe("the iOS install hint still lives on /wallet (spec 0050 stays intact)", () => {
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
