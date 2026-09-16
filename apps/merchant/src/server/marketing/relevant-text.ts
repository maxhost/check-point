/**
 * «Una puerta, un texto» (spec 0065, decision of the owner 2026-09-15): the two bags —
 * UTILITY (the consumer's own balance) and the campaign TURN — are NOT disjoint, and
 * `consumer.pass_placement` has pk `(consumer_id, location_id)`, so a door that falls in
 * both produces ONE row with ONE `relevantText`. Apple accepts a single `relevantText`
 * per location, so fusing is not stacking two rows: it is COMPOSING a text. PURE.
 */

import { truncateText } from "./utility-text";

/** `consumer.pass_placement.relevant_text` is checked `<= 120` (spec 0065). The owner's
 * own example — «Bar La Esquina: te faltan 2 sellos · 2x1 en picadas hasta el domingo» —
 * is 68 characters. ORQUESTADOR: the real cut of the lock screen is a QA datum; Apple
 * documents no limit for `relevantText`. */
export const RELEVANT_TEXT_CAP = 120;

/** The campaign half of a door: the business and its `message_snapshot`. */
export type CampaignPart = { businessName: string; message: string };

/**
 * Composes `{negocio}: {saldo} · {mensaje}` with the business name **once**: the name is
 * not re-added because `utility` — the output of `utilityText` — already carries it.
 *
 * The «margen de seguridad» of the owner is the CONDITION, not an adornment: if the
 * composed text does not fit in `cap`, the **campaign message wins and the balance is
 * dropped ENTIRELY** — never cut mid-word, never split. The balance is the part the
 * consumer can read anywhere (it lives in the pass and in the portal); the offer only
 * exists on that screen.
 *
 * With only one half there is nothing to fuse: the utility sentence is returned as it
 * is (it is already capped at 60 by `utilityText`) and the turn alone reads
 * `{negocio}: {mensaje}`.
 *
 * The result is ALWAYS `<= cap`: a longer one dies with `23514` against the column
 * check, which is a production error, not a cosmetic one. `{negocio}: {mensaje}` can by
 * itself exceed `cap` (the name allows 80 characters and the message 60), and for that
 * residue — the only case the spec does not legislate — the text is truncated as a LAST
 * RESORT (see the handoff).
 */
export function composeRelevantText(
  utility: string | null,
  campaign: CampaignPart | null,
  cap: number = RELEVANT_TEXT_CAP,
): string {
  if (!campaign) return utility ? truncateText(utility, cap) : "";
  const campaignOnly = `${campaign.businessName}: ${campaign.message}`;
  if (!utility) return truncateText(campaignOnly, cap);
  const composed = `${utility} · ${campaign.message}`;
  if (composed.length <= cap) return composed;
  return truncateText(campaignOnly, cap);
}
