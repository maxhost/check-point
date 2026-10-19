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
import { measuredMoney } from "./measured-money";
import { MeasuredCoupon } from "./measured-coupon";
import type { MeasuredPaymentSession } from "./measured-payment-session";
const desktopQuery = "(min-width: 768px)";
function subscribeDesktop(listener: () => void) {
  const media = window.matchMedia(desktopQuery);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}
const getDesktop = () => window.matchMedia(desktopQuery).matches;
const serverDesktop = () => false;

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
  const desktop = useSyncExternalStore(
    subscribeDesktop,
    getDesktop,
    serverDesktop,
  );
  const preview = session.preview,
    amounts = preview.amounts;
  const zero = amounts && /^0(?:\.00)?$/.test(amounts.collected);
  const cash = state.methods.find(
    (method) => method.id === state.methodId,
  )?.isCash;
  const money = (value: string) =>
    desktop
      ? measuredMoney(value, state.order.business.currencyCode)
      : `${value} ${state.order.business.currencyCode}`;
  return (
    <Dialog
      variant={desktop ? "default" : "fullscreen"}
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
      <div className="grid gap-4 md:max-h-144 md:overflow-y-auto">
        {amounts &&
          (desktop ? (
            <div className="grid gap-2 rounded-lg bg-primary-soft p-4">
              <Text variant="small">Total a cobrar</Text>
              <Text variant="metric">{money(amounts.collected)}</Text>
              {!/^0(?:\.0+)?$/.test(amounts.discount) && (
                <Text variant="small">
                  Subtotal: {money(amounts.gross)} · Descuento:{" "}
                  {money(amounts.discount)}
                </Text>
              )}
              {!/^[-+]?0(?:\.0+)?$/.test(amounts.roundingAdjustment) && (
                <Text variant="small">
                  Ajuste de redondeo: {money(amounts.roundingAdjustment)}
                </Text>
              )}
            </div>
          ) : (
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
          ))}
        {!desktop &&
          state.order.items.map((line) => (
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
        {!desktop && (
          <Text variant="small">
            Cliente y beneficio temporales para esta orden. Se conservan al
            cancelar el cobro; se pierden al salir o recargar.
          </Text>
        )}
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
            <Text variant="label">
              Cliente: {state.resolved.consumer.displayName}
            </Text>
            <MeasuredCoupon session={session} compact={desktop} />
            {!desktop && (
              <Button
                variant="quiet"
                isDisabled={session.busy}
                onPress={() => session.removeCustomer()}
              >
                Quitar cliente
              </Button>
            )}
          </>
        ) : (
          !desktop && <Text>Venta sin cliente</Text>
        )}
        {!desktop && (
          <Button
            variant="secondary"
            isDisabled={session.busy}
            onPress={() => session.startScan()}
          >
            {state.resolved ? "Cambiar cliente" : "Escanear pase"}
          </Button>
        )}
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
        {cash && amounts && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-surface-subtle p-3">
            <Text variant="label">Cambio: {money(preview.change ?? "0")}</Text>
            {preview.missing && !/^0(?:\.0+)?$/.test(preview.missing) && (
              <Text>Faltante: {money(preview.missing)}</Text>
            )}
          </div>
        )}
        {preview.baseUnits !== null && (
          <Text>
            Se acreditan {preview.baseUnits + preview.extraUnits}{" "}
            {state.resolved?.program.kind === "points" ? "puntos" : "sellos"} (
            {preview.extraUnits} extra).
          </Text>
        )}
        <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-4">
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
