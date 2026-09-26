import { useEffect, useRef, useState } from "react";
import {
  Form,
  RadioGroupContext,
  CheckboxContext,
  SelectContext,
} from "react-aria-components";
import { Alert, Button, ChoiceGroup, ProgressIndicator } from "../../../ui";
import type { LoyaltyVm } from "./use-loyalty-program";
import {
  errorsFor,
  firstInvalidStep,
  stepsFor,
  stepLabels,
} from "./program-form-state";
import { StepCardDesign } from "./steps/step-card-design";
import { StepReview } from "./steps/step-review";
import { StepRewards } from "./steps/step-rewards";
import { StepStampBasics } from "./steps/step-stamp-basics";
import { StepTerms } from "./steps/step-terms";
import { StepUnits } from "./steps/step-units";
export function ProgramEditor({ vm }: { vm: LoyaltyVm }) {
  const steps = stepsFor(vm.kind, !vm.program);
  const [index, setIndex] = useState(0);
  const [attempted, setAttempted] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const clamped = Math.min(index, steps.length - 1);
  const step = steps[clamped];
  const errors = attempted ? errorsFor(step, vm) : {};
  const busyImage =
    vm.kind === "stamps" && (vm.stamp.isAnalyzing || Boolean(vm.stamp.pending));
  useEffect(() => {
    title.current?.focus();
  }, [clamped]);
  function move(next: number) {
    setAttempted(false);
    setIndex(next);
  }
  function focusInvalid() {
    requestAnimationFrame(() =>
      form.current
        ?.querySelector<HTMLElement>(
          '[aria-invalid="true"] input, input[aria-invalid="true"], textarea[aria-invalid="true"], button[aria-invalid="true"], [data-invalid] input',
        )
        ?.focus(),
    );
  }
  return (
    <section className="loyalty-section loyalty-wizard">
      <ProgressIndicator
        currentStep={clamped + 1}
        steps={steps.map((id) => ({ label: stepLabels[id] }))}
        ariaLabel="Progreso del programa"
      />
      <h2 ref={title} tabIndex={-1} className="loyalty-step-title">
        {stepLabels[step]}
      </h2>
      <Form
        ref={form}
        validationBehavior="aria"
        onSubmit={(event) => {
          event.preventDefault();
          if (vm.saving || busyImage) return;
          setAttempted(true);
          const invalid =
            step === "review"
              ? firstInvalidStep(vm)
              : Object.keys(errorsFor(step, vm)).length
                ? step
                : undefined;
          if (invalid) {
            if (invalid !== step) setIndex(steps.indexOf(invalid));
            focusInvalid();
            return;
          }
          if (step === "review") void vm.save();
          else move(clamped + 1);
        }}
      >
        <RadioGroupContext.Provider value={{ isDisabled: vm.saving }}>
          <CheckboxContext.Provider value={{ isDisabled: vm.saving }}>
            <SelectContext.Provider value={{ isDisabled: vm.saving }}>
              <fieldset disabled={vm.saving} className="loyalty-fields">
                {step === "modality" && (
                  <ChoiceGroup
                    label="Modalidad"
                    variant="cards"
                    value={vm.kind}
                    onChange={(value) =>
                      vm.setKind(value === "points" ? "points" : "stamps")
                    }
                    options={[
                      {
                        value: "points",
                        label: "Puntos",
                        description: "Una unidad flexible para premios.",
                      },
                      {
                        value: "stamps",
                        label: "Sellos",
                        description: "Una tarjeta que se completa con visitas.",
                      },
                    ]}
                  />
                )}
                {step === "units" && <StepUnits vm={vm} errors={errors} />}
                {step === "basics" && (
                  <StepStampBasics vm={vm} errors={errors} />
                )}
                {step === "design" && <StepCardDesign vm={vm} />}
                {step === "terms" && <StepTerms vm={vm} errors={errors} />}
                {step === "rewards" && <StepRewards vm={vm} errors={errors} />}
                {step === "review" && <StepReview vm={vm} />}
              </fieldset>
            </SelectContext.Provider>
          </CheckboxContext.Provider>
        </RadioGroupContext.Provider>
        {busyImage && (
          <Alert title="Preparando el sello">
            Terminá o cancelá el recorte antes de continuar.
          </Alert>
        )}
        <div className="loyalty-actions loyalty-editor-footer">
          {clamped > 0 && (
            <Button
              variant="secondary"
              isDisabled={vm.saving}
              onPress={() => move(clamped - 1)}
            >
              Atrás
            </Button>
          )}
          <Button
            type="submit"
            isLoading={vm.saving}
            isDisabled={
              busyImage ||
              vm.refreshFailed ||
              Boolean(
                vm.operationError?.status === 401 ||
                vm.operationError?.status === 403,
              )
            }
          >
            {step === "review"
              ? vm.program
                ? "Guardar cambios"
                : "Activar programa"
              : "Continuar"}
          </Button>
        </div>
      </Form>
    </section>
  );
}
