"use client";

import { useState } from "react";
import { Form } from "react-aria-components";
import {
  Alert,
  Button,
  NumberField,
  SelectField,
  TextField,
} from "../../../../../../ui";
import type {
  BusinessSummary,
  ProgramKind,
  ProgramSummary,
} from "../_lib/contracts";
import { createProgram, WizardApiError } from "../_lib/onboarding-api";
import { ImpactCalculator } from "./program-impact";

type FieldErrors = Record<string, string | undefined>;

function parseDecimal(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

export function ProgramStep({
  business,
  currencyCode,
  apiError,
  onError,
  onComplete,
}: {
  business: BusinessSummary | null;
  currencyCode: string | null;
  apiError: WizardApiError | null;
  onError: (error: WizardApiError | null) => void;
  onComplete: (program: ProgramSummary) => void;
}) {
  const [kind, setKind] = useState<ProgramKind>("stamps");
  const [target, setTarget] = useState(8);
  const [reward, setReward] = useState("");
  const [pointsGranted, setPointsGranted] = useState(10);
  const [purchaseAmount, setPurchaseAmount] = useState("");
  const [rewardPointsCost, setRewardPointsCost] = useState(100);
  const [rewardCost, setRewardCost] = useState("");
  const [purchaseValue, setPurchaseValue] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const parsedRewardCost = parseDecimal(rewardCost);
  const parsedPurchaseValue = parseDecimal(purchaseValue);
  const estimatedRevenue =
    parsedPurchaseValue !== null && parsedPurchaseValue > 0
      ? parsedPurchaseValue * target
      : null;
  const revenueAfterReward =
    estimatedRevenue !== null && parsedRewardCost !== null
      ? estimatedRevenue - parsedRewardCost
      : null;
  const rewardShare =
    estimatedRevenue !== null &&
    estimatedRevenue > 0 &&
    parsedRewardCost !== null
      ? (parsedRewardCost / estimatedRevenue) * 100
      : null;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: FieldErrors = {};
    if (!reward.trim()) {
      nextErrors.reward = "Escribí el premio que recibirá el cliente.";
    }
    if (
      kind === "stamps" &&
      (!Number.isInteger(target) || target < 2 || target > 50)
    ) {
      nextErrors.target = "Elegí un número entero entre 2 y 50.";
    }
    const parsedAmount = parseDecimal(purchaseAmount);
    if (kind === "points") {
      if (!Number.isInteger(pointsGranted) || pointsGranted <= 0) {
        nextErrors.pointsGranted = "Ingresá un número entero mayor que 0.";
      }
      if (
        parsedAmount === null ||
        parsedAmount <= 0 ||
        parsedAmount > 9999999999.99
      ) {
        nextErrors.purchaseAmount =
          "Ingresá un monto mayor que 0, con hasta 2 decimales y dentro del límite permitido.";
      }
      if (!Number.isInteger(rewardPointsCost) || rewardPointsCost <= 0) {
        nextErrors.rewardPointsCost = "Ingresá un número entero mayor que 0.";
      }
    }
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setIsSubmitting(true);
    onError(null);
    try {
      onComplete(
        await createProgram(
          kind === "stamps"
            ? { kind, target, rewardLabel: reward }
            : {
                kind,
                pointsGranted,
                purchaseAmount: parsedAmount!.toFixed(2),
                rewardLabel: reward,
                rewardPointsCost,
              },
        ),
      );
    } catch (caught) {
      onError(
        caught instanceof WizardApiError
          ? caught
          : new WizardApiError("No pudimos crear tu programa.", 503),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <header className="mb-8 grid gap-5">
        <div>
          <p className="mb-2 text-sm font-bold text-primary">Paso 3 de 3</p>
          <h1
            id="wizard-heading"
            tabIndex={-1}
            className="text-2xl font-bold leading-tight outline-none sm:text-3xl"
          >
            Creá tu programa de fidelización
          </h1>
          <p className="mt-2 leading-6 text-content-muted">
            Elegí cómo querés premiar a los clientes de{" "}
            {business?.name ?? "tu negocio"}.
          </p>
        </div>
      </header>
      <Form onSubmit={submit} className="grid gap-5">
        {apiError && (
          <Alert kind="error" title="No pudimos continuar">
            {apiError.message}
          </Alert>
        )}
        <SelectField
          label="Modalidad del programa"
          selectedKey={kind}
          onSelectionChange={(key) => {
            if (key === "stamps" || key === "points") setKind(key);
            setErrors({});
          }}
          options={[
            {
              id: "stamps",
              label: "Sellos",
              description: "Un sello por cada compra.",
            },
            {
              id: "points",
              label: "Puntos",
              description: "Puntos según el monto de compra.",
            },
          ]}
          isRequired
        />
        {kind === "stamps" ? (
          <NumberField
            label="Sellos para ganar"
            description="Podés elegir entre 2 y 50. Recomendamos una meta fácil de entender."
            minValue={2}
            maxValue={50}
            value={target}
            onChange={setTarget}
            isRequired
            isInvalid={Boolean(errors.target)}
            errorMessage={errors.target}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              label="Puntos otorgados"
              description="Cuántos puntos recibe el cliente."
              minValue={1}
              value={pointsGranted}
              onChange={setPointsGranted}
              isRequired
              isInvalid={Boolean(errors.pointsGranted)}
              errorMessage={errors.pointsGranted}
            />
            <TextField
              label="Monto de compra requerido"
              description={`Moneda: ${currencyCode ?? "la de tu negocio"}.`}
              name="purchaseAmount"
              value={purchaseAmount}
              onChange={setPurchaseAmount}
              inputMode="decimal"
              placeholder="Ej.: 5,00"
              isRequired
              isInvalid={Boolean(errors.purchaseAmount)}
              errorMessage={errors.purchaseAmount}
            />
          </div>
        )}
        <TextField
          label="Premio"
          name="reward"
          value={reward}
          onChange={setReward}
          placeholder="Por ejemplo: Café gratis"
          isRequired
          isInvalid={Boolean(errors.reward)}
          errorMessage={errors.reward}
        />
        {kind === "points" && (
          <NumberField
            label="Costo del premio en puntos"
            description="Cuántos puntos necesita el cliente para canjearlo."
            minValue={1}
            value={rewardPointsCost}
            onChange={setRewardPointsCost}
            isRequired
            isInvalid={Boolean(errors.rewardPointsCost)}
            errorMessage={errors.rewardPointsCost}
          />
        )}
        {kind === "stamps" && (
          <ImpactCalculator
            target={target}
            currencyCode={currencyCode}
            rewardCost={rewardCost}
            purchaseValue={purchaseValue}
            onRewardCostChange={setRewardCost}
            onPurchaseValueChange={setPurchaseValue}
            estimatedRevenue={estimatedRevenue}
            revenueAfterReward={revenueAfterReward}
            rewardShare={rewardShare}
          />
        )}
        <div className="rounded-md bg-primary-soft p-4 text-sm leading-5 text-content">
          {kind === "stamps"
            ? "CheckPass configura automáticamente un sello por compra y el sello visual inicial."
            : "CheckPass configura el programa con las unidades Punto y Puntos."}
        </div>
        <Button type="submit" fullWidth isLoading={isSubmitting}>
          {isSubmitting ? "Activando programa…" : "Activar programa"}
        </Button>
      </Form>
    </>
  );
}
