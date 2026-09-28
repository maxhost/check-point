import { and, eq, inArray, isNotNull } from "drizzle-orm";
import type { DbTransaction } from "../db";
import { campaigns, loyaltyPrograms, products } from "../schema";
import { CampaignError } from "./campaign-error";
import { type CouponKind, INVALID_PRODUCT } from "./reward-input";

/**
 * The half of the reward (spec 0106 / ADR 0098) that needs the database: what the pure
 * parser (`reward-input.ts`) cannot know. Called INSIDE the write transaction of the three
 * writers of a reward — `createCampaign`, `updateCampaign` (`campaign-store.ts`) and
 * `enableTemplate` (`template-store.ts`) — so three call sites are three wirings.
 */

const VALIDATION = "Revisá los datos de la campaña.";

/** The reward columns the `Campaign` DTO adds to the ones it already had. */
export const rewardSelect = {
  couponKind: campaigns.couponKind,
  couponDiscountUnit: campaigns.couponDiscountUnit,
  couponDiscountValue: campaigns.couponDiscountValue,
  couponExtraUnits: campaigns.couponExtraUnits,
  couponRule: campaigns.couponRule,
};

/**
 * ISOLATION: `coupon_product_id` must be a product OF THIS BUSINESS. The fk alone accepts
 * any business's product, and since spec 0106 the product travels to the coupon, the
 * counter and the rewards results. A foreign id is answered EXACTLY like an invalid one
 * (`INVALID_PRODUCT`): the answer never says the id exists somewhere else.
 */
export async function assertOwnProduct(
  tx: DbTransaction,
  businessId: string,
  productId: string | null,
): Promise<void> {
  if (productId === null) return;
  const [own] = await tx
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.businessId, businessId)))
    .limit(1);
  if (!own)
    throw new CampaignError(400, "validation", VALIDATION, {
      couponProductId: INVALID_PRODUCT,
    });
}

/**
 * ADR 0098 §6: extra STAMPS only with a stamps program, extra POINTS only with a points
 * one. «The program» is the business's single OPERATIONAL accreditable program — the same
 * predicate as `accreditableProgram` (`counter/resolve.ts`): `active`/`closing`, kind
 * points/stamps, accrual defined. No such program → neither extra is allowed.
 */
export async function assertExtrasFitProgram(
  tx: DbTransaction,
  businessId: string,
  kind: CouponKind | null,
): Promise<void> {
  if (kind !== "extra_stamps" && kind !== "extra_points") return;
  const [program] = await tx
    .select({ kind: loyaltyPrograms.kind })
    .from(loyaltyPrograms)
    .where(
      and(
        eq(loyaltyPrograms.businessId, businessId),
        inArray(loyaltyPrograms.status, ["active", "closing"]),
        inArray(loyaltyPrograms.kind, ["points", "stamps"]),
        isNotNull(loyaltyPrograms.accrualMode),
      ),
    )
    .limit(1);
  const wanted = kind === "extra_stamps" ? "stamps" : "points";
  if (program?.kind !== wanted)
    throw new CampaignError(400, "validation", VALIDATION, {
      couponKind:
        wanted === "stamps"
          ? "Los sellos extra necesitan un programa de sellos activo."
          : "Los puntos extra necesitan un programa de puntos activo.",
    });
}
