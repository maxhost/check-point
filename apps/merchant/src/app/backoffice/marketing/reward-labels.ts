import type { CouponKind } from "./marketing-types";

export const REWARD_KIND_LABELS: Record<CouponKind, string> = {
  free_product: "Producto gratis",
  two_for_one: "2x1",
  discount: "Descuento",
  extra_stamps: "Sellos extra",
  extra_points: "Puntos extra",
};

export function money(value: string | number, currencyCode: string) {
  return new Intl.NumberFormat("es", {
    style: "currency",
    currency: currencyCode,
  }).format(Number(value));
}
