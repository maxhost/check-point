import {
  boolean,
  check,
  index,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { core } from "./_schemas";
import { businesses } from "./business";
import {
  consumerAccounts,
  programMemberships,
  walletPushQueue,
} from "./consumer";
import { campaigns } from "./campaign";

/**
 * ONE DECISION TO PUSH (spec 0103 / ADR 0095 §2): «the tick decided to tell THIS consumer
 * about THIS campaign». A `holdout` row is the control group: it is recorded and enqueues
 * nothing (`queue_id` stays null and it is never sent). A non-holdout row points at the
 * `wallet_push_queue` row it enqueued; the worker asks marketing, when it claims that
 * row, whether it still applies (`marketing/push-delivery.ts`) and either cancels it
 * (`cancelled_at` + `cancel_reason`), reschedules it, or sends it (`sent_at`).
 *
 * `decided_at` is what the group rule reads (`marketing/push-store.ts`): a template is not
 * pushed to a consumer who, since their last visit, already has a NON-cancelled row of it
 * or of a higher-ranked template of its group — holdout included (ADR 0095 §5).
 *
 * `clicked_at` is observed only for Web Push (the wallet pass reports no opens).
 */
export const campaignPushes = core.table(
  "campaign_push",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    consumerId: uuid("consumer_id")
      .notNull()
      .references(() => consumerAccounts.id),
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => programMemberships.id),
    holdout: boolean("holdout").notNull(),
    queueId: uuid("queue_id").references(() => walletPushQueue.id, {
      onDelete: "set null",
    }),
    decidedAt: timestamp("decided_at", { withTimezone: true }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    clickedAt: timestamp("clicked_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
  },
  (table) => [
    check(
      "core_campaign_push_cancel_reason_check",
      sql`${table.cancelReason} is null or ${table.cancelReason} in ('campaign_inactive', 'membership_gone', 'opt_out', 'visited')`,
    ),
    check(
      "core_campaign_push_cancel_pair_check",
      sql`(${table.cancelReason} is null) = (${table.cancelledAt} is null)`,
    ),
    // The control group is never queued nor sent.
    check(
      "core_campaign_push_holdout_check",
      sql`not ${table.holdout} or (${table.queueId} is null and ${table.sentAt} is null)`,
    ),
    check(
      "core_campaign_push_click_check",
      sql`${table.clickedAt} is null or ${table.sentAt} is not null`,
    ),
    uniqueIndex("core_campaign_push_queue_unique").on(table.queueId),
    // The group rule: this consumer's decisions at this business, by date.
    index("core_campaign_push_group_idx").on(
      table.businessId,
      table.consumerId,
      table.decidedAt,
    ),
    index("core_campaign_push_campaign_idx").on(table.campaignId),
  ],
);
