import { TextField } from "../../../../ui";
import type { LoyaltyVm } from "../use-loyalty-program";
export function StepUnits({
  vm,
  errors,
}: {
  vm: LoyaltyVm;
  errors: Record<string, string>;
}) {
  return (
    <>
      <TextField
        label="Nombre singular"
        value={vm.singular}
        onChange={vm.setSingular}
        placeholder="Ej.: Punto"
        description="El nombre de una unidad que verá el cliente."
        errorMessage={errors.singular}
      />
      <TextField
        label="Nombre plural"
        value={vm.plural}
        onChange={vm.setPlural}
        placeholder="Ej.: Puntos"
        description="El nombre de varias unidades que verá el cliente."
        errorMessage={errors.plural}
      />
    </>
  );
}
