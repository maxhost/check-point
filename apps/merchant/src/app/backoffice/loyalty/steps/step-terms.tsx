import { TextAreaField, Button } from "../../../../ui";
import type { LoyaltyVm } from "../use-loyalty-program";
import { AccrualFields } from "./accrual-fields";
export function StepTerms({
  vm,
  errors,
}: {
  vm: LoyaltyVm;
  errors: Record<string, string>;
}) {
  return (
    <>
      <p>
        Inserta una plantilla como punto de partida y edita el texto antes de
        guardar.
      </p>
      <div className="loyalty-actions">
        {vm.templates.map((template) => (
          <Button
            key={template.id}
            variant="secondary"
            onPress={() => vm.insertTemplate(template)}
          >
            + {template.title}
          </Button>
        ))}
      </div>
      <TextAreaField
        label="Texto de términos"
        value={vm.terms}
        onChange={vm.setTerms}
        placeholder="Escribe los términos o inserta una plantilla"
        autoGrow
        errorMessage={errors.terms}
      />
      <div data-tour="loyalty-accrual">
        <AccrualFields vm={vm} errors={errors} />
      </div>
    </>
  );
}
