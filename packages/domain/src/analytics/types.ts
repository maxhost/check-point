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
export type AnalyticsGauge = {
  day: string;
  metric: string;
  locationId: string | null;
  dimensionId: string;
  amountMinor: string;
  quantity: string;
  currencyCode: string;
  minorUnit: number;
  unit: string | null;
  observedAt: string;
  eventId: string;
};
export type AnalyticsInput = {
  today: string;
  firstSaleDay?: string | null;
  firstSaleDays?: readonly { locationId: string | null; day: string }[];
  campaigns?: readonly AnalyticsCampaign[];
  hasData?: boolean;
  hasClosedExpenseMonth?: boolean;
  metrics: readonly AnalyticsMetric[];
  labels: readonly AnalyticsLabel[];
  gauges?: readonly AnalyticsGauge[];
  firstConsumptionDays?: readonly {
    locationId: string;
    itemId: string;
    day: string;
  }[];
  locations: readonly { id: string; name: string }[];
  currencyCode: string;
  minorUnit: number;
};
export type LegacyCardKey =
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "8"
  | "9"
  | "10"
  | "11"
  | "12"
  | "6"
  | "7"
  | "13";
export type CardKey = string;
export type AnalyticsCardCategory =
  "informational" | "actionable" | "marketing";
export type InboxDecision = "resolve" | "ignore" | "seen" | "snooze";
export type AnalyticsPeriod = { from: string; to: string; label: string };
export type AnalyticsLifecycleStatus =
  "open" | "snoozed" | "resolved" | "ignored" | "seen" | "expired";
export type AnalyticsContext = Readonly<Record<string, unknown>>;
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
  category?: AnalyticsCardCategory;
  period?: AnalyticsPeriod;
  context?: AnalyticsContext;
  criticalStock?: boolean;
  originDay?: string;
  originObservedAt?: string;
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
  status: "shown" | "accepted" | "dismissed" | AnalyticsLifecycleStatus;
  candidateId?: string;
  contextVersion?: string;
  context?: AnalyticsContext;
  episodeStartedAt?: string;
  expiresAt?: string;
  remindAt?: string | null;
  revision?: number;
  shownDays: number;
  lastShownDay: string | null;
};
export type InboxCard = {
  id: string;
  version: string;
  category: AnalyticsCardCategory;
  expiresAt: string;
  period: AnalyticsPeriod;
  decisions: readonly { key: InboxDecision; label: string }[];
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

/** Campaign instants are converted by the reader to business-local YYYY-MM-DD dates. */
export type AnalyticsCampaign = {
  campaignId: string;
  label: string;
  status: string;
  startsAt: string;
  endsAt: string | null;
  endedAt: string | null;
  capturedAt: string;
  eventId: string;
};

export type AnalyticsInboxResponse = {
  contractVersion: 2;
  policyVersion: string;
  timezone: string;
  state: "ready" | "preparing";
  preparedAt: string | null;
  nextReminderAt: string | null;
  refreshAfterMs: number | null;
  cards: InboxCard[];
};
export type AnalyticsInboxMutation = Pick<
  AnalyticsInboxResponse,
  "cards" | "nextReminderAt"
>;
export type AnalyticsInboxCommand = {
  businessId: string;
  actorId: string;
  cardId: string;
  decision: InboxDecision;
  expectedVersion: string;
  operationId: string;
  remindAt?: string;
};
export type AnalyticsCleanupResult = {
  cutoff: string;
  deleted: number;
  skipped: number;
  budgetExhausted: boolean;
};

/** Internal transition type: does not claim the public v2 lifecycle contract. */
export type LegacyInboxCard = Omit<
  InboxCard,
  "version" | "category" | "expiresAt" | "period" | "decisions"
>;
