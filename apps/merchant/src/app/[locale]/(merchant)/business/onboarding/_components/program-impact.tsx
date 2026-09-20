import { TextField } from "../../../../../../ui";

const currencySymbols: Record<string, string> = {
  ARS: "AR$",
  BRL: "R$",
  CLP: "CL$",
  COP: "CO$",
  USD: "US$",
  MXN: "MX$",
  PEN: "S/",
  PYG: "₲",
  UYU: "$U",
};

function formatMoney(value: number, currencyCode: string | null) {
  const amount = new Intl.NumberFormat("es", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  if (!currencyCode) return amount;
  return `${currencySymbols[currencyCode] ?? currencyCode} ${amount}`;
}

export function ImpactCalculator(props: {
  target: number;
  currencyCode: string | null;
  rewardCost: string;
  purchaseValue: string;
  onRewardCostChange: (value: string) => void;
  onPurchaseValueChange: (value: string) => void;
  estimatedRevenue: number | null;
  revenueAfterReward: number | null;
  rewardShare: number | null;
}) {
  return (
    <section
      aria-labelledby="program-impact-title"
      className="grid gap-4 rounded-lg border border-border bg-surface-subtle p-4 sm:p-5"
    >
      <div>
        <h2 id="program-impact-title" className="text-lg font-bold">
          Calculá el impacto del premio
        </h2>
        <p className="mt-1 text-sm leading-5 text-content-muted">
          Es una estimación opcional. No modifica las reglas del programa.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Costo unitario del premio"
          name="rewardCost"
          value={props.rewardCost}
          onChange={props.onRewardCostChange}
          inputMode="decimal"
          autoComplete="off"
          placeholder="Ej.: 0,50"
        />
        <TextField
          label="Valor promedio por compra"
          name="purchaseValue"
          value={props.purchaseValue}
          onChange={props.onPurchaseValueChange}
          inputMode="decimal"
          autoComplete="off"
          placeholder="Ej.: 2,00"
        />
      </div>
      {props.estimatedRevenue !== null && props.rewardCost !== "" && (
        <div className="grid gap-3" aria-live="polite">
          <div className="grid gap-3 sm:grid-cols-2">
            <ImpactValue
              label="Gasto para alcanzar la meta"
              value={formatMoney(props.estimatedRevenue, props.currencyCode)}
            />
            <ImpactValue
              label="Facturación menos premio"
              value={formatMoney(
                props.revenueAfterReward ?? 0,
                props.currencyCode,
              )}
            />
          </div>
          {props.rewardShare !== null && (
            <div className="rounded-md bg-accent p-3 text-sm font-bold leading-5 text-on-accent">
              El premio equivale al {props.rewardShare.toFixed(1)}% de la
              facturación estimada de cada ciclo de {props.target} sellos.
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ImpactValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-primary p-4 text-on-primary shadow-sm">
      <span className="block text-sm font-semibold leading-5 text-on-primary">
        {label}
      </span>
      <span className="mt-1 block text-xl font-bold text-on-primary">
        {value}
      </span>
    </div>
  );
}
