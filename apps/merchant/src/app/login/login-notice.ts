/**
 * Allow-list that turns the `?e=` reason code of `/login` into copy (ADR 0055).
 *
 * The reason travels in the URL and is therefore forgeable: anyone can type
 * `/login?e=staff_disabled` and see the notice. That is fine — the notice grants
 * nothing, the real access control stays in `requireBackofficeSession`. What is NOT
 * fine is echoing the raw param into the DOM, so an unknown code renders nothing.
 */
const LOGIN_NOTICES: Readonly<Record<string, string>> = Object.freeze({
  // `STAFF_DISABLED` in server/auth-guards.ts. Pinned together in auth-guards.test.ts.
  staff_disabled: "Miembro del staff desactivado",
});

/**
 * @param reason raw `searchParams.e` — may be absent, a string, or an array when the
 *   param is repeated (`?e=a&e=b`).
 * @returns the copy to show, or `null` when there is nothing to say.
 */
export function loginNotice(
  reason: string | string[] | undefined,
): string | null {
  if (typeof reason !== "string") return null;
  // `hasOwn`, not `in`/`[]`: keeps `constructor` & `__proto__` out of the allow-list.
  return Object.hasOwn(LOGIN_NOTICES, reason) ? LOGIN_NOTICES[reason] : null;
}
