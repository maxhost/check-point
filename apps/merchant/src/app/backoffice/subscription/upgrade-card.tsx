"use client";

import { Card, Heading, Text, SegmentedControl } from "../../../ui";
import { billingPlanName, type BillingState } from "./billing-state";

export function UpgradeCard({
  label,
  billingInterval,
  selectedPlan,
  onSelectPlan,
  prices,
  trialDaysLeft,
  onSelectInterval,
  onCheckout,
  busy,
}: {
  /** Etiqueta de la oferta de alta decidida por el servidor. */
  label: string;
  selectedPlan: "base" | "plus";
  onSelectPlan: (plan: "base" | "plus") => void;
  prices: BillingState["prices"] | null;
  trialDaysLeft: number | null;
  billingInterval: "month" | "year";
  onSelectInterval: (interval: "month" | "year") => void;
  onCheckout: () => void;
  busy: boolean;
}) {
  return (
    <Card as="article" className="min-w-0 grid gap-5">
      <Heading level={2}>Elige tu plan</Heading>
      <SegmentedControl
        aria-label="Plan"
        options={[
          { id: "base", label: "Conecta" },
          { id: "plus", label: "Impulso" },
        ]}
        selectedKey={selectedPlan}
        onSelectionChange={(key) => onSelectPlan(key as "base" | "plus")}
        isDisabled={busy}
        fullWidth
      />
      <Text>
        {selectedPlan === "base"
          ? "Fidelización, bienvenida y venta cruzada. 1 local."
          : "Todo lo de Conecta, campañas avanzadas y hasta 3 locales."}
      </Text>
      <SegmentedControl
        aria-label="Período de facturación"
        options={[
          { id: "month", label: "Mensual" },
          { id: "year", label: "Anual" },
        ]}
        selectedKey={billingInterval}
        onSelectionChange={(key) => onSelectInterval(key as "month" | "year")}
        isDisabled={busy}
        fullWidth
      />
      <Heading level={3}>
        {prices
          ? `USD ${prices[selectedPlan][billingInterval]} / ${billingInterval === "year" ? "año" : "mes"}`
          : "Cargando precios…"}
      </Heading>
      {prices && billingInterval === "year" && (
        <Text variant="muted">
          Ahorras USD{" "}
          {prices[selectedPlan].month * 12 - prices[selectedPlan].year} al año.
        </Text>
      )}
      {trialDaysLeft !== null && (
        <Text variant="muted">
          Stripe te mostrará cuándo empieza el cobro. Si quedan menos de 48
          horas de prueba, el pago comienza al confirmar.
        </Text>
      )}
      <Text variant="small">
        Continuarás a Stripe para revisar {billingPlanName(selectedPlan)}, el
        período y el pago antes de confirmar.
      </Text>
      <button
        data-variant="primary"
        className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-base font-bold text-on-primary transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:border-disabled disabled:bg-disabled disabled:text-on-disabled"
        type="button"
        disabled={busy || prices === null}
        onClick={onCheckout}
      >
        {label}
      </button>
    </Card>
  );
}
