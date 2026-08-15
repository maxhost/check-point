import { useState } from "react";
import type { Kind, Program } from "./use-loyalty-program";

export type RewardType = "catalog_product" | "custom" | "discount";
export type AccrualMode = "per_amount" | "per_purchase";
export type CatalogProduct = {
  id: string;
  name: string;
  unitPrice: number | null;
};
/** A reward as edited in the wizard; the payload trims the fields per type/kind. */
export type RewardDraft = {
  type: RewardType;
  productId: string | null;
  label: string; // custom text, or the selected product name (display)
  discountPercent: number;
  pointsCost: number; // Puntos only
};

const emptyReward = (): RewardDraft => ({
  type: "custom",
  productId: null,
  label: "",
  discountPercent: 10,
  pointsCost: 50,
});

/**
 * Referential points cost for a catalog-product reward: enough points that redeeming
 * it requires the customer to spend at least the product's price, so a giveaway never
 * loses money. Rounds the required spend up to the next accrual block (`$Y`), so the
 * cost lands on a clean, reachable multiple of `grant` (`X`). Owner can still override.
 * Returns 0 when it can't be computed (no price / no rate).
 */
export function suggestPointsCost(
  price: number,
  grant: number,
  block: number,
): number {
  if (
    !Number.isFinite(price) ||
    !Number.isFinite(grant) ||
    !Number.isFinite(block) ||
    price <= 0 ||
    grant <= 0 ||
    block <= 0
  )
    return 0;
  return Math.ceil(price / block) * grant;
}

/**
 * Owns the accrual mechanics + reward list + the catalog used to pick a product
 * reward (spec 0036). Split out of `use-loyalty-program` to stay within file-size.
 */
export function useRewards() {
  const [accrualMode, setAccrualMode] = useState<AccrualMode>("per_amount");
  const [grant, setGrant] = useState(10);
  const [blockAmount, setBlockAmount] = useState("3");
  const [rewards, setRewards] = useState<RewardDraft[]>([emptyReward()]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);

  function patch(index: number, next: Partial<RewardDraft>) {
    setRewards((list) =>
      list.map((reward, i) => (i === index ? { ...reward, ...next } : reward)),
    );
  }

  /**
   * Picks a catalog product for a reward and re-seeds its points cost from the product
   * price + current rate (referential floor; the owner can still edit it afterwards).
   * A product without a price leaves the current cost untouched.
   */
  function selectProduct(index: number, product: CatalogProduct | null) {
    const suggested = product
      ? suggestPointsCost(product.unitPrice ?? 0, grant, Number(blockAmount))
      : 0;
    patch(index, {
      productId: product?.id ?? null,
      label: product?.name ?? "",
      ...(suggested > 0 ? { pointsCost: suggested } : {}),
    });
  }
  const add = () => setRewards((list) => [...list, emptyReward()]);
  const remove = (index: number) =>
    setRewards((list) =>
      list.length > 1 ? list.filter((_, i) => i !== index) : list,
    );

  async function loadCatalog() {
    try {
      const response = await fetch("/api/catalog");
      if (!response.ok) return;
      const data = (await response.json()) as { products: CatalogProduct[] };
      setProducts(data.products ?? []);
    } catch {
      // The selector simply stays empty; the owner can still use custom/discount.
    }
  }

  /** Rehydrates accrual + rewards when editing an existing program (null-safe). */
  function hydrate(program: Program) {
    if (program.accrual) {
      setAccrualMode(program.accrual.mode);
      setGrant(program.accrual.grant);
      setBlockAmount(
        program.accrual.blockAmount === null
          ? ""
          : String(program.accrual.blockAmount),
      );
    }
    if (program.rewards && program.rewards.length > 0) {
      setRewards(
        program.rewards.map((reward) => ({
          type: reward.type,
          productId: reward.productId,
          label: reward.label,
          discountPercent: reward.discountPercent ?? 10,
          pointsCost: reward.pointsCost ?? 50,
        })),
      );
    }
  }

  function reset() {
    setAccrualMode("per_amount");
    setGrant(10);
    setBlockAmount("3");
    setRewards([emptyReward()]);
  }

  /** Effective mode: Puntos always accrues per amount. */
  const effectiveMode = (kind: Kind): AccrualMode =>
    kind === "points" ? "per_amount" : accrualMode;

  function accrualPayload(kind: Kind) {
    const mode = effectiveMode(kind);
    return {
      mode,
      grant,
      blockAmount: mode === "per_purchase" ? null : blockAmount,
    };
  }

  function rewardsPayload(kind: Kind) {
    return rewards.map((reward) => ({
      type: reward.type,
      label: reward.type === "custom" ? reward.label : undefined,
      productId:
        reward.type === "catalog_product" ? reward.productId : undefined,
      discountPercent:
        reward.type === "discount" ? reward.discountPercent : undefined,
      pointsCost: kind === "points" ? reward.pointsCost : null,
    }));
  }

  return {
    accrualMode,
    grant,
    blockAmount,
    rewards,
    products,
    setAccrualMode,
    setGrant,
    setBlockAmount,
    patch,
    selectProduct,
    add,
    remove,
    loadCatalog,
    hydrate,
    reset,
    effectiveMode,
    accrualPayload,
    rewardsPayload,
  };
}

export type RewardsVm = ReturnType<typeof useRewards>;
