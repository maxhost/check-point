/**
 * The notice bodies (pure text, no DB, no network). Split out of `push.ts` so the queue
 * mechanics stay under the file-size budget; re-exported from `./push` so existing
 * importers do not change.
 */

/**
 * Spec 0111 / ADR 0103 §3: every counter notice credits AND invites the consumer to open
 * their account. Provisional text accepted by the owner (2026-09-29); an admin panel will
 * edit it later (not built). Spec 0114 / ADR 0106: the consumer's account lives at
 * `my.checkpass.club` (`checkpass.club` is now the landing for businesses).
 */
export const ACCOUNT_INVITE = "Revisa tus beneficios en my.checkpass.club";

/**
 * The longest counter notice body, counted in code points (`[...str].length`). Neither
 * Google nor Apple document a maximum; this bounds what the collapsed notification shows.
 */
export const MAX_NOTICE_BODY = 120;

/**
 * Appends {@link ACCOUNT_INVITE} after what happened at the counter — what was credited
 * or redeemed goes FIRST. When the whole body would pass {@link MAX_NOTICE_BODY} (a long
 * reward label) the invite is dropped: what happened is never cut.
 */
export function withAccountInvite(text: string): string {
  const full = `${text} · ${ACCOUNT_INVITE}`;
  return [...full].length <= MAX_NOTICE_BODY ? full : text;
}

/**
 * The transactional notice body as a full sentence, e.g. `Se acreditó 1 sello en tu
 * cuenta 🎉` / `Se acreditaron 30 puntos en tu cuenta 🎉`. A complete sentence (not a
 * `+N` fragment) reads clearly both inside the Wallet pass and, where the platform
 * surfaces it, in the notification itself — the business name rides in the title/header.
 */
export function buildTransactionalBody(
  units: number,
  kind: "points" | "stamps",
): string {
  const singular = units === 1;
  const noun =
    kind === "points"
      ? singular
        ? "punto"
        : "puntos"
      : singular
        ? "sello"
        : "sellos";
  const verb = singular ? "Se acreditó" : "Se acreditaron";
  return withAccountInvite(`${verb} ${units} ${noun} en tu cuenta 🎉`);
}

/**
 * The redemption notice (spec 0055), same `transactional` class as the accreditation:
 * what was handed over plus the balance that is left, as a full sentence. The reward
 * label is the snapshot the log stored, so the notice says exactly what the row says.
 */
export function buildRedemptionBody(
  label: string,
  kind: "points" | "stamps",
  balanceAfter: number,
): string {
  const singular = balanceAfter === 1;
  const noun =
    kind === "points"
      ? singular
        ? "punto"
        : "puntos"
      : singular
        ? "sello"
        : "sellos";
  const verb = singular ? "Te queda" : "Te quedan";
  return withAccountInvite(
    `Canjeaste «${label}» 🎁 ${verb} ${balanceAfter} ${noun}.`,
  );
}

/**
 * Spec 0195 / ADR 0136 §5: the balance-expiry notice, same `transactional` class. 20/10/5
 * days: `Tus 120 puntos vencen en 20 días si no compras antes`; the day itself: `Hoy vencen
 * tus 120 puntos. Pasa hoy y no los pierdas`. The business name rides in the title.
 */
export function buildExpiryBody(
  units: number,
  kind: "points" | "stamps",
  daysBefore: number,
): string {
  const singular = units === 1;
  const noun =
    kind === "points"
      ? singular
        ? "punto"
        : "puntos"
      : singular
        ? "sello"
        : "sellos";
  if (daysBefore === 0) {
    const verb = singular ? "Hoy vence tu" : "Hoy vencen tus";
    const pronoun = singular ? "lo" : "los";
    return withAccountInvite(
      `${verb} ${units} ${noun}. Pasa hoy y no ${pronoun} pierdas`,
    );
  }
  const verb = singular ? "vence" : "vencen";
  const owner = singular ? "Tu" : "Tus";
  return withAccountInvite(
    `${owner} ${units} ${noun} ${verb} en ${daysBefore} días si no compras antes`,
  );
}
