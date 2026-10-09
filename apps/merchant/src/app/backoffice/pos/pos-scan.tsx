"use client";
import { useState } from "react";
import { Xmark } from "iconoir-react";
import { Alert, Button, Dialog, Text } from "../../../ui";
import { QrScanner } from "../counter/qr-scanner";
import type { PosPayment } from "./pos-payment";
export function PosScan({ payment }: { payment: PosPayment }) {
  const [cameraKey, setCameraKey] = useState(0);
  const resolving = payment.phase === "resolving";
  const read = (value: string) => {
    void payment.resolve(value);
  };
  const cancel = payment.cancelScan;
  return (
    <Dialog
      variant="fullscreen"
      isOpen={payment.phase === "scanning" || resolving}
      onOpenChange={(open) => {
        if (!open) cancel();
      }}
      title="Escanear pase"
      headerAction={
        <Button variant="quiet" aria-label="Cerrar escáner" onPress={cancel}>
          <Xmark aria-hidden="true" className="size-6" />
        </Button>
      }
    >
      <div className="grid gap-3">
        {payment.error && <Alert kind="error" title={payment.error} />}
        {resolving ? (
          <div role="status">
            <Text>Identificando cliente…</Text>
          </div>
        ) : (
          <div className="grid gap-3">
            {!payment.error && <QrScanner key={cameraKey} onDecode={read} />}
            <Button
              variant="secondary"
              onPress={() => {
                payment.retryScan();
                setCameraKey((key) => key + 1);
              }}
            >
              Reintentar escaneo
            </Button>
          </div>
        )}
        <Button variant="secondary" onPress={cancel}>
          Cancelar
        </Button>
      </div>
    </Dialog>
  );
}
