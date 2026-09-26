import type { LoyaltyVm } from "./use-loyalty-program";
export function programPayload(
  vm: LoyaltyVm,
  stampPlural: unknown,
  stampUploadId: string | null,
) {
  const {
    kind,
    singular,
    plural,
    stampName,
    target,
    terms,
    stamp,
    card,
    earn,
  } = vm;
  const stampAction = kind === "stamps" ? stamp.action : "keep";
  return {
    kind,
    configuration:
      kind === "points"
        ? { unitSingular: singular, unitPlural: plural }
        : {
            unitName: stampName,
            target,
            ...(stampPlural === undefined ? {} : { unitPlural: stampPlural }),
          },
    clauses: [{ text: terms }],
    stampAction,
    ...(stampUploadId ? { stampUploadId, stampCropped: stamp.cropped } : {}),
    ...(kind === "stamps" ? { cardDesign: card.payload() } : {}),
    accrual: earn.accrualPayload(kind),
    rewards: earn.rewardsPayload(kind),
    redeemAllowInsufficient: earn.allowInsufficient,
  };
}
