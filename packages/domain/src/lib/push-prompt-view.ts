/**
 * What `PushPrompt` shows, decided as data (task 38).
 *
 * This exists because the property that matters could not be pinned any other way. The
 * rule is: **on iOS Safari outside standalone the install hint wins, even with Web Push
 * unconfigured** — the hint is how an iPhone gets the app at all, not a Web Push
 * affordance. Spec 0050 moved `/wallet`'s only path to the hint inside `PushPrompt`, and
 * a `vapidPublicKey` gate sitting above the iOS branch took the instructions down with it.
 *
 * Three static guards were written to protect that ordering inside the component and
 * three independent reviews evaded all of them — string positions, then counted regexes,
 * then a hand-rolled "first return of the render body" parser. Each one is a *proxy* for
 * the property, and every proxy has a preimage: the last review reintroduced the bug by
 * moving the key into the branch condition (`isIos && !isStandalone && vapidPublicKey`),
 * which no ordering check can see. Extracting the decision makes it a plain function with
 * a real oracle instead, at zero dependency cost — there is no DOM test environment in
 * this package (`environment: "node"`, `*.test.ts` only).
 *
 * `PushPrompt` renders this verdict and nothing else; keep the branching here.
 */
export type PushPromptView =
  /** iOS Safari, not installed: how to add to the home screen. */
  | "install-hint"
  /** Android/desktop/installed iOS: the Web Push permission button. */
  | "push-optin"
  /** Nothing to offer: Web Push disabled, or the browser has no Push API. */
  | "nothing";

export function choosePushPromptView({
  isIos,
  isStandalone,
  vapidPublicKey,
  pushSupported,
}: {
  isIos: boolean;
  isStandalone: boolean;
  /** `null` means Web Push is disabled (no VAPID env). */
  vapidPublicKey: string | null;
  pushSupported: boolean;
}): PushPromptView {
  // FIRST, and deliberately so: the install hint does not depend on Web Push.
  if (isIos && !isStandalone) return "install-hint";
  if (!vapidPublicKey) return "nothing";
  if (!pushSupported) return "nothing";
  return "push-optin";
}
