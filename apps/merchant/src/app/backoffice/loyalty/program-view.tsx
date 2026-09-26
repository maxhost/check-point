import { Button } from "../../../ui";
import { CardPreview } from "../../../components/loyalty/card-preview";
import { formatDate } from "./ui";
import { formatMoney } from "./format";
import type { LoyaltyVm } from "./use-loyalty-program";
export function ProgramView({ vm }: { vm: LoyaltyVm }) {
  const program = vm.program;
  if (!program) return null;
  const configuration = program.configuration;
  const accrual = program.accrual;
  const unit =
    program.kind === "points"
      ? String(configuration.unitPlural)
      : String(configuration.unitName ?? "sello");
  return (
    <>
      <section className="loyalty-section">
        <div className="loyalty-summary-heading">
          <h2>
            {program.kind === "points"
              ? "Programa de puntos"
              : "Programa de sellos"}
          </h2>
          <strong>{vm.isClosing ? "En cierre" : "Activo"}</strong>
        </div>
        <dl className="loyalty-summary">
          <div>
            <dt>{program.kind === "points" ? "Unidades" : "Objetivo"}</dt>
            <dd>
              {program.kind === "points"
                ? `${configuration.unitSingular} / ${configuration.unitPlural}`
                : `${configuration.target} ${unit} para completar`}
            </dd>
          </div>
          <div>
            <dt>Acumulación</dt>
            <dd>
              {accrual
                ? `${accrual.grant} ${unit} ${accrual.mode === "per_purchase" ? "por compra" : `cada ${formatMoney(Number(accrual.blockAmount), vm.currencyCode)} (${vm.currencyCode})`}`
                : "Por compra"}
            </dd>
          </div>
          <div>
            <dt>Canje sin saldo suficiente</dt>
            <dd>
              {program.redeemAllowInsufficient
                ? "Permitido; el saldo queda en 0 y se registra la entrega."
                : "No permitido"}
            </dd>
          </div>
        </dl>
        <h3>Premios</h3>
        <ul className="loyalty-fields">
          {program.rewards.map((reward, index) => (
            <li key={index}>
              {reward.type === "discount"
                ? `${reward.discountPercent}% de descuento`
                : reward.label}
              {program.kind === "points"
                ? ` — ${reward.pointsCost} ${unit}`
                : ""}
            </li>
          ))}
        </ul>
        {program.kind === "stamps" && (
          <CardPreview
            target={Number(configuration.target)}
            design={{
              backgroundColor:
                program.cardBackgroundColor ??
                vm.context!.business.brandPrimaryColor,
              backgroundColor2: program.cardBackgroundColor2,
              gradientAngle: program.cardBackgroundGradientAngle,
              borderColor:
                program.cardBorderColor ??
                vm.context!.business.brandAccentColor,
            }}
            stampImagePath={program.stampImagePath}
          />
        )}
        {vm.isClosing ? (
          <>
            <dl className="loyalty-summary">
              <div>
                <dt>Fin de acumulación</dt>
                <dd>{formatDate(program.earningEndsAt, vm.timezone)}</dd>
              </div>
              <div>
                <dt>Canje hasta</dt>
                <dd>{formatDate(program.redemptionEndsAt, vm.timezone)}</dd>
              </div>
            </dl>
            <p>
              Zona horaria: {vm.timezone}. No se puede editar durante el cierre.
            </p>
            {vm.isOwner && (
              <Button
                isDisabled={vm.saving}
                onPress={() => vm.setConfirmCancel(true)}
              >
                Cancelar cierre
              </Button>
            )}
          </>
        ) : (
          <div className="loyalty-actions">
            <Button isDisabled={vm.saving} onPress={() => vm.setEditing(true)}>
              Editar programa
            </Button>
            {vm.isOwner && (
              <Button
                variant="secondary"
                isDisabled={vm.saving}
                onPress={() => vm.setClosing(true)}
              >
                Cerrar programa
              </Button>
            )}
          </div>
        )}
      </section>
      <section className="loyalty-section">
        <h2>Términos y condiciones</h2>
        <p className="published-term">{program.termsMarkdown}</p>
      </section>
    </>
  );
}
