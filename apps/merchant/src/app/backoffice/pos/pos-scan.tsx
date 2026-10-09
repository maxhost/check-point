"use client";
import { useState } from "react";
import { Xmark } from "iconoir-react";
import { Alert, Button, Dialog } from "../../../ui";
import { Toast } from "../../components/ui";
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
    <>
      <Toast
        message={payment.notice}
        kind="success"
        onDismiss={payment.dismissNotice}
      />
      <Dialog
        variant="fullscreen"
        isOpen={payment.phase === "scanning" || resolving}
        onOpenChange={(open) => {
          if (!open) cancel();
        }}
        title="Escanear pase"
        headerAction={
          !resolving && (
            <Button
              variant="quiet"
              aria-label="Cerrar escáner"
              onPress={cancel}
            >
              <Xmark aria-hidden="true" className="size-6" />
            </Button>
          )
        }
      >
        <div className="grid gap-3">
          {payment.error && <Alert kind="error" title={payment.error} />}
          {resolving ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-raised">
              <div
                role="status"
                aria-busy="true"
                aria-label="Identificando cliente"
              >
                <span className="sr-only">Identificando cliente…</span>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 512 512"
                  className="size-24 text-content animate-pulse motion-reduce:animate-none"
                >
                  <path
                    d="M358 158C329 131 292 116 252 116C174 116 118 178 118 256C118 334 174 396 252 396C292 396 329 381 358 354"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="58"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="absolute bottom-6">
                <Button variant="secondary" onPress={cancel}>
                  Cancelar
                </Button>
              </div>
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
          {!resolving && (
            <Button variant="secondary" onPress={cancel}>
              Cancelar
            </Button>
          )}
        </div>
      </Dialog>
    </>
  );
}
