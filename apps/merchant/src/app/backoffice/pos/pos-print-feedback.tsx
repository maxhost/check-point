"use client";

import { Alert, Button, Dialog } from "../../../ui";
import { ConfirmationToast } from "../../components/confirmation-toast";
import type { PosPrinting } from "./pos-printing";

export function PosPrintFeedback({ printing }: { printing: PosPrinting }) {
  const choose =
    printing.issue?.reason === "no_printer" ||
    printing.issue?.reason === "not_found";
  return (
    <>
      {printing.settingsError && (
        <div className="print:hidden">
          <Alert kind="error" title={printing.settingsError}>
            <Button variant="secondary" onPress={printing.retrySettings}>
              Reintentar configuración del ticket
            </Button>
          </Alert>
        </div>
      )}
      <ConfirmationToast
        message={printing.notice}
        onDismiss={printing.dismissNotice}
      />
      <Dialog
        isOpen={!!printing.issue}
        onOpenChange={(open) => {
          if (!open) printing.dismiss();
        }}
        isDismissable={!printing.busy}
        title="Imprimir ticket"
        description={printing.issue?.message}
      >
        <div className="mt-4 flex flex-wrap justify-end gap-3">
          <Button
            variant="secondary"
            isDisabled={printing.busy}
            onPress={printing.dismiss}
          >
            Cancelar
          </Button>
          <Button
            isLoading={printing.busy}
            onPress={choose ? printing.choose : printing.retry}
          >
            {choose
              ? printing.issue?.reason === "not_found"
                ? "Elegir otra"
                : "Elegir impresora"
              : "Reintentar impresión"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
