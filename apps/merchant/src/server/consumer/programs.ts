import { desc, eq, max, sql } from "drizzle-orm";
import type { CardDesignColors } from "../../components/loyalty/card-preview";
import { getDb } from "../db";
import {
  businesses,
  loyaltyPrograms,
  orders,
  programMemberships,
  rewardRedemptions,
} from "../schema";
import {
  type RewardDTO,
  toClientProgram,
  toRewardDTO,
} from "../loyalty-program/client-view";
import { loadRewardsForPrograms } from "../loyalty-program/persistence";

export type ConsumerProgramSummary = {
  membershipId: string;
  businessId: string;
  businessName: string;
  logoPath: string | null;
  brandPrimaryColor: string;
  brandComplementaryColor: string;
  brandAccentColor: string;
  programId: string;
  programStatus: "active" | "closing" | "inactive";
  kind: "points" | "stamps";
  unitName: string;
  target: number | null;
  cardDesign: CardDesignColors | null;
  stampImagePath: string | null;
  termsMarkdown: string;
  pointsBalance: number;
  stampsCount: number;
  enrolledAt: string;
  lastActivityAt: string;
  /** The program's reward catalog (spec 0055), ordered by `position`. Same DTO the
   * wizard and the counter use — public `imagePath` only, never an R2 object key. */
  rewards: RewardDTO[];
};

export type ConsumerProgramRow = {
  membershipId: string;
  businessId: string;
  businessName: string;
  logoObjectKey: string | null;
  logoVersion: number;
  brandPrimaryColor: string;
  brandComplementaryColor: string;
  brandAccentColor: string;
  programId: string;
  programStatus: string;
  kind: string;
  configuration: unknown;
  cardBackgroundColor: string | null;
  cardBackgroundColor2: string | null;
  cardBackgroundGradientAngle: number | null;
  cardBorderColor: string | null;
  stampImageObjectKey: string | null;
  stampImageVersion: number;
  termsMarkdown: string;
  pointsBalance: number;
  stampsCount: number;
  enrolledAt: Date;
  lastOrderAt: Date | null;
  /** A redemption IS activity (spec 0055): without it, redeeming would not reorder the
   * wallet list. `lastActivityAt` is the newest of enroll / order / redemption. */
  lastRedemptionAt: Date | null;
};

function configurationOf(value: unknown): {
  unitName?: unknown;
  unitSingular?: unknown;
  unitPlural?: unknown;
  target?: unknown;
} {
  return value && typeof value === "object" ? value : {};
}

/** Newest of the timestamps given, ignoring nulls. */
function newest(...dates: (Date | null)[]): Date {
  return dates.reduce<Date>(
    (acc, date) => (date && date > acc ? date : acc),
    dates[0] as Date,
  );
}

export function toConsumerProgramSummary(
  row: ConsumerProgramRow,
  rewards: RewardDTO[] = [],
): ConsumerProgramSummary {
  const configuration = configurationOf(row.configuration);
  const unitName =
    [
      configuration.unitName,
      configuration.unitPlural,
      configuration.unitSingular,
    ].find(
      (value): value is string => typeof value === "string" && value.length > 0,
    ) ?? (row.kind === "stamps" ? "sellos" : "puntos");
  const targetValue = Number(configuration.target);
  const clientProgram = toClientProgram(
    {
      id: row.programId,
      stampImageObjectKey: row.stampImageObjectKey,
      stampImageVersion: row.stampImageVersion,
    },
    row.businessId,
  )!;
  const isStamps = row.kind === "stamps";
  const cardDesign = isStamps
    ? {
        backgroundColor: row.cardBackgroundColor ?? row.brandPrimaryColor,
        backgroundColor2:
          row.cardBackgroundColor2 ?? row.brandComplementaryColor,
        gradientAngle: row.cardBackgroundGradientAngle,
        borderColor: row.cardBorderColor ?? row.brandAccentColor,
      }
    : null;
  return {
    membershipId: row.membershipId,
    businessId: row.businessId,
    businessName: row.businessName,
    logoPath: row.logoObjectKey
      ? `/api/public/brands/${row.businessId}/logo?v=${row.logoVersion}`
      : null,
    brandPrimaryColor: row.brandPrimaryColor,
    brandComplementaryColor: row.brandComplementaryColor,
    brandAccentColor: row.brandAccentColor,
    programId: row.programId,
    programStatus: row.programStatus as ConsumerProgramSummary["programStatus"],
    kind: row.kind as ConsumerProgramSummary["kind"],
    unitName,
    target: isStamps && Number.isFinite(targetValue) ? targetValue : null,
    cardDesign,
    stampImagePath: clientProgram.stampImagePath,
    termsMarkdown: row.termsMarkdown,
    pointsBalance: row.pointsBalance,
    stampsCount: row.stampsCount,
    enrolledAt: row.enrolledAt.toISOString(),
    lastActivityAt: newest(
      row.enrolledAt,
      row.lastOrderAt,
      row.lastRedemptionAt ?? null,
    ).toISOString(),
    rewards,
  };
}

