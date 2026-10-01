import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { type DbTransaction, getDb } from "@mi-pasaporte/db";
import { campaigns, loyaltyPrograms, products } from "@mi-pasaporte/db/schema";
import { CampaignError } from "./campaign-error";
import {
  type CouponKind,
  INVALID_PRODUCT,
} from "@mi-pasaporte/domain/server/marketing/reward-input";

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

/** The three rewards any business can offer; the extra one depends on its program. */
const BASE_KINDS = ["free_product", "two_for_one", "discount"] as const;

/**
 * ADR 0098 §6 — THE ONE SOURCE for which extra a business may offer: `extra_stamps` with a
 * stamps program, `extra_points` with a points one, neither without. «The program» is the
 * business's single OPERATIONAL accreditable program — the same predicate as
 * `accreditableProgram` (`counter/resolve.ts`): `active`/`closing`, kind points/stamps,
 * accrual defined. Used to DECIDE (`assertExtrasFitProgram`, on every write) and to INFORM
 * (`allowedCouponKinds`, spec 0106 E1b), so the two can never disagree.
 */
async function extraKindOf(
  db: DbTransaction | ReturnType<typeof getDb>,
  businessId: string,
): Promise<"extra_stamps" | "extra_points" | null> {
  const [program] = await db
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
  if (program?.kind === "stamps") return "extra_stamps";
  if (program?.kind === "points") return "extra_points";
  return null;
}

/**
 * Spec 0106 E1b: the reward types THIS business can choose today, for the root
 * `couponKinds` of the marketing reads — a staff member with `marketing` but not `loyalty`
 * has no other way to know which extra to offer.
 */
export async function allowedCouponKinds(
  businessId: string,
): Promise<CouponKind[]> {
  const extra = await extraKindOf(getDb(), businessId);
  return extra ? [...BASE_KINDS, extra] : [...BASE_KINDS];
}

/** The write-side check: an `extra_*` that is not THIS business's extra → 400 on `couponKind`. */
export async function assertExtrasFitProgram(
  tx: DbTransaction,
  businessId: string,
  kind: CouponKind | null,
): Promise<void> {
  if (kind !== "extra_stamps" && kind !== "extra_points") return;
  if ((await extraKindOf(tx, businessId)) !== kind)
    throw new CampaignError(400, "validation", VALIDATION, {
      couponKind:
        kind === "extra_stamps"
          ? "Los sellos extra necesitan un programa de sellos activo."
          : "Los puntos extra necesitan un programa de puntos activo.",
    });
}
