import type { CampaignResults as ServerResults } from "../../../server/marketing/results";
import type {
  CampaignResults,
  Channel,
  Effect,
  Quality,
} from "./marketing-types";
import { MarketingPanel } from "./marketing-ui";
import { QUALITY_LABELS } from "./campaign-labels";
import { money, REWARD_KIND_LABELS } from "./reward-labels";

type Results = CampaignResults | ServerResults;
function QualityMark({ value }: { value: Quality }) {
  return (
    <span className="text-xs font-semibold uppercase tracking-wide text-content-muted">
      {QUALITY_LABELS[value]}
    </span>
  );
}
function ResultCard({
  title,
  quality,
  children,
}: {
  title: string;
  quality: Quality;
  children: React.ReactNode;
}) {
  return (
    <article className="rounded-md border border-border bg-surface-subtle p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-bold">{title}</h3>
        <QualityMark value={quality} />
      </div>
      <div className="mt-3 grid gap-1 text-sm leading-6">{children}</div>
    </article>
  );
}
function EffectText({
  effect,
  unit = "turnos retenidos",
}: {
  effect: Effect;
  unit?: string;
}) {
  return effect.quality === "estimada" ? (
    <p>
      Estimación del efecto: {effect.extraCustomers >= 0 ? "+" : ""}
      {effect.extraCustomers} clientes <QualityMark value={effect.quality} />
    </p>
  ) : (
    <p>
      Todavía sin señal: hacen falta {effect.needed} {unit} y hay{" "}
      {effect.holdoutN}. <QualityMark value={effect.quality} />
    </p>
  );
}

export function CampaignResultsView({
  results,
  currencyCode,
  channels = ["proximity"],
  isWelcome = false,
}: {
  results: Results;
  currencyCode: string;
  channels?: Channel[];
  isWelcome?: boolean;
}) {
  const {
    audience,
    turns,
    windowPurchases,
    effect,
    coupon,
    byLocation,
    passReach,
    push,
  } = results;
  return (
    <MarketingPanel
      title="Resultados"
      description="Las cifras observadas y las estimaciones se identifican por separado."
    >
      {push && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <ResultCard title="Push enviados" quality={push.quality}>
            <p>
              {push.decided} decididos · {push.held} retenidos como grupo de
              control
            </p>
            <p>
              {push.sent} enviados · {push.pending} pendientes
            </p>
            <p>
              {push.clicked} clics observados en Web Push. Wallet no informa
              aperturas.
            </p>
          </ResultCard>
          <ResultCard title="Compras después del push" quality={push.quality}>
            <p>
              Ventana de {push.conversion.windowDays} días, solo envíos que ya
              la completaron.
            </p>
            <p>
              Enviados: {push.conversion.sent.purchases} de{" "}
              {push.conversion.sent.of}
            </p>
            <p>
              Retenidos: {push.conversion.held.purchases} de{" "}
              {push.conversion.held.of}
            </p>
            <EffectText effect={push.effect} unit="avisos retenidos" />
          </ResultCard>
          <ResultCard title="Push cancelados" quality={push.quality}>
            <p>
              {push.cancelled.campaign_inactive} por campaña inactiva ·{" "}
              {push.cancelled.membership_gone} por membresía ausente
            </p>
            <p>
              {push.cancelled.opt_out} por baja de promociones ·{" "}
              {push.cancelled.visited} por compra o canje posterior
            </p>
          </ResultCard>
        </div>
      )}
      {channels.includes("proximity") && (
        <div className="grid gap-4 sm:grid-cols-2">
          <ResultCard
            title="Audiencia del último tick"
            quality={audience.quality}
          >
            {audience.photo === null ? (
              <p>Todavía no corrió ningún tick sobre esta campaña.</p>
            ) : (
              <>
                <p>{audience.photo.total} personas en la audiencia</p>
                <p>{audience.photo.reachable} alcanzables por Wallet</p>
                <p>{audience.photo.noLocation} sin local atribuible</p>
                <p>{audience.photo.optOut} con las promociones apagadas</p>
                <p>{audience.photo.cooldown} en cooldown</p>
              </>
            )}
          </ResultCard>
          <ResultCard title="Turnos" quality={turns.quality}>
            <p>
              {turns.queued} en cola · {turns.active} activos
            </p>
            <p>
              {turns.done} terminados · {turns.held} retenidos ·{" "}
              {turns.cancelled} cancelados
            </p>
          </ResultCard>
          <ResultCard
            title={windowPurchases.title}
            quality={windowPurchases.quality}
          >
            <p>
              Con turno: {windowPurchases.placed.purchases} de{" "}
              {windowPurchases.placed.of}
            </p>
            <p>
              Retenidos: {windowPurchases.held.purchases} de{" "}
              {windowPurchases.held.of}
            </p>
            <EffectText effect={effect} />
          </ResultCard>
          <ResultCard title="Por local" quality={byLocation.quality}>
            {byLocation.rows.length === 0 ? (
              <p>Todavía no hay turnos por local.</p>
            ) : (
              byLocation.rows.map((row) => (
                <p key={row.locationId}>
                  {row.name}: {row.turns} turnos · {row.windowPurchases}{" "}
                  compraron en su ventana · {row.redemptions} canjes
                </p>
              ))
            )}
          </ResultCard>
        </div>
      )}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <ResultCard title="Cupones" quality={coupon.quality}>
          {coupon.label === null ? (
            <p>Esta campaña no tiene cupón.</p>
          ) : (
            <p>
              {coupon.label}
              {coupon.kind ? ` · ${REWARD_KIND_LABELS[coupon.kind]}` : ""}:{" "}
              {coupon.redeemed}{" "}
              {isWelcome || coupon.cap === null
                ? "canjeados"
                : `de ${coupon.cap} canjeados`}{" "}
              ·{" "}
              {coupon.kind
                ? money(coupon.incurredCost ?? "0.00", currencyCode)
                : `${currencyCode} ${coupon.incurredCost ?? "0.00"}`}{" "}
              de costo estimado incurrido
            </p>
          )}
        </ResultCard>
        <ResultCard title="Alcance del pase" quality={passReach.quality}>
          <p>
            Estás en el pase de {passReach.inPass} de tus {passReach.members}{" "}
            clientes.
          </p>
        </ResultCard>
      </div>
    </MarketingPanel>
  );
}
