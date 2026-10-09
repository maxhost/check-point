import { Alert, Button, SelectField, Text } from "../../../ui";
import type { CounterCouponState } from "../counter/types";
import type { PosOrder } from "./pos-types";
export function PosCoupon({
  state,
  order,
  productId,
  onProduct,
  onRemove,
  busy,
  excludedId,
}: {
  state: CounterCouponState;
  order: PosOrder;
  productId: string | null;
  onProduct: (id: string | null) => void;
  onRemove: () => void;
  busy: boolean;
  excludedId?: string | null;
}) {
  if (state.status === "none") return null;
  if (state.status === "hint")
    return (
      <Alert title="Este cliente tiene cupones para tu comercio.">
        Recomiéndale seleccionar uno en la app de CheckPass Club.
      </Alert>
    );
  if (state.status === "used_today")
    return (
      <Alert title="Ya usó un cupón hoy en este comercio">{state.label}</Alert>
    );
  const { coupon, verdict } = state;
  if (excludedId === coupon.couponId)
    return (
      <Text variant="muted">
        Beneficio excluido de esta orden: {coupon.label}
      </Text>
    );
  const needsProduct =
    verdict.valid &&
    !coupon.productId &&
    (coupon.kind === "free_product" || coupon.kind === "two_for_one");
  const options = [
    ...new Map(
      order.items
        .filter((item) => item.productId)
        .map((item) => [
          item.productId!,
          { id: item.productId!, label: item.name },
        ]),
    ).values(),
  ];
  return (
    <div className="grid gap-3">
      <Alert
        kind={verdict.valid ? "success" : "error"}
        title={verdict.valid ? "Cupón válido" : "Cupón no válido"}
      >
        <Text variant="label">{coupon.label}</Text>
        {!verdict.valid && (
          <>
            <Text>{verdict.message}</Text>
            <Text>Excluye el beneficio para cobrar sin él.</Text>
          </>
        )}
        {coupon.rule && <Text>{coupon.rule}</Text>}
        {verdict.valid && coupon.kind === "discount" && (
          <Text>El descuento se aplica al vender.</Text>
        )}
      </Alert>
      {needsProduct && (
        <SelectField
          label="Producto de la oferta"
          options={options}
          selectedKey={productId}
          onSelectionChange={(key) => onProduct(key ? String(key) : null)}
          isDisabled={busy}
        />
      )}
      {verdict.valid &&
        coupon.productId &&
        !order.items.some((item) => item.productId === coupon.productId) && (
          <Text variant="muted">
            Edita la orden para agregar{" "}
            {coupon.productName ?? "el producto de la oferta"}.
          </Text>
        )}
      <Button variant="secondary" isDisabled={busy} onPress={onRemove}>
        Quitar beneficio
      </Button>
    </div>
  );
}
