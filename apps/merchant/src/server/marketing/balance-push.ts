import type { DbTransaction } from "@mi-pasaporte/db";
import { decideBalancePush, renderGap } from "./balance-audience";
import { loadBalanceCandidates, loadRewardCost } from "./balance-store";
import { type PushCampaign, recordPushDecision } from "./push-store";

/**
 * Step «1b push» for ONE BALANCE campaign (#7/#8, spec 0104 §6 / ADR 0096). `tick.ts`
 * delegates here when `template.group === "balance"`: these two are NOT «dormant = push»,
 * their audience also depends on the balance against the reward.
 *
 * Same contract as the reactivation branch: one decision per eligible membership, the
 * holdout drawn by the tick's `draw`, idempotent through the rows it writes (they are the
 * `ownDecisions`/`lastGroupDecisionAt` the next run reads). The only difference in what it
 * writes is the BODY: #7's `{faltan}` is rendered with THIS consumer's gap, and a balance
 * template never carries a coupon, so #8's body is its message as is.
 */
export async function runBalancePushCampaign(
  db: DbTransaction,
  campaign: PushCampaign,
  now: Date,
  draw: () => boolean,
): Promise<{ decided: number; held: number }> {
  const reward = await loadRewardCost(db, campaign.businessId);
  if (!reward) return { decided: 0, held: 0 };
  const candidates = await loadBalanceCandidates(
    db,
    campaign.businessId,
    campaign.template,
    reward,
  );
  let decided = 0;
  let held = 0;
  for (const candidate of candidates) {
    const eligibility = decideBalancePush(candidate, {
      now,
      dormantDays: campaign.dormantDays,
      template: campaign.template.key,
      reward,
      nearRewardStamps: campaign.nearRewardStamps,
      nearRewardPercent: campaign.nearRewardPercent,
      rewardRepeat: campaign.rewardRepeat,
    });
    if (eligibility.kind !== "eligible") continue;
    const holdout = draw();
    const body = campaign.template.message.gapMarker
      ? renderGap(campaign.message, eligibility.gap, reward.kind)
      : campaign.message;
    await recordPushDecision(db, campaign, candidate, holdout, now, body);
    decided += 1;
    if (holdout) held += 1;
  }
  return { decided, held };
}