export async function listConsumerPrograms(
  consumerId: string,
): Promise<ConsumerProgramSummary[]> {
  const lastOrderAt = max(orders.createdAt);
  const lastRedemptionAt = max(rewardRedemptions.createdAt);
  const rows = await getDb()
    .select({
      membershipId: programMemberships.id,
      businessId: businesses.id,
      businessName: businesses.name,
      logoObjectKey: businesses.logoObjectKey,
      logoVersion: businesses.logoVersion,
      brandPrimaryColor: businesses.brandPrimaryColor,
      brandComplementaryColor: businesses.brandComplementaryColor,
      brandAccentColor: businesses.brandAccentColor,
      programId: loyaltyPrograms.id,
      programStatus: loyaltyPrograms.status,
      kind: loyaltyPrograms.kind,
      configuration: loyaltyPrograms.configuration,
      cardBackgroundColor: loyaltyPrograms.cardBackgroundColor,
      cardBackgroundColor2: loyaltyPrograms.cardBackgroundColor2,
      cardBackgroundGradientAngle: loyaltyPrograms.cardBackgroundGradientAngle,
      cardBorderColor: loyaltyPrograms.cardBorderColor,
      stampImageObjectKey: loyaltyPrograms.stampImageObjectKey,
      stampImageVersion: loyaltyPrograms.stampImageVersion,
      termsMarkdown: loyaltyPrograms.termsMarkdown,
      pointsBalance: programMemberships.pointsBalance,
      stampsCount: programMemberships.stampsCount,
      enrolledAt: programMemberships.enrolledAt,
      lastOrderAt,
      lastRedemptionAt,
    })
    .from(programMemberships)
    .innerJoin(
      loyaltyPrograms,
      eq(loyaltyPrograms.id, programMemberships.programId),
    )
    .innerJoin(businesses, eq(businesses.id, loyaltyPrograms.businessId))
    .leftJoin(orders, eq(orders.membershipId, programMemberships.id))
    // Two LEFT JOINs on the same membership fan out into the cartesian product of its
    // orders and its redemptions — which is harmless HERE and only here, because every
    // selected column of both is inside a `max()`, and `max` is idempotent over
    // duplicates. Do not add a non-aggregated column from either join.
    .leftJoin(
      rewardRedemptions,
      eq(rewardRedemptions.membershipId, programMemberships.id),
    )
    .where(eq(programMemberships.consumerId, consumerId))
    .groupBy(programMemberships.id, loyaltyPrograms.id, businesses.id)
    .orderBy(
      desc(sql`greatest(${lastOrderAt}, ${lastRedemptionAt})`),
      desc(programMemberships.enrolledAt),
    );

  const typed = rows as ConsumerProgramRow[];
  const rewardsByProgram = new Map<string, RewardDTO[]>();
  for (const reward of await loadRewardsForPrograms([
    ...new Set(typed.map((row) => row.programId)),
  ])) {
    const list = rewardsByProgram.get(reward.programId) ?? [];
    list.push(toRewardDTO(reward));
    rewardsByProgram.set(reward.programId, list);
  }

  return typed
    .map((row) =>
      toConsumerProgramSummary(row, rewardsByProgram.get(row.programId) ?? []),
    )
    .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
}
