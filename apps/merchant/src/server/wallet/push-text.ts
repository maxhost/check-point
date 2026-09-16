/**
 * The notice bodies (pure text, no DB, no network). Split out of `push.ts` so the queue
 * mechanics stay under the file-size budget; re-exported from `./push` so existing
 * importers do not change.
 */

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
  return `${verb} ${units} ${noun} en tu cuenta 🎉`;
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
  return `Canjeaste «${label}» 🎁 ${verb} ${balanceAfter} ${noun}.`;
}
