"use client";
import { Xmark } from "iconoir-react";
import { Alert, Button, Dialog, Heading, NumberField, Text } from "../../../ui";
import { formatMoney, unitLabel } from "../counter/types";
import { PosCoupon } from "./pos-coupon";
import type { PosPayment } from "./pos-payment";
import type { PosOrder } from "./pos-types";
export function PosCheckout({
  order,
  payment,
}: {
  order: PosOrder;
  payment: PosPayment;
}) {
  const preview = payment.preview;
  const busy =
    payment.phase === "closing" || payment.phase === "preparingPayment";
  const open = [
    "preparingPayment",
    "paymentOpen",
    "closing",
    "closeUncertain",
  ].includes(payment.phase);
  const money = (cents: number) =>
    formatMoney(cents / 100, order.business.currencyCode);
  return (
    <Dialog
      variant="fullscreen"
      isOpen={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) payment.cancelPayment();
      }}
      isDismissable={!payment.blocked}
      title={`Cobrar ${order.tableLabel}`}
      headerAction={
        <Button
          variant="quiet"
          aria-label="Cancelar cobro"
          isDisabled={payment.blocked}
          onPress={payment.cancelPayment}
        >
          <Xmark aria-hidden="true" className="size-6" />
        </Button>
      }
    >
      <div className="grid gap-3">
        {preview?.netCents !== null && preview?.netCents !== undefined && (
          <Heading level={3}>Importe: {money(preview.netCents)}</Heading>
        )}
        <Text variant="small">
          Previsión de la orden guardada. El servidor confirma el importe y la
          acreditación al cobrar.
        </Text>
        {payment.resolved && (
          <>
            <Text variant="label">{payment.resolved.consumer.displayName}</Text>
            <PosCoupon
              state={payment.resolved.couponState}
              order={order}
              productId={payment.productId}
              onProduct={payment.setProduct}
              onRemove={payment.removeCoupon}
              busy={payment.blocked || busy}
              excludedId={payment.excludedId}
            />
          </>
        )}
        {payment.clientError && (
          <Alert kind="error" title={payment.clientError} />
        )}
        {payment.error && <Alert kind="error" title={payment.error} />}
        {preview?.error && <Alert kind="error" title={preview.error} />}
        {payment.review && (
          <Alert
            kind="warning"
            title="El beneficio cambió. Revisa esta previsión antes de confirmar."
          >
            <Button
              variant="secondary"
              isDisabled={busy || payment.blocked || !payment.validated}
              onPress={payment.acceptReview}
            >
              He revisado la actualización
            </Button>
          </Alert>
        )}
        {payment.phase === "preparingPayment" && (
          <div role="status">
            <Text>Actualizando beneficio…</Text>
          </div>
        )}
        {!payment.validated && !payment.blocked && !busy && (
          <Button variant="secondary" onPress={() => void payment.prepare()}>
            Reintentar revisión
          </Button>
        )}
        <NumberField
          label="Recibido"
          value={payment.received ?? NaN}
          minValue={0}
          clampOnBlur={false}
          onInput={(event) => {
            if (event.target instanceof HTMLInputElement)
              payment.setReceivedRaw(event.target.value);
          }}
          errorMessage={payment.receivedError ?? undefined}
          formatOptions={{ maximumFractionDigits: 2 }}
          onChange={(value) =>
            payment.setReceived(Number.isNaN(value) ? null : value)
          }
          isDisabled={payment.blocked || busy}
        />
        {preview?.missingCents != null && (
          <Text variant="label">
            {preview.missingCents > 0
              ? `Faltan: ${money(preview.missingCents)}`
              : `Cambio: ${money(preview.changeCents ?? 0)}`}
          </Text>
        )}
        {preview?.baseUnits != null && preview.kind && (
          <>
            <Text>{preview.rule}</Text>
            <Text variant="label">
              Se acreditará
              {preview.baseUnits + preview.extraUnits === 1 ? "" : "n"}:{" "}
              {preview.baseUnits + preview.extraUnits}{" "}
              {unitLabel(preview.kind, preview.baseUnits + preview.extraUnits)}
            </Text>
            {preview.extraUnits > 0 && (
              <Text>
                {preview.baseUnits} de la compra + {preview.extraUnits} del
                cupón
              </Text>
            )}
          </>
        )}
        {(payment.resolved || payment.clientError) && (
          <Button
            variant="quiet"
            isDisabled={payment.blocked || busy}
            onPress={payment.removeClient}
          >
            Quitar cliente
          </Button>
        )}
        <div className="flex flex-wrap gap-3">
          <Button
            isLoading={payment.phase === "closing"}
            isDisabled={
              payment.phase !== "closeUncertain" &&
              (busy ||
                !payment.validated ||
                payment.review ||
                !!payment.clientError ||
                !!payment.receivedError ||
                !preview?.canConfirm)
            }
            onPress={() => void payment.confirm()}
          >
            {payment.phase === "closeUncertain"
              ? "Reintentar cobro"
              : "Confirmar cobro"}
          </Button>
          <Button
            variant="secondary"
            isDisabled={payment.blocked}
            onPress={payment.cancelPayment}
          >
            Cancelar
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
