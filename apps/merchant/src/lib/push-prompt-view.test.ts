import { describe, expect, it } from "vitest";
import { choosePushPromptView, type PushPromptView } from "./push-prompt-view";

/**
 * Task 38 — the rule that `/wallet` shows an iPhone how to install the app even when Web
 * Push is unconfigured.
 *
 * This replaces three static guards over the shape of `push-prompt.tsx`, each of which an
 * independent reviewer evaded with the bug in place and all five gates green: string
 * positions (evaded once), counted regexes (evaded five ways, one of them a plain hoist
 * refactor), and a hand-rolled "first return of the render body" parser (evaded by moving
 * the key INTO the branch condition, which no ordering check can see). The property is
 * behavioural; asserting syntax was always a proxy, and every proxy has a preimage.
 *
 * The table below is the property itself, so there is nothing left to evade from inside
 * the decision. What it does NOT cover is deliberately named at the bottom of this file.
 */

type Input = Parameters<typeof choosePushPromptView>[0];

const IPHONE_SAFARI: Input = {
  isIos: true,
  isStandalone: false,
  vapidPublicKey: "BPkey",
  pushSupported: false, // iOS Safari has no usable Push API — that is the whole point
};

describe("choosePushPromptView", () => {
  it("shows the install hint on iOS Safari even with Web Push DISABLED (the task 38 bug)", () => {
    // The regression: a `vapidPublicKey` gate reached before the iOS branch — whether
    // placed above it, folded into its condition, or hoisted into a boolean — turned this
    // into "nothing", leaving an iPhone with no install instructions on /wallet.
    expect(
      choosePushPromptView({ ...IPHONE_SAFARI, vapidPublicKey: null }),
    ).toBe("install-hint");
  });

  it("shows the install hint on iOS Safari when Web Push IS configured too", () => {
    expect(choosePushPromptView(IPHONE_SAFARI)).toBe("install-hint");
  });

  it("shows the install hint on iOS Safari even if the browser CLAIMS Push support", () => {
    // The fixture pins `pushSupported: false` because that is today's iOS Safari, which
    // would leave `isIos && !isStandalone && pushSupported` untested — a reviewer got
    // `if (isIos && !isStandalone && !pushSupported)` past the table that way. Spec 0037
    // is explicit that on iOS the Push API is only usable inside the installed PWA, so
    // outside standalone the hint wins whatever the browser advertises.
    expect(
      choosePushPromptView({ ...IPHONE_SAFARI, pushSupported: true }),
    ).toBe("install-hint");
  });

  it.each<[string, Input, PushPromptView]>([
    [
      "iOS installed as a PWA: the Push API works there, so offer the opt-in",
      { ...IPHONE_SAFARI, isStandalone: true, pushSupported: true },
      "push-optin",
    ],
    [
      "iOS installed but the browser has no Push API: nothing to offer",
      { ...IPHONE_SAFARI, isStandalone: true, pushSupported: false },
      "nothing",
    ],
    [
      "iOS installed with Web Push disabled: no hint (already installed), no opt-in",
      {
        ...IPHONE_SAFARI,
        isStandalone: true,
        pushSupported: true,
        vapidPublicKey: null,
      },
      "nothing",
    ],
    [
      "Android/desktop with Web Push configured and supported",
      {
        isIos: false,
        isStandalone: false,
        vapidPublicKey: "BPkey",
        pushSupported: true,
      },
      "push-optin",
    ],
    [
      "Android/desktop with Web Push disabled: render nothing",
      {
        isIos: false,
        isStandalone: false,
        vapidPublicKey: null,
        pushSupported: true,
      },
      "nothing",
    ],
    [
      "desktop browser without a Push API: render nothing",
      {
        isIos: false,
        isStandalone: false,
        vapidPublicKey: "BPkey",
        pushSupported: false,
      },
      "nothing",
    ],
    // The installed-Android-PWA cell. A reviewer found it missing and killed the opt-in
    // there with `if (!isIos && isStandalone) return "nothing"` — 9 tests still green,
    // and it is the main case of spec 0037 (the whole point of installing the app).
    [
      "Android installed as a PWA: still the Web Push opt-in, not silence",
      {
        isIos: false,
        isStandalone: true,
        vapidPublicKey: "BPkey",
        pushSupported: true,
      },
      "push-optin",
    ],
    [
      "Android installed as a PWA without a Push API: render nothing",
      {
        isIos: false,
        isStandalone: true,
        vapidPublicKey: "BPkey",
        pushSupported: false,
      },
      "nothing",
    ],
  ])("%s", (_label, input, expected) => {
    expect(choosePushPromptView(input)).toBe(expected);
  });

  it("never promises the opt-in without a key, which `enable()` dereferences", () => {
    // `PushPrompt.enable()` uses `vapidPublicKey!`; only "push-optin" renders the button
    // that calls it, so this is the assertion that keeps that non-null assertion honest.
    for (const isIos of [true, false])
      for (const isStandalone of [true, false])
        for (const pushSupported of [true, false])
          expect(
            choosePushPromptView({
              isIos,
              isStandalone,
              vapidPublicKey: null,
              pushSupported,
            }),
          ).not.toBe("push-optin");
  });
});

/**
 * NOT covered here, stated plainly rather than left to be discovered:
 *
 * 1. That `PushPrompt` renders this verdict faithfully. There is no DOM test environment
 *    in this package (`environment: "node"`, `*.test.ts` only) and adding one is a
 *    decision with a dependency attached, not a detail to slip in. **This hole is one
 *    line wide**, measured, not guessed: a reviewer reintroduced the exact task 38 bug
 *    with `setIsIos(ios && vapidPublicKey !== null)` in the effect, and with
 *    `if (view === "install-hint") return vapidPublicKey ? <IosInstallHint/> : null`,
 *    both with all five gates green. Extracting the decision moved the guarantee from
 *    "the user sees the hint" to "the decision says hint"; the wiring is unguarded.
 * 2. That `IosInstallHint` itself renders something. `if (!accentColor) return null`
 *    inside it blanks the hint on `/wallet` (which passes no accent) and nowhere else,
 *    with all five gates green.
 * 3. That a CALLER does not gate `<PushPrompt>` itself — a reviewer reintroduced the bug
 *    from `wallet/qr-tab.tsx` that way. `server/enroll-install-hint.test.ts` pins that
 *    one file's shape, which is a proxy and is labelled as one there. Its parent,
 *    `wallet/wallet-shell.tsx`, renders `<QrTab>` and is pinned by nothing.
 */
