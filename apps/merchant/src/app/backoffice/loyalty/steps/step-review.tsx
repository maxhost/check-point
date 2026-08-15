import { CardPreview } from "../card-preview";
import { formatMoney, spendToRedeem } from "../format";
import type { RewardDraft } from "../use-rewards";
import type { LoyaltyVm } from "../use-loyalty-program";

type Metric = {
  headline: string | null;
  pct: string | null;
  caution: string | null;
  spendLines: string[];
  note: string | null;
};

/** Sales a single redemption of `reward` drives (0 when there is no $ figure, e.g. Sellos por compra). */
function rewardSpend(vm: LoyaltyVm, reward: RewardDraft): number {
  const earn = vm.earn;
  if (vm.kind === "points") {
    return spendToRedeem(reward.pointsCost, earn.blockAmount, earn.grant);
  }
  const block = Number(earn.blockAmount);
  return earn.effectiveMode("stamps") === "per_amount" && Number.isFinite(block)
    ? vm.target * block
    : 0;
}

/** `+51%` / `-20%`, the sales generated over the reward value (ratio − 1). */
function pctOver(ratio: number): number {
  return Math.round((ratio - 1) * 100);
}

/**
 * Value metric shown in the preview (spec 0036, paso 5). All derived, nothing persisted:
 * frames the sales a reward drives against its value — as an absolute figure, a "$1 →
 * $N" ratio and a "+X% over what you give away" return. Warns when a reward gives away
 * more than it drives (so the owner never loses money). Sellos por compra → "N compras".
 */
function buildValueMetric(vm: LoyaltyVm): Metric | null {
  const earn = vm.earn;
  const mode = earn.effectiveMode(vm.kind);
  const priceOf = (id: string | null) =>
    id ? (earn.products.find((p) => p.id === id)?.unitPrice ?? null) : null;

  if (vm.kind === "stamps" && mode === "per_purchase") {
    return {
      headline: `Cada premio se gana con ${vm.target} compras.`,
      pct: null,
      caution: null,
      spendLines: [],
      note: null,
    };
  }

  const ratios: number[] = [];
  const spendLines: string[] = [];
  for (const reward of earn.rewards) {
    const spend = rewardSpend(vm, reward);
    const value =
      reward.type === "catalog_product" ? priceOf(reward.productId) : null;
    if (value && value > 0 && spend > 0) {
      ratios.push(spend / value);
    } else if (spend > 0) {
      spendLines.push(
        `${reward.label || "Premio"}: el cliente gasta ~${formatMoney(spend, vm.currencyCode)} para ganarlo.`,
      );
    }
  }

  let headline: string | null = null;
  let pct: string | null = null;
  let caution: string | null = null;
  let note: string | null = null;
  if (ratios.length > 0) {
    const one = formatMoney(1, vm.currencyCode);
    const min = Math.min(...ratios);
    const max = Math.max(...ratios);
    const same = Math.abs(min - max) < 0.005;
    headline = same
      ? `Cada ${one} en premios mueve ~${formatMoney(min, vm.currencyCode)} en ventas.`
      : `Cada ${one} en premios mueve entre ~${formatMoney(min, vm.currencyCode)} y ~${formatMoney(max, vm.currencyCode)} en ventas.`;
    if (min >= 1) {
      const lo = pctOver(min);
      const hi = pctOver(max);
      pct =
        lo === hi
          ? `Generás un ${lo}% más en ventas de lo que regalás en premios.`
          : `Generás entre un ${lo}% y un ${hi}% más en ventas de lo que regalás.`;
    } else {
      caution =
        "En al menos un premio entregás más valor del que genera en ventas. Subí su costo en puntos para no perder dinero.";
    }
    note = "Asume que todos canjean; los que no, son ganancia extra.";
  }
  if (!headline && spendLines.length === 0) return null;
  return { headline, pct, caution, spendLines, note };
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
        {vm.earn.rewards.map((reward, index) => {
          const spend = rewardSpend(vm, reward);
          const label =
            reward.label ||
            (reward.type === "discount"
              ? `${reward.discountPercent}% de descuento`
              : "Premio");
          return (
            <li key={index}>
              <span className="review-reward-name">
                {label}
                {vm.kind === "points" ? ` — ${reward.pointsCost} pts` : ""}
              </span>
              {spend > 0 && (
                <span className="review-reward-sales">
                  Cada canje ≈ {formatMoney(spend, vm.currencyCode)} en ventas
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {metric && (
        <section className="value-metric">
          <h3>Valor del programa</h3>
          {metric.headline && (
            <p className="value-metric-headline">{metric.headline}</p>
          )}
          {metric.pct && <p className="value-metric-pct">{metric.pct}</p>}
          {metric.caution && (
            <p className="value-metric-caution">{metric.caution}</p>
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
