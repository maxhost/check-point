export type Channel = "proximity" | "push";
export type CouponKind =
  | "free_product"
  | "two_for_one"
  | "discount"
  | "extra_stamps"
  | "extra_points"
  | "custom";
export type DiscountUnit = "percent" | "amount";
export type WelcomeRedeemFrom = "next_day" | "same_visit";
export type CampaignWelcome = {
  validDays: number;
  reminderDays: number;
  monthlyCap: number;
  redeemFrom: WelcomeRedeemFrom;
};
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
  couponKind?: CouponKind | null;
  couponDiscountUnit?: DiscountUnit | null;
  couponDiscountValue?: string | null;
  couponExtraUnits?: number | null;
  couponRule?: string | null;
  nearRewardStamps: number | null;
  nearRewardPercent: number | null;
  rewardRepeat: "once" | "every_30_days" | null;
  welcome?: CampaignWelcome | null;
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
  dormantDays: { options: number[]; default: number } | null;
  message: { default: string; maxLength: number; gapMarker: boolean };
  couponRecommended: boolean;
  couponAllowed: boolean;
  couponRequired: boolean;
  welcome: {
    validDays: { options: number[]; default: number };
    reminderDays: { options: number[]; default: number };
    monthlyCap: { min: number; max: number; default: number };
    redeemFrom: {
      options: WelcomeRedeemFrom[];
      default: WelcomeRedeemFrom;
    };
  } | null;
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
    kind?: CouponKind | null;
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
