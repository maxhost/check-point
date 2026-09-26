import { useState } from "react";
import { Form } from "react-aria-components";
import { Button } from "../../../ui";
import { ClosingDateField } from "./closing-date-field";
import { localDateTimeInput } from "./ui";
import type { LoyaltyVm } from "./use-loyalty-program";
export function ProgramClosing({ vm }: { vm: LoyaltyVm }) {
  const [attempted, setAttempted] = useState(false);
  const min = localDateTimeInput(vm.timezone);
  const earningValid =
    /^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(vm.earningEndsAt) &&
    vm.earningEndsAt > min;
  const redemptionValid =
    /^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(vm.redemptionEndsAt) &&
    vm.redemptionEndsAt > vm.earningEndsAt;
  return (
    <section className="loyalty-section">
      <h2>Cierre del programa</h2>
      <p>
        Desde el fin de acumulación no se otorgarán más beneficios. Las personas
        podrán canjear los ya obtenidos hasta la fecha final.
      </p>
      <Form
        onSubmit={(event) => {
          event.preventDefault();
          setAttempted(true);
          if (earningValid && redemptionValid && vm.isOwner)
            vm.setConfirmClose(true);
          else
            requestAnimationFrame(() =>
              document
                .querySelector<HTMLInputElement>(
                  '.loyalty-date[aria-invalid="true"]',
                )
                ?.focus(),
            );
        }}
        validationBehavior="aria"
      >
        <fieldset disabled={vm.saving} className="loyalty-fields">
          <ClosingDateField
            label="Fin de acumulación"
            value={vm.earningEndsAt}
            onChange={vm.setEarningEndsAt}
            min={min}
            timezone={vm.timezone}
            error={
              attempted && !earningValid
                ? "Elegí una fecha futura válida"
                : undefined
            }
          />
          <ClosingDateField
            label="Fecha final de canje"
            value={vm.redemptionEndsAt}
            onChange={vm.setRedemptionEndsAt}
            min={vm.earningEndsAt || min}
            timezone={vm.timezone}
            error={
              attempted && !redemptionValid
                ? "El canje debe terminar después de la acumulación"
                : undefined
            }
          />
          <Button type="submit" variant="danger" isLoading={vm.saving}>
            Continuar con el cierre
          </Button>
        </fieldset>
      </Form>
    </section>
  );
}
