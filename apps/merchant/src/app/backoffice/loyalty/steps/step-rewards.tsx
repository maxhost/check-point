import { formatMoney, spendToRedeem } from "../format";
import type { RewardDraft, RewardType } from "../use-rewards";
import type { LoyaltyVm } from "../use-loyalty-program";

const TYPE_LABELS: Record<RewardType, string> = {
  catalog_product: "Producto del catálogo",
  custom: "Premio libre",
  discount: "Descuento %",
};

function RewardCard({
  vm,
  reward,
  index,
}: {
  vm: LoyaltyVm;
  reward: RewardDraft;
  index: number;
}) {
  const earn = vm.earn;
  const isPoints = vm.kind === "points";
  const patch = (next: Partial<RewardDraft>) => earn.patch(index, next);

  return (
    <li className="reward-card">
      <div className="reward-head">
        <div
          className="reward-type"
          role="radiogroup"
          aria-label="Tipo de premio"
        >
          {(Object.keys(TYPE_LABELS) as RewardType[]).map((type) => (
            <label
              key={type}
              className={`chip ${reward.type === type ? "selected" : ""}`}
            >
              <input
                className="sr-only"
                type="radio"
                checked={reward.type === type}
                onChange={() => patch({ type })}
              />
              {TYPE_LABELS[type]}
            </label>
          ))}
        </div>
        {isPoints && earn.rewards.length > 1 && (
          <button
            type="button"
            className="reward-remove"
            onClick={() => earn.remove(index)}
          >
            Quitar
          </button>
        )}
      </div>

      {reward.type === "catalog_product" &&
        (earn.products.length === 0 ? (
          <p className="form-hint">
            No hay productos en tu catálogo. Usá un premio libre o un descuento.
          </p>
        ) : (
          <label className="reward-field">
            Producto
            <select
              value={reward.productId ?? ""}
              onChange={(event) => {
                const product = earn.products.find(
                  (item) => item.id === event.target.value,
                );
                patch({
                  productId: product?.id ?? null,
                  label: product?.name ?? "",
                });
              }}
            >
              <option value="">Elegí un producto…</option>
              {earn.products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                  {product.unitPrice !== null
                    ? ` — ${formatMoney(product.unitPrice, vm.currencyCode)}`
                    : ""}
                </option>
              ))}
            </select>
          </label>
        ))}

      {reward.type === "custom" && (
        <label className="reward-field">
          Nombre del premio
          <input
            value={reward.label}
            onChange={(event) => patch({ label: event.target.value })}
            placeholder="Café gratis"
          />
        </label>
      )}

      {reward.type === "discount" && (
        <label className="reward-field">
          Porcentaje de descuento
          <input
            type="number"
            min={1}
            max={100}
            step={1}
            value={reward.discountPercent}
            onChange={(event) => {
              const next = Number(event.target.value);
              patch({
                discountPercent: Number.isFinite(next) ? Math.trunc(next) : 0,
              });
            }}
          />
        </label>
      )}

      {isPoints && (
        <label className="reward-field">
          Costo en puntos
          <input
            type="number"
            min={1}
            step={1}
            value={reward.pointsCost}
            onChange={(event) => {
              const next = Number(event.target.value);
              patch({
                pointsCost: Number.isFinite(next) ? Math.trunc(next) : 0,
              });
            }}
          />
          {reward.pointsCost > 0 && (
            <span className="reward-equiv">
              El cliente gasta{" "}
              <strong>
                ≈{" "}
                {formatMoney(
                  spendToRedeem(
                    reward.pointsCost,
                    earn.blockAmount,
                    earn.grant,
                  ),
                  vm.currencyCode,
                )}
              </strong>{" "}
              para juntar {reward.pointsCost} {vm.plural} y ganar este premio.
            </span>
          )}
        </label>
      )}
    </li>
  );
}

/** Step 4: the reward list (spec 0036). Puntos = 1..N canjes with points cost; Sellos = 1. */
export function StepRewards({ vm }: { vm: LoyaltyVm }) {
  const earn = vm.earn;
  const isPoints = vm.kind === "points";
  const blockAmount = Number(earn.blockAmount);
  const rateReady =
    isPoints &&
    Number.isFinite(blockAmount) &&
    blockAmount > 0 &&
    earn.grant > 0;
  return (
    <>
      <h2>Premios</h2>
      <p>
        {isPoints
          ? "Poné el costo en puntos de cada premio. Debajo te mostramos cuánto tiene que gastar el cliente para llegar a ese costo, según tu tasa."
          : "Elegí el premio que gana el cliente al completar la tarjeta."}
      </p>
      {rateReady && (
        <p className="reward-rate">
          Tu tasa de acumulación:{" "}
          <strong>
            {earn.grant} {vm.plural}
          </strong>{" "}
          por cada <strong>{formatMoney(blockAmount, vm.currencyCode)}</strong>{" "}
          que gasta el cliente.
        </p>
      )}
      <ul className="reward-list">
        {earn.rewards.map((reward, index) => (
          <RewardCard key={index} vm={vm} reward={reward} index={index} />
        ))}
      </ul>
      {isPoints && (
        <button type="button" className="reward-add" onClick={() => earn.add()}>
          + Agregar premio
        </button>
      )}
    </>
  );
}
