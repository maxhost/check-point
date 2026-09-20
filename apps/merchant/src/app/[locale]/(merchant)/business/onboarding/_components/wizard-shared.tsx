"use client";

import {
  Alert,
  ProgressIndicator,
  type OwnerGateErrorCode,
} from "../../../../../../ui";
import type { WizardApiError } from "../_lib/onboarding-api";

export const steps = [
  { label: "Cuenta" },
  { label: "Negocio" },
  { label: "Programa" },
];

const gateCodes = new Set<OwnerGateErrorCode>([
  "unauthorized",
  "not_owner",
  "email_not_verified",
  "business_suspended",
  "business_closed",
]);

export function gateCode(error: WizardApiError | null) {
  return error?.code && gateCodes.has(error.code as OwnerGateErrorCode)
    ? (error.code as OwnerGateErrorCode)
    : null;
}

export function StepHeader({
  step,
  title,
  description,
}: {
  step: number;
  title: string;
  description: string;
}) {
  return (
    <header className="mb-8 grid gap-5">
      <ProgressIndicator currentStep={step} steps={steps} />
      <div>
        <p className="mb-2 text-sm font-bold text-primary">CheckPass Club</p>
        <h1
          id="wizard-heading"
          tabIndex={-1}
          className="text-2xl font-bold leading-tight outline-none sm:text-3xl"
        >
          {title}
        </h1>
        <p className="mt-2 leading-6 text-content-muted">{description}</p>
      </div>
    </header>
  );
}

export function InlineApiError({ error }: { error: WizardApiError | null }) {
  if (!error) return null;
  return (
    <Alert kind="error" title="No pudimos continuar">
      {error.message}
    </Alert>
  );
}
