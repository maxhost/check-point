import { CardPreview } from "../card-preview";
import { formatMoney, spendToRedeem } from "../format";
import type { LoyaltyVm } from "../use-loyalty-program";

type Metric = {
  ratioLine: string | null;
  spendLines: string[];
  note: string | null;
};

/**
 * Value metric shown in the preview (spec 0036, paso 5). All derived, nothing persisted:
 * - per_amount with monetary rewards → "por cada $1 en premios, ~$N en ventas".
 * - Sellos per_purchase → "N compras por premio", sin ratio en $.
 * - Rewards without a reference price → "hay que gastar ~$X", sin ratio.
 */
function buildValueMetric(vm: LoyaltyVm): Metric | null {
  const earn = vm.earn;
  const mode = earn.effectiveMode(vm.kind);
  const priceOf = (id: string | null) =>
    id ? (earn.products.find((p) => p.id === id)?.unitPrice ?? null) : null;

  if (vm.kind === "stamps" && mode === "per_purchase") {
    return {
      ratioLine: `${vm.target} compras por cada premio.`,
      spendLines: [],
      note: null,
    };
  }

  const block = Number(earn.blockAmount);
  const stampSpend = vm.target * (Number.isFinite(block) ? block : 0);
  const ratios: number[] = [];
  const spendLines: string[] = [];
  for (const reward of earn.rewards) {
    const spend =
      vm.kind === "points"
        ? spendToRedeem(reward.pointsCost, earn.blockAmount, earn.grant)
        : stampSpend;
    const value =
      reward.type === "catalog_product" ? priceOf(reward.productId) : null;
    if (value && value > 0 && spend > 0) {
      ratios.push(spend / value);
    } else if (spend > 0) {
      spendLines.push(
        `${reward.label || "Premio"}: hay que gastar ~${formatMoney(spend, vm.currencyCode)}.`,
      );
    }
  }

  let ratioLine: string | null = null;
  let note: string | null = null;
  if (ratios.length > 0) {
    const one = formatMoney(1, vm.currencyCode);
    const min = Math.min(...ratios);
    const max = Math.max(...ratios);
    ratioLine =
      Math.abs(min - max) < 0.005
        ? `Por cada ${one} en premios, tu programa te genera ~${formatMoney(min, vm.currencyCode)} en ventas.`
        : `Por cada ${one} en premios, tu programa te genera entre ~${formatMoney(min, vm.currencyCode)} y ~${formatMoney(max, vm.currencyCode)} en ventas.`;
    note = "Asume que todos canjean; los que no, son ganancia.";
  }
  if (!ratioLine && spendLines.length === 0) return null;
  return { ratioLine, spendLines, note };
}

export function StepReview({ vm }: { vm: LoyaltyVm }) {
  const stampPreview =
    vm.stamp.preview ??
    (!vm.stamp.removed ? (vm.program?.stampImagePath ?? null) : null);
  const metric = buildValueMetric(vm);
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
      <h3>Premios</h3>
      <ul className="review-rewards">
        {vm.earn.rewards.map((reward, index) => (
          <li key={index}>
            {reward.label ||
              (reward.type === "discount"
                ? `${reward.discountPercent}% de descuento`
                : "Premio")}
            {vm.kind === "points" ? ` — ${reward.pointsCost} pts` : ""}
          </li>
        ))}
      </ul>
      {metric && (
        <section className="value-metric">
          <h3>Valor del programa</h3>
          {metric.ratioLine && (
            <p className="value-metric-headline">{metric.ratioLine}</p>
          )}
          {metric.spendLines.map((line, index) => (
            <p key={index} className="value-metric-spend">
              {line}
            </p>
          ))}
          {metric.note && <p className="value-metric-note">{metric.note}</p>}
        </section>
      )}
      <h3>Términos y condiciones</h3>
      <p className="published-term">{vm.terms || "—"}</p>
    </>
  );
}
