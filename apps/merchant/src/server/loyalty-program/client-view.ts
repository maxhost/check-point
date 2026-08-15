type ProgramRow = {
  id: string;
  stampImageObjectKey: string | null;
  stampImageVersion: number;
  accrualMode?: string | null;
  accrualGrant?: number | null;
  accrualBlockAmount?: string | null;
  [key: string]: unknown;
};

/** Service-side reward row (joined to its product image); the DTO strips the R2 key. */
type RewardRow = {
  rewardType: string;
  label: string;
  productId: string | null;
  discountPercent: number | null;
  pointsCost: number | null;
  position: number;
  imageObjectKey: string | null;
  imageVersion: number | null;
};

/** Client-facing reward: never serializes the internal R2 key, only a public `imagePath`. */
function toRewardDTO(reward: RewardRow) {
  return {
    type: reward.rewardType,
    label: reward.label,
    productId: reward.productId,
    discountPercent: reward.discountPercent,
    pointsCost: reward.pointsCost,
    position: reward.position,
    imagePath:
      reward.productId && reward.imageObjectKey
        ? `/api/public/catalog/${reward.productId}/image?v=${reward.imageVersion ?? 0}`
        : null,
  };
}

/**
 * Client-facing shape of a program: never serializes the internal R2 keys
 * (`stampImageObjectKey` on the program, `imageObjectKey` on a reward's product),
 * only public paths. Exposes the accrual mechanics and the ordered reward list.
 */
export function toClientProgram<T extends ProgramRow>(
  program: T | null,
  businessId: string,
  rewards: RewardRow[] = [],
) {
  if (!program) return null;
  const {
    stampImageObjectKey,
    accrualMode,
    accrualGrant,
    accrualBlockAmount,
    ...rest
  } = program;
  return {
    ...rest,
    stampImagePath: stampImageObjectKey
      ? `/api/public/loyalty/${businessId}/${program.id}/stamp?v=${program.stampImageVersion}`
      : null,
    accrual: accrualMode
      ? {
          mode: accrualMode,
          grant: accrualGrant ?? null,
          blockAmount:
            accrualBlockAmount === null || accrualBlockAmount === undefined
              ? null
              : Number(accrualBlockAmount),
        }
      : null,
    rewards: rewards.map(toRewardDTO),
  };
}
