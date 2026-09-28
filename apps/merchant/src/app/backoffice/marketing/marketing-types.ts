export type Channel = "proximity" | "push";
export type CampaignStatus =
  | "draft"
  | "active"
  | "paused"
  | "ended"
  | "archived";

export type Campaign = {
  id: string;
  templateKey: string | null;
  channels: Channel[];
  name: string;
  status: CampaignStatus;
  pauseReason: string | null;
  dormantDays: number;
  message: string;
  couponLabel: string | null;
  couponCost: string | null;
  couponMaxRedemptions: number | null;
  couponProductId: string | null;
  nearRewardStamps: number | null;
  nearRewardPercent: number | null;
  rewardRepeat: "once" | "every_30_days" | null;
  startsAt: string;
  endsAt: string | null;
  activatedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  locationIds: string[];
};

export type TemplateView = {
  key: string;
  title: string;
  description: string;
  channels: Channel[];
  group: string;
  rank: number;
  dormantDays: { options: number[]; default: number };
  message: { default: string; maxLength: number; gapMarker: boolean };
  couponRecommended: boolean;
  couponAllowed: boolean;
  nearReward: {
    stamps: { options: number[]; default: number };
    pointsPercent: { options: number[]; default: number };
  } | null;
  repeat: {
    options: ("once" | "every_30_days")[];
    default: "once" | "every_30_days";
  } | null;
  atRisk: { minVisits: number; rhythmFactor: number } | null;
  live: Campaign | null;
  runs: {
    id: string;
    status: "ended" | "archived";
    activatedAt: string | null;
    endedAt: string | null;
  }[];
};

export type Location = {
  id: string;
  name: string;
  addressLabel: string;
  status: string;
};
export type MarketingSettings = {
  pushWindow: { startHour: number; endHour: number };
  timeZone: string;
};

export type Quality =
  | "observada"
  | "estimada"
  | "estimado_configurado"
  | "no_disponible";
export type Effect =
  | { quality: "estimada"; extraCustomers: number }
  | { quality: "no_disponible"; holdoutN: number; needed: number };
export type CampaignResults = {
  audience: {
    quality: Quality;
    photo: null | {
      ranAt: string;
      total: number;
      reachable: number;
      noLocation: number;
      optOut: number;
      cooldown: number;
    };
  };
  turns: {
    quality: Quality;
    queued: number;
    active: number;
    done: number;
    cancelled: number;
    held: number;
  };
  windowPurchases: {
    quality: Quality;
    title: string;
    placed: { purchases: number; of: number };
    held: { purchases: number; of: number };
  };
  effect: Effect;
  coupon: {
    quality: Quality;
    label: string | null;
    cap: number | null;
    redeemed: number;
    incurredCost: string | null;
  };
  byLocation: {
    quality: Quality;
    rows: {
      locationId: string;
      name: string;
      turns: number;
      windowPurchases: number;
      redemptions: number;
    }[];
  };
  passReach: { quality: Quality; inPass: number; members: number };
  push: null | {
    quality: "observada";
    decided: number;
    held: number;
    pending: number;
    sent: number;
    cancelled: {
      campaign_inactive: number;
      membership_gone: number;
      opt_out: number;
      visited: number;
    };
    clicked: number;
    conversion: {
      windowDays: number;
      sent: { purchases: number; of: number };
      held: { purchases: number; of: number };
    };
    effect: Effect;
  };
};
