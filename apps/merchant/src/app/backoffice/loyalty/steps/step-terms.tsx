import { AutoGrowTextarea } from "../ui";
import type { LoyaltyVm } from "../use-loyalty-program";
import { AccrualFields } from "./accrual-fields";

export function StepTerms({ vm }: { vm: LoyaltyVm }) {
  return (
    <>
      <h2>Términos y condiciones</h2>
      <p>
        Son informativos. Inserta una plantilla como punto de partida y edita el
        texto antes de guardar.
      </p>
      <div className="template-actions">
        {vm.templates.map((template) => (
          <button
            key={template.id}
            type="button"
            className="terms-template-insert"
            onClick={() => vm.insertTemplate(template)}
          >
            + {template.title}
          </button>
        ))}
      </div>
      <label>
        Texto de términos
        <AutoGrowTextarea
          className="loyalty-terms-input"
          value={vm.terms}
          onChange={(event) => vm.setTerms(event.target.value)}
          placeholder="Escribe los términos o inserta una plantilla"
        />
      </label>
      <AccrualFields vm={vm} />
    </>
  );
}
