import { LoyaltyError, type LoyaltyKind, type RewardInput } from "./core";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A product of the owner's business, used to resolve `catalog_product` rewards. */
export type BusinessProduct = { id: string; name: string };

/**
 * Form-validates the rewards of a program (spec 0036), pure and DB-free so it runs
 * inside `validateProgramInput`. Enforces the cross-row invariants by kind and assigns
 * `position` by arrival order. It does NOT resolve `catalog_product` ownership or snapshot
 * the label from the real product name — that needs the DB and happens in `resolveRewards`.
 *
 * - `stamps`  => exactly 1 reward, `pointsCost` null.
 * - `points`  => 1..N rewards, each `pointsCost` an integer > 0.
 */
export function validateRewardsInput(
  kind: LoyaltyKind,
  raw: unknown,
): RewardInput[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new LoyaltyError(422, "Agrega al menos un premio.");
  }
  if (kind === "stamps" && raw.length !== 1) {
    throw new LoyaltyError(422, "Los Sellos tienen exactamente un premio.");
  }
  if (raw.length > 20) {
    throw new LoyaltyError(422, "Demasiados premios (máximo 20).");
  }
  return raw.map((item, index) => validateOne(kind, item, index));
}

function validateOne(
  kind: LoyaltyKind,
  raw: unknown,
  position: number,
): RewardInput {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new LoyaltyError(422, "Cada premio debe ser válido.");
  }
  const item = raw as Record<string, unknown>;
  const type = item.type;
  if (type !== "catalog_product" && type !== "custom" && type !== "discount") {
    throw new LoyaltyError(422, "El tipo de premio no es válido.");
  }
  const pointsCost = validatePointsCost(kind, item.pointsCost);
  if (type === "discount") {
    const percent = item.discountPercent;
    if (
      !Number.isInteger(percent) ||
      (percent as number) < 1 ||
      (percent as number) > 100
    ) {
      throw new LoyaltyError(
        422,
        "El descuento debe ser un entero entre 1 y 100.",
      );
    }
    return {
      type,
      label: `${percent as number}% de descuento`,
      productId: null,
      discountPercent: percent as number,
      pointsCost,
      position,
    };
  }
  if (type === "catalog_product") {
    const productId =
      typeof item.productId === "string" ? item.productId.trim() : "";
    if (!UUID.test(productId)) {
      throw new LoyaltyError(422, "Selecciona un producto del catálogo.");
    }
    // `label` is provisional; `resolveRewards` snapshots the real product name.
    return {
      type,
      label: typeof item.label === "string" ? item.label.trim() : "",
      productId,
      discountPercent: null,
      pointsCost,
      position,
    };
  }
  const label = typeof item.label === "string" ? item.label.trim() : "";
  if (!label) {
    throw new LoyaltyError(422, "El premio libre necesita un nombre.");
  }
  return {
    type,
    label,
    productId: null,
    discountPercent: null,
    pointsCost,
    position,
  };
}

function validatePointsCost(kind: LoyaltyKind, raw: unknown): number | null {
  if (kind === "stamps") {
    if (raw !== null && raw !== undefined) {
      throw new LoyaltyError(
        422,
        "El premio de Sellos no lleva costo en puntos.",
      );
    }
    return null;
  }
  if (!Number.isInteger(raw) || (raw as number) <= 0) {
    throw new LoyaltyError(
      422,
      "Cada premio de Puntos necesita un costo en puntos mayor que 0.",
    );
  }
  return raw as number;
}

/**
 * Resolves `catalog_product` rewards against the owner's real products: a productId
 * that does not belong to the business (or no longer exists) is a `422`, and the
 * `label` is snapshotted from the actual product name so it stays legible if the
 * product is later edited or deleted. Non-catalog rewards pass through unchanged.
 */
export function resolveRewards(
  rewards: RewardInput[],
  businessProducts: BusinessProduct[],
): RewardInput[] {
  const byId = new Map(businessProducts.map((p) => [p.id, p.name]));
  return rewards.map((reward) => {
    if (reward.type !== "catalog_product") return reward;
    const name = byId.get(reward.productId ?? "");
    if (name === undefined) {
      throw new LoyaltyError(
        422,
        "El producto del premio no existe en tu catálogo.",
      );
    }
    return { ...reward, label: name };
  });
}
