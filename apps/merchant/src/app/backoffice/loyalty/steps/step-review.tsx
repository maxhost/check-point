import { CardPreview } from "../card-preview";
import type { LoyaltyVm } from "../use-loyalty-program";

export function StepReview({ vm }: { vm: LoyaltyVm }) {
  const stampPreview =
    vm.stamp.preview ??
    (!vm.stamp.removed ? (vm.program?.stampImagePath ?? null) : null);
  return (
    <>
      <h2>Revisión</h2>
      {vm.kind === "points" ? (
        <p>
          Programa de <strong>Puntos</strong>: «{vm.singular}» / «{vm.plural}».
        </p>
      ) : (
        <>
          <p>
            Programa de <strong>Sellos</strong>: «{vm.stampName}», {vm.target}{" "}
            para completar.
          </p>
          <CardPreview
            design={vm.card.payload()}
            target={vm.target}
            stampImagePath={stampPreview}
          />
        </>
      )}
      <h3>Términos y condiciones</h3>
      <p className="published-term">{vm.terms || "—"}</p>
    </>
  );
}
