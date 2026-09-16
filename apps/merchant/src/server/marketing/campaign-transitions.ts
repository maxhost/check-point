/**
 * The campaign lifecycle, as a table (spec 0065, «Backoffice — rutas y API»). Pure on
 * purpose: the four buttons of the detail page and the four routes behind them share ONE
 * definition of what may follow what, and anything outside the table is a 409
 * `invalid_transition` rather than a silent no-op.
 *
 * Retiring the live turns of a paused or ended campaign is NOT done here and not by the
 * route: it is step 3 of the tick, which writes each turn's `cancel_reason`. The route
 * says so in its response («los turnos activos se retiran en el proximo refresco»)
 * because the owner would otherwise read «pausada» and expect the doors to be gone.
 */

export type CampaignStatus =
  | "draft"
  | "active"
  | "paused"
  | "ended"
  | "archived";

export type CampaignAction = "activate" | "pause" | "end" | "archive";

/**
 * `paused` is the only status with three ways out (`activate`, `end`, `archive`): it is
 * the state a campaign sits in while the owner decides, and the spec lets them resume it,
 * close it or file it away without passing through `active` again.
 */
const TRANSITIONS: Record<
  CampaignAction,
  { from: readonly CampaignStatus[]; to: CampaignStatus }
> = {
  activate: { from: ["draft", "paused"], to: "active" },
  pause: { from: ["active"], to: "paused" },
  end: { from: ["active", "paused"], to: "ended" },
  archive: { from: ["ended", "paused"], to: "archived" },
};

/** The status an action leads to, or `null` when the table forbids it (→ 409). */
export function nextStatus(
  current: CampaignStatus,
  action: CampaignAction,
): CampaignStatus | null {
  const rule = TRANSITIONS[action];
  return rule.from.includes(current) ? rule.to : null;
}

/**
 * Editing is allowed in `draft` and `paused` only (409 `not_editable` otherwise). The
 * reason is not cosmetic: an `active` campaign already has turns carrying a
 * `message_snapshot`, so editing the message would make the pass of a consumer disagree
 * with the campaign the owner is reading — and the snapshot is what the counter shows.
 */
export const EDITABLE_STATUSES: readonly CampaignStatus[] = ["draft", "paused"];

export function isEditable(status: CampaignStatus): boolean {
  return EDITABLE_STATUSES.includes(status);
}

/** Every status a campaign can be in, for the callers that need to enumerate them. */
export const CAMPAIGN_STATUSES: readonly CampaignStatus[] = [
  "draft",
  "active",
  "paused",
  "ended",
  "archived",
];
