export type AnalyticsMetric = {
  day: string;
  metric: string;
  locationId: string | null;
  dimensionId: string | null;
  amountMinor: number;
  quantity: number;
  count: number;
  currencyCode: string;
  minorUnit: number;
};
export type AnalyticsLabel = { kind: string; id: string; label: string };
export type AnalyticsInput = {
  today: string;
  firstSaleDay?: string | null;
  hasData?: boolean;
  hasClosedExpenseMonth?: boolean;
  metrics: readonly AnalyticsMetric[];
  labels: readonly AnalyticsLabel[];
  locations: readonly { id: string; name: string }[];
  currencyCode: string;
  minorUnit: number;
};
export type CardKey = "1" | "2" | "3" | "4" | "6" | "7" | "13";
export type CardCandidate = {
  cardKey: CardKey;
  subjectKey: string;
  sender: string;
  title: string;
  body: string;
  amountMinor: number | null;
  currencyCode: string;
  minorUnit: number;
  quality: "observed" | "estimated";
  actionKey: string | null;
  actionHref?: string;
  urgency: number;
  fixedPlata?: number;
  weightMultiplier?: number;
  fingerprint: string;
  weight: number;
  locationId: string | null;
};
export type CardState = {
  cardKey: string;
  subjectKey: string;
  fingerprint: string;
  status: "shown" | "accepted" | "dismissed";
  shownDays: number;
  lastShownDay: string | null;
};
export type InboxCard = {
  id: string;
  cardKey: string;
  sender: string;
  title: string;
  body: string;
  amountAtStake: {
    amountMinor: number;
    currencyCode: string;
    minorUnit: number;
  } | null;
  quality: "observed" | "estimated";
  action: { label: string; href: string } | null;
};
