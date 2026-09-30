import { campaigns } from "@mi-pasaporte/db/schema";
import type { Campaign } from "./campaign-store";
import { channelsOf, welcomeOf, welcomeSelect } from "./campaign-values";
import { rewardSelect } from "./reward-store";
import { crossOf, crossSelect } from "./cross-store";
import { valleyOf, valleySelect } from "./valley-store";

/**
 * The columns every read of `core.campaign` selects and the row → DTO mapping. Apart from
 * `campaign-store.ts` only for the size budget (spec 0107 grew the DTO with `welcome`).
 */
export const columns = {
  id: campaigns.id,
  templateKey: campaigns.templateKey,
  channelProximity: campaigns.channelProximity,
  channelPush: campaigns.channelPush,
  name: campaigns.name,
  status: campaigns.status,
  pauseReason: campaigns.pauseReason,
  dormantDays: campaigns.dormantDays,
  message: campaigns.message,
  couponLabel: campaigns.couponLabel,
  couponCost: campaigns.couponCost,
  couponMaxRedemptions: campaigns.couponMaxRedemptions,
  couponProductId: campaigns.couponProductId,
  ...rewardSelect,
  nearRewardStamps: campaigns.nearRewardStamps,
  nearRewardPercent: campaigns.nearRewardPercent,
  rewardRepeat: campaigns.rewardRepeat,
  welcome: welcomeSelect,
  cross: crossSelect,
  valley: valleySelect,
  startsAt: campaigns.startsAt,
  endsAt: campaigns.endsAt,
  activatedAt: campaigns.activatedAt,
  endedAt: campaigns.endedAt,
  createdAt: campaigns.createdAt,
};

/** The row of `columns` as the DTO: the two booleans travel as `channels`. */
export function toCampaign(
  row: {
    channelProximity: boolean;
    channelPush: boolean;
    welcome: Parameters<typeof welcomeOf>[0];
    cross: Parameters<typeof crossOf>[0];
    valley: Parameters<typeof valleyOf>[0];
  },
  locationIds: string[],
): Campaign {
  const { channelProximity, channelPush, welcome, cross, valley, ...rest } =
    row;
  return {
    ...(rest as Omit<Campaign, "locationIds" | "channels">),
    channels: channelsOf({ channelProximity, channelPush }),
    welcome: welcomeOf(welcome),
    cross: crossOf(cross),
    valley: valleyOf(valley),
    locationIds,
  };
}
