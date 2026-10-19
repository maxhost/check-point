import {
  type OperatorBusiness,
  type ProgramRow,
  programDTO,
} from "@mi-pasaporte/domain/server/counter/core";
import { businessCatalog, purchaseShortcuts } from "./resolve-catalog";
import { type CounterCouponState, counterCouponState } from "./coupon-state";
import { loadProgramRewards } from "@mi-pasaporte/domain/server/loyalty-program/persistence";
import {
  type RewardDTO,
  toRewardDTO,
} from "@mi-pasaporte/domain/server/loyalty-program/client-view";
import { resolveScanContext } from "./resolve-context";

export { accreditableProgram } from "./resolve-context";

export type ResolveResult = ReturnType<typeof buildResolveResult>;

function buildResolveResult(opts: {
  displayName: string;
  membership: {
    id: string;
    pointsBalance: number;
    stampsCount: number;
    justEnrolled: boolean;
  };
  program: ProgramRow;
  catalog: Awaited<ReturnType<typeof businessCatalog>> &
    Awaited<ReturnType<typeof purchaseShortcuts>>;
  rewards: RewardDTO[];
  couponState: CounterCouponState;
}) {
  return {
    // Allow-list: the consumer's display name only — never the qr_token.
    consumer: { displayName: opts.displayName },
    membership: opts.membership,
    // `programDTO` is an allow-list: it exposes `redeemAllowInsufficient` and never the
    // raw `configuration` jsonb nor `stampImageObjectKey`.
    program: programDTO(opts.program),
    catalog: opts.catalog,
    // Rewards for the Canjear mode (spec 0055), ordered by `position` — the order the
    // owner configured in step 4. Same DTO as the wizard and the wallet: no R2 key.
    rewards: opts.rewards,
    // Spec 0148 / 0153 (contract M0): the state of the consumer's coupon at this counter —
    // `selected` (with its verdict) / `used_today` / `hint` / `none`. A SNAPSHOT for painting:
    // the sale re-decides under the locks, and `GET /api/counter/coupon-state` refreshes it.
    couponState: opts.couponState,
  };
}

/**
 * Resolves a scanned `qrToken` against the operator's business: finds the consumer,
 * the business's accreditable program, and the membership — AUTO-ENROLLING the
 * consumer (balance 0) when they are not yet a member (ADR 0033). Never leaks the
 * qr_token. Errors: 404 no accreditable program; 422 the qr_token does not resolve.
 */
export async function resolveScan(
  business: OperatorBusiness,
  qrToken: string,
  selectedLocationId?: string | null,
): Promise<ResolveResult> {
  const { consumerId, displayName, membership, program, locationId } =
    await resolveScanContext(business, qrToken, selectedLocationId);
  const baseCatalog = await businessCatalog(business.id, locationId);
  const catalog = {
    ...baseCatalog,
    ...(await purchaseShortcuts(
      business.id,
      consumerId,
      locationId,
      baseCatalog,
    )),
  };
  const rewards = (await loadProgramRewards(program.id)).map(toRewardDTO);
  const couponState = await counterCouponState(business.id, consumerId);

  return buildResolveResult({
    displayName,
    membership,
    program,
    catalog,
    rewards,
    couponState,
  });
}
