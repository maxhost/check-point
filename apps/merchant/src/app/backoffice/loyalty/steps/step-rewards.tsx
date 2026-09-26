import { NumberDraftField } from "../number-draft-field";
import {
  Alert,
  Button,
  CheckboxField,
  ChoiceGroup,
  SelectField,
  TextField,
} from "../../../../ui";
import { formatMoney, spendToRedeem } from "../format";
import type { RewardDraft, RewardType } from "../use-rewards";
import type { LoyaltyVm } from "../use-loyalty-program";
const types = [
  { value: "catalog_product", label: "Producto del catálogo" },
  { value: "custom", label: "Premio libre" },
  { value: "discount", label: "Descuento %" },
];
function RewardCard({
  vm,
  reward,
  index,
  errors,
}: {
  vm: LoyaltyVm;
  reward: RewardDraft;
  index: number;
  errors: Record<string, string>;
}) {
  const earn = vm.earn;
  const patch = (next: Partial<RewardDraft>) => earn.patch(index, next);
  const existing =
    reward.productId &&
    !earn.products.some((product) => product.id === reward.productId);
  const options = earn.products.map((product) => ({
    id: product.id,
    label:
      product.name +
      (product.unitPrice !== null
        ? ` — ${formatMoney(product.unitPrice, vm.currencyCode)}`
        : ""),
  }));
  if (existing)
    options.unshift({
      id: reward.productId!,
      label: reward.label || "Producto guardado",
    });
  return (
    <li className="loyalty-reward loyalty-fields">
      <h3>Premio {index + 1}</h3>
      <ChoiceGroup
        label="Tipo de premio"
        value={reward.type}
        onChange={(value) => patch({ type: value as RewardType })}
        options={types.filter(
          (type) =>
            vm.canReadCatalog ||
            type.value !== "catalog_product" ||
            reward.type === "catalog_product",
        )}
        isDisabled={vm.saving}
      />
      {reward.type === "catalog_product" && (
        <>
          {earn.catalogState === "loading" && (
            <p role="status">Cargando catálogo…</p>
          )}
          {earn.catalogState === "error" && (
            <Alert kind="error" title="No pudimos consultar el catálogo">
              <p>
                {earn.catalogError?.code === "missing_permission"
                  ? "No tenés permiso para consultar el catálogo."
                  : "Podés seguir con premio libre o descuento."}
              </p>
              <Button
                variant="secondary"
                onPress={() => void earn.loadCatalog(vm.canReadCatalog)}
              >
                Reintentar catálogo
              </Button>
            </Alert>
          )}
          {earn.catalogState === "ready" && earn.products.length === 0 && (
            <p>
              No hay productos en tu catálogo. Usá un premio libre o un
              descuento.
            </p>
          )}
          <SelectField
            label="Producto"
            options={options}
            selectedKey={reward.productId}
            onSelectionChange={(key) =>
              earn.selectProduct(
                index,
                earn.products.find((product) => product.id === key) ??
                  (key === reward.productId
                    ? {
                        id: reward.productId!,
                        name: reward.label,
                        unitPrice: null,
                      }
                    : null),
              )
            }
            placeholder="Elegí un producto"
            isDisabled={
              !vm.canReadCatalog || earn.catalogState !== "ready" || vm.saving
            }
            errorMessage={errors[`product-${index}`]}
            description={
              existing
                ? "Se conserva el producto guardado aunque no esté en el catálogo disponible."
                : undefined
            }
          />
        </>
      )}
      {reward.type === "custom" && (
        <TextField
          label="Nombre del premio"
          value={reward.label}
          onChange={(label) => patch({ label })}
          placeholder="Ej.: Café gratis"
          errorMessage={errors[`label-${index}`]}
        />
      )}
      {reward.type === "discount" && (
        <NumberDraftField
          label="Porcentaje de descuento"
          minValue={1}
          maxValue={100}
          step={1}
          value={reward.discountPercent}
          onChange={(discountPercent) => patch({ discountPercent })}
          description="Elegí un porcentaje entre 1 y 100 %."
          errorMessage={errors[`discount-${index}`]}
        />
      )}
      {vm.kind === "points" && (
        <NumberDraftField
          label="Costo en puntos"
          minValue={1}
          step={1}
          value={reward.pointsCost}
          onChange={(pointsCost) => patch({ pointsCost })}
          errorMessage={errors[`cost-${index}`]}
          description={`El cliente gasta ≈ ${formatMoney(spendToRedeem(reward.pointsCost, earn.blockAmount, earn.grant), vm.currencyCode)} para juntar ${reward.pointsCost} ${vm.plural} y ganar este premio.`}
        />
      )}
      {vm.kind === "points" && earn.rewards.length > 1 && (
        <Button variant="danger" onPress={() => earn.remove(index)}>
          Quitar premio {index + 1}
        </Button>
      )}
    </li>
  );
}
export function StepRewards({
  vm,
  errors,
}: {
  vm: LoyaltyVm;
  errors: Record<string, string>;
}) {
  const earn = vm.earn;
  return (
    <>
      <p>
        {vm.kind === "points"
          ? "Poné el costo en puntos de cada premio."
          : "Elegí el premio que gana el cliente al completar la tarjeta."}
      </p>
      {!vm.canReadCatalog && (
        <Alert title="No tenés permiso para consultar el catálogo">
          Podés usar premio libre o descuento. Los productos guardados se
          conservan.
        </Alert>
      )}
      <ul className="loyalty-fields">
        {earn.rewards.map((reward, index) => (
          <RewardCard
            key={index}
            vm={vm}
            reward={reward}
            index={index}
            errors={errors}
          />
        ))}
      </ul>
      {vm.kind === "points" && (
        <>
          <Button
            variant="secondary"
            isDisabled={earn.rewards.length >= 20}
            onPress={earn.add}
          >
            Agregar premio
          </Button>
          {earn.rewards.length >= 20 && (
            <p className="text-sm text-content-muted">
              Podés agregar hasta 20 premios.
            </p>
          )}
        </>
      )}
      <section className="loyalty-fields">
        <h3>Configuración avanzada</h3>
        <CheckboxField
          label="Permitir canjes sin saldo suficiente"
          isSelected={earn.allowInsufficient}
          onChange={earn.setAllowInsufficient}
          description={`Si está activo, tu mostrador puede entregar un premio aunque al cliente le falten ${vm.kind === "points" ? "puntos" : "sellos"}: se descuenta lo que tenga y su saldo queda en 0. Queda registrado como entrega sin saldo.`}
        />
      </section>
    </>
  );
}
