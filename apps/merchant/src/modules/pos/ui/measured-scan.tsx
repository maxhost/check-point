"use client";
import { useSyncExternalStore } from "react";
import { Alert, Button, Dialog, Text } from "../../../ui";
import { QrScanner } from "../../../app/backoffice/counter/qr-scanner";
import type { MeasuredPaymentSession } from "./measured-payment-session";
export function MeasuredScan({ session }: { session: MeasuredPaymentSession }) {
  const state = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  return (
    <Dialog
      variant="fullscreen"
      title="Escanear pase"
      isOpen={state.phase === "scanning" || state.phase === "resolving"}
      onOpenChange={(open) => {
        if (!open) session.cancelDialog();
      }}
    >
      <div className="grid gap-3">
        <Text>
          Escanea el QR para identificar al cliente. Puede inscribirse en tu
          programa al escanear.
        </Text>
        {state.error && <Alert kind="error" title={state.error} />}
        {state.customerReview && (
          <Button variant="secondary" onPress={() => session.removeCustomer()}>
            Quitar cliente y continuar sin pase
          </Button>
        )}
        {state.phase === "resolving" ? (
          <Text>Identificando cliente…</Text>
        ) : (
          <QrScanner onDecode={(value) => void session.resolve(value)} />
        )}
        <Button variant="secondary" onPress={() => session.cancelDialog()}>
          Cancelar
        </Button>
      </div>
    </Dialog>
  );
}
