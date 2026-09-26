import { NumberDraftField } from "../number-draft-field";
import { TextField } from "../../../../ui";
import type { LoyaltyVm } from "../use-loyalty-program";
export function StepStampBasics({
  vm,
  errors,
}: {
  vm: LoyaltyVm;
  errors: Record<string, string>;
}) {
  return (
    <>
      <TextField
        label="Nombre del sello"
        value={vm.stampName}
        onChange={vm.setStampName}
        placeholder="Ej.: Sello"
        errorMessage={errors.stampName}
      />
      <NumberDraftField
        label="Sellos para completar"
        minValue={2}
        maxValue={50}
        step={1}
        value={vm.target}
        onChange={vm.setTarget}
        description="Elegí entre 2 y 50 sellos."
        errorMessage={errors.target}
      />
    </>
  );
}
