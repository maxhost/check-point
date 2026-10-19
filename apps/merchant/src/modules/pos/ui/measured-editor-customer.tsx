"use client";
import { useCallback, useState } from "react";
import { QrCode } from "iconoir-react";
import { Alert, Button, Dialog, Text, TextField } from "../../../ui";
import { QrScanner } from "../../../app/backoffice/counter/qr-scanner";
import type { MeasuredEditorSession } from "./measured-editor-model";
import { PosError } from "./pos-types";

export function MeasuredEditorCustomer({
  session,
  onAccessError,
}: {
  session: MeasuredEditorSession;
  onAccessError?: (cause: unknown) => void;
}) {
  const [code, setCode] = useState("");
  const customer = session.customer;
  const { resolved, scanning, resolving, error, excluded } = customer.state;
  const coupon = resolved?.couponState;
  const identify = useCallback(
    async (value: string) => {
      const cause = await customer.resolve(
        value.trim(),
        session.draft.locationId,
      );
      if (
        cause instanceof PosError &&
        ([401, 403].includes(cause.status ?? 0) ||
          cause.code === "backoffice_context_changed")
      )
        onAccessError?.(cause);
    },
    [customer, session, onAccessError],
  );
  return (
    <>
      <div className="grid gap-3 border-b border-border bg-surface-subtle p-5">
        {resolved ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Text variant="label">{resolved.consumer.displayName}</Text>
              <Button
                variant="quiet"
                isDisabled={session.blocked}
                onPress={() => customer.remove()}
              >
                Quitar cliente
              </Button>
            </div>
            <Text variant="small">
              Se conserva al pasar al cobro. Debes volver a identificarlo si
              recargas.
            </Text>
            {coupon?.status === "selected" && (
              <>
                <Text variant="small">
                  {coupon.coupon.label}
                  {excluded ? " · Sin aplicar" : ""}
                </Text>
                {!coupon.verdict.valid && (
                  <Text variant="small">{coupon.verdict.message}</Text>
                )}
                <Button
                  variant="quiet"
                  className="justify-start! px-0!"
                  isDisabled={session.blocked}
                  onPress={() => customer.exclude(!excluded)}
                >
                  {excluded
                    ? "Usar beneficio"
                    : "Quitar beneficio de esta venta"}
                </Button>
              </>
            )}
            {coupon?.status === "hint" && (
              <Text variant="small">
                Pídele elegir su cupón en CheckPass Club.
              </Text>
            )}
            {coupon?.status === "used_today" && (
              <Text variant="small">Ya usó un cupón hoy: {coupon.label}</Text>
            )}
          </>
        ) : (
          <>
            <Button
              variant="secondary"
              className="justify-between!"
              isDisabled={session.blocked || !session.draft.locationId}
              onPress={() => {
                setCode("");
                customer.start();
              }}
            >
              Identificar cliente
              <QrCode className="size-5 shrink-0" aria-hidden="true" />
            </Button>
            <Text variant="small">
              Opcional. Identifícalo para usar cupones y sumar beneficios.
            </Text>
          </>
        )}
      </div>
      <Dialog
        title="Identificar cliente"
        isOpen={scanning}
        onOpenChange={(open) => {
          if (!open) customer.cancel();
        }}
      >
        <div className="grid max-h-96 gap-3 overflow-y-auto">
          {error && <Alert kind="error" title={error} />}
          {resolving ? (
            <Text>Identificando cliente…</Text>
          ) : (
            <>
              <div className="mx-auto w-52 max-w-full [&_.counter-scan-hint]:hidden">
                <QrScanner onDecode={identify} />
              </div>
              <TextField
                label="Código del pase"
                value={code}
                onChange={setCode}
              />
            </>
          )}
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-3 border-t border-border pt-4">
          <Button variant="secondary" onPress={() => customer.cancel()}>
            Cancelar
          </Button>
          <Button
            isDisabled={resolving || !code.trim()}
            isLoading={resolving}
            onPress={() => void identify(code)}
          >
            Identificar
          </Button>
        </div>
      </Dialog>
    </>
  );
}
