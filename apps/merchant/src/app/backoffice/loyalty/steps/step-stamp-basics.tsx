import type { LoyaltyVm } from "../use-loyalty-program";

export function StepStampBasics({ vm }: { vm: LoyaltyVm }) {
  return (
    <>
      <h2>Sello y objetivo</h2>
      <label>
        Nombre del sello
        <input
          value={vm.stampName}
          onChange={(event) => vm.setStampName(event.target.value)}
        />
      </label>
      <label>
        Sellos para completar
        <input
          type="number"
          min="2"
          max="50"
          value={vm.target}
          onChange={(event) => vm.setTarget(Number(event.target.value))}
        />
      </label>
    </>
  );
}
