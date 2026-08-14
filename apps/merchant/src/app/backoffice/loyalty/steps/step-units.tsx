import type { LoyaltyVm } from "../use-loyalty-program";

export function StepUnits({ vm }: { vm: LoyaltyVm }) {
  return (
    <>
      <h2>Nombre de las unidades</h2>
      <label>
        Nombre singular
        <input
          value={vm.singular}
          onChange={(event) => vm.setSingular(event.target.value)}
        />
      </label>
      <label>
        Nombre plural
        <input
          value={vm.plural}
          onChange={(event) => vm.setPlural(event.target.value)}
        />
      </label>
    </>
  );
}
