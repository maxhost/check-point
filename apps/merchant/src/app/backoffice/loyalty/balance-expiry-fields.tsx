import { useState } from "react";
import { Button, SelectField, Switch, Text } from "../../../ui";
import type { BalanceExpiryMonths } from "./loyalty-types";
import type { LoyaltyVm } from "./use-loyalty-program";
import { LoyaltyConfirmDialog } from "./loyalty-confirm-dialog";

export function BalanceExpiryFields({ vm }: { vm: LoyaltyVm }) {
  const [pending, setPending] = useState<BalanceExpiryMonths | undefined>(
    undefined,
  );
  if (vm.program && vm.program.status !== "active") return null;
  const months = vm.program
    ? (vm.program.balanceExpiryMonths ?? null)
    : vm.expiryDraft;
  const blocked =
    vm.saving ||
    vm.loading ||
    vm.refreshFailed ||
    vm.operationError?.status === 401 ||
    vm.operationError?.status === 403 ||
    vm.loadError?.status === 401 ||
    vm.loadError?.status === 403;
  function change(next: BalanceExpiryMonths) {
    if (next === months || blocked) return;
    if (next !== null && (months === null || next < months)) setPending(next);
    else void vm.changeExpiry(next);
  }
  return (
    <div className="grid gap-3">
      <Switch
        isSelected={months !== null}
        onChange={(selected) => change(selected ? 6 : null)}
        isDisabled={blocked}
      >
        {vm.kind === "points" ? "Los puntos vencen" : "Los sellos vencen"}
      </Switch>
      {months !== null && (
        <SelectField
          label="Plazo sin compras ni canjes"
          selectedKey={String(months)}
          options={[3, 6, 9, 12].map((value) => ({
            id: String(value),
            label: `${value} meses`,
          }))}
          onSelectionChange={(key) => {
            if (key !== null) change(Number(key) as BalanceExpiryMonths);
          }}
          isDisabled={blocked}
        />
      )}
      <Text variant="muted">
        Si un cliente pasa ese tiempo sin comprar ni canjear, pierde su saldo.
        Le avisamos antes.
      </Text>
      <Text variant="small">
        {vm.program
          ? "Esta opción se guarda por separado al cambiarla."
          : "Esta opción se aplicará al activar el programa."}
      </Text>
      {vm.expiryRetry !== undefined && (
        <Button
          variant="secondary"
          isDisabled={blocked}
          onPress={() => void vm.changeExpiry(vm.expiryRetry!)}
        >
          Reintentar vencimiento
        </Button>
      )}
      <LoyaltyConfirmDialog
        open={pending !== undefined && !blocked}
        title={
          months === null ? "¿Activar el vencimiento?" : "¿Acortar el plazo?"
        }
        description="Empieza a contar hoy para todos tus clientes. Nadie pierde su saldo por inactividad anterior a hoy."
        confirmLabel="Confirmar vencimiento"
        onCancel={() => setPending(undefined)}
        onConfirm={() => {
          const next = pending;
          setPending(undefined);
          if (next !== undefined) void vm.changeExpiry(next);
        }}
      />
    </div>
  );
}
