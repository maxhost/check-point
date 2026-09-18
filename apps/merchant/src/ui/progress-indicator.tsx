export type ProgressStep = { label: string };

export function ProgressIndicator({
  currentStep,
  steps,
}: {
  currentStep: number;
  steps: ProgressStep[];
}) {
  return (
    <div aria-label="Progreso del alta">
      <p className="text-sm font-bold text-primary">
        Paso {currentStep} de {steps.length}
      </p>
      <ol className="mt-2 grid grid-cols-3 gap-2">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isCurrent = stepNumber === currentStep;
          const isComplete = stepNumber < currentStep;
          return (
            <li
              key={step.label}
              aria-current={isCurrent ? "step" : undefined}
              className="min-w-0"
            >
              <span
                aria-hidden="true"
                className={`block h-1.5 rounded-full ${
                  isCurrent || isComplete ? "bg-primary" : "bg-disabled"
                }`}
              />
              <span className="sr-only">
                {step.label}:{" "}
                {isCurrent ? "actual" : isComplete ? "completado" : "pendiente"}
              </span>
              <span className="mt-2 hidden truncate text-xs font-semibold text-content-muted sm:block">
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
