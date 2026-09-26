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
  const accumulation = accrual
    ? `${accrual.grant} ${unit} ${accrual.mode === "per_purchase" ? "por compra" : `cada ${formatMoney(Number(accrual.blockAmount), vm.currencyCode)} (${vm.currencyCode})`}`
    : "Por compra";
  const targetUnit =
    Number(configuration.target) !== 1 &&
    typeof configuration.unitPlural === "string" &&
    configuration.unitPlural
      ? configuration.unitPlural
      : unit;
  return (
    <>
      <section className="loyalty-section loyalty-program-view">
        <div className="loyalty-summary-heading">
          <h2>
            {program.kind === "points"
              ? "Programa de puntos"
              : "Programa de sellos"}
          </h2>
          <strong className="loyalty-program-status">
            {vm.isClosing ? "En cierre" : "Activo"}
          </strong>
        </div>
        <div className="loyalty-program-hero">
          <div className="loyalty-program-metric">
            <p className="loyalty-program-caption">
              {program.kind === "points" ? "Acumulación" : "Objetivo"}
            </p>
            <p className="loyalty-program-value">
              {program.kind === "points"
                ? (accrual?.grant ?? "Por compra")
                : String(configuration.target)}
            </p>
            <p className="loyalty-program-detail">
              {program.kind === "stamps"
                ? `${targetUnit} para completar`
                : accrual
                  ? `${accrual.grant === 1 ? configuration.unitSingular : unit} ${accrual.mode === "per_purchase" ? "por compra" : `cada ${formatMoney(Number(accrual.blockAmount), vm.currencyCode)} (${vm.currencyCode})`}`
                  : unit}
            </p>
            {program.kind === "points" && (
              <p className="loyalty-program-caption">
                Unidades: {String(configuration.unitSingular)} / {unit}
              </p>
            )}
          </div>
          {program.kind === "stamps" && (
            <div className="loyalty-program-preview">
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
            </div>
          )}
        </div>
        <dl className="loyalty-summary loyalty-program-rules">
          <div>
            <dt>Mecánica de acumulación</dt>
            <dd>{accumulation}</dd>
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
        <div className="loyalty-program-rewards">
          <h3>Premios</h3>
          <ul>
            {program.rewards.map((reward, index) => (
              <li key={index}>
                <div>
                  <strong>{reward.label}</strong>
                  <p className="loyalty-program-caption">
                    {reward.type === "discount"
                      ? `${reward.discountPercent}% de descuento`
                      : reward.type === "catalog_product"
                        ? "Producto del catálogo"
                        : "Premio libre"}
                  </p>
                </div>
                {program.kind === "points" && (
                  <span className="loyalty-program-cost">
                    {reward.pointsCost} {unit}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
        {vm.isClosing ? (
          <div className="loyalty-program-closing">
            <h3>Cierre programado</h3>
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
          </div>
        ) : null}
        {(!vm.isClosing || vm.isOwner) && (
          <div className="loyalty-actions loyalty-program-footer">
            {vm.isClosing ? (
              <Button
                isDisabled={vm.saving}
                onPress={() => vm.setConfirmCancel(true)}
              >
                Cancelar cierre
              </Button>
            ) : (
              <>
                <Button
                  isDisabled={vm.saving}
                  onPress={() => vm.setEditing(true)}
                >
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
              </>
            )}
          </div>
        )}
      </section>
      <section className="loyalty-section loyalty-program-terms">
        <h2>Términos y condiciones</h2>
        <p className="published-term">{program.termsMarkdown}</p>
      </section>
    </>
  );
}
