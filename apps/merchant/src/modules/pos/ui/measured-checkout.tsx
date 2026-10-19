"use client";
import { useSyncExternalStore } from "react";
import {
  Alert,
  Button,
  Dialog,
  Heading,
  SelectField,
  Text,
  TextField,
} from "../../../ui";
import { MeasuredCoupon } from "./measured-coupon";
import type { MeasuredPaymentSession } from "./measured-payment-session";
export function MeasuredCheckout({
  session,
}: {
  session: MeasuredPaymentSession;
}) {
  const state = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const preview = session.preview,
    amounts = preview.amounts;
  const zero = amounts && /^0(?:\.00)?$/.test(amounts.collected);
  const cash = state.methods.find(
    (method) => method.id === state.methodId,
  )?.isCash;
  const money = (value: string) =>
    `${value} ${state.order.business.currencyCode}`;
  return (
    <Dialog
      variant="fullscreen"
      title={`Cobrar ${state.order.orderLabel}`}
      isOpen={[
        "preparing",
        "paymentOpen",
        "closing",
        "closeUncertain",
        "review",
      ].includes(state.phase)}
      isDismissable={session.canLeave}
      onOpenChange={(open) => {
        if (!open) session.cancelDialog();
      }}
    >
      <div className="grid gap-3">
        {amounts && (
          <>
            <Heading level={3}>Importe: {money(amounts.collected)}</Heading>
            <Text>
              Subtotal: {money(amounts.gross)} · Descuento:{" "}
              {money(amounts.discount)}
            </Text>
            <Text variant="small">
              Ajuste de redondeo: {money(amounts.roundingAdjustment)}
            </Text>
          </>
        )}
        {state.order.items.map((line) => (
          <Text key={line.lineId}>
            {line.name}: {line.quantity}{" "}
            {line.measure.quantityUnit === "unit"
              ? "unidades"
              : line.measure.quantityUnit}{" "}
            · {line.unitPrice}/
            {line.measure.priceUnit === "unit"
              ? "unidad"
              : line.measure.priceUnit}
          </Text>
        ))}
        <Text variant="small">
          Cliente y beneficio temporales para esta orden. Se conservan al
          cancelar el cobro; se pierden al salir o recargar.
        </Text>
        {state.customerReview && (
          <Alert kind="error" title="Revisa el cliente antes de cobrar">
            <Button
              variant="secondary"
              onPress={() => session.removeCustomer()}
            >
              Quitar cliente explícitamente
            </Button>
          </Alert>
        )}
        {state.resolved ? (
          <>
            <Text variant="label">{state.resolved.consumer.displayName}</Text>
            <MeasuredCoupon session={session} />
            <Button
              variant="quiet"
              isDisabled={session.busy}
              onPress={() => session.removeCustomer()}
            >
              Quitar cliente
            </Button>
          </>
        ) : (
          <Text>Venta sin cliente</Text>
        )}
        <Button
          variant="secondary"
          isDisabled={session.busy}
          onPress={() => session.startScan()}
        >
          {state.resolved ? "Cambiar cliente" : "Escanear pase"}
        </Button>
        {state.phase === "review" && (
          <Button
            variant="secondary"
            onPress={() => void session.requestOrderReview()}
          >
            Recuperar orden para revisión
          </Button>
        )}
        {state.error && <Alert kind="error" title={state.error} />}
        {preview.error && <Alert kind="error" title={preview.error} />}
        {state.phase === "preparing" && (
          <Text>Actualizando beneficio y medios…</Text>
        )}
        {state.review && state.validated && (
          <Alert
            kind="warning"
            title="El beneficio cambió. Revisa el importe y la línea."
          >
            <Button
              variant="secondary"
              onPress={() => session.acknowledgeReview()}
            >
              He revisado la actualización
            </Button>
          </Alert>
        )}
        {!state.validated && !session.busy && state.phase !== "review" && (
          <Button variant="secondary" onPress={() => void session.prepare()}>
            Revisar cobro
          </Button>
        )}
        {amounts && !zero && (
          <SelectField
            label="Medio de pago"
            options={state.methods.map((method) => ({
              id: method.id,
              label: method.name,
            }))}
            selectedKey={state.methodId}
            onSelectionChange={(key) =>
              session.selectMethod(key ? String(key) : null)
            }
            isDisabled={session.busy}
          />
        )}
        {amounts && !zero && cash && (
          <TextField
            label="Recibido"
            value={state.received}
            onChange={(value) => session.setReceived(value)}
            inputMode="decimal"
            isDisabled={session.busy}
            description="Deja vacío para registrar el importe exacto."
          />
        )}
        {cash && preview.change !== null && (
          <Text>
            Cambio: {money(preview.change)} · Faltante:{" "}
            {money(preview.missing!)}
          </Text>
        )}
        {preview.baseUnits !== null && (
          <Text>
            Se acreditan {preview.baseUnits + preview.extraUnits}{" "}
            {state.resolved?.program.kind === "points" ? "puntos" : "sellos"} (
            {preview.extraUnits} extra).
          </Text>
        )}
        <div className="flex flex-wrap gap-3">
          <Button
            isLoading={state.phase === "closing"}
            isDisabled={
              state.phase !== "closeUncertain" &&
              (state.phase !== "paymentOpen" ||
                !state.validated ||
                state.review ||
                !preview.canConfirm ||
                (!zero &&
                  !state.methods.some(
                    (method) => method.id === state.methodId,
                  )))
            }
            onPress={() =>
              void (state.phase === "closeUncertain"
                ? session.retry()
                : session.confirm())
            }
          >
            {state.phase === "closeUncertain"
              ? "Reintentar el mismo cobro"
              : zero
                ? "Cerrar venta sin cobro"
                : "Confirmar cobro"}
          </Button>
          <Button
            variant="secondary"
            isDisabled={!session.canLeave}
            onPress={() => session.cancelDialog()}
          >
            Cancelar
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
