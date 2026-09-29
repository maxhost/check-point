import type { CampaignWelcome } from "./marketing-types";

export function WelcomeDetails({ welcome }: { welcome: CampaignWelcome }) {
  return (
    <>
      <div>
        <dt>Desde cuándo vale</dt>
        <dd>
          {welcome.redeemFrom === "same_visit"
            ? "En la misma visita"
            : "Desde el día siguiente"}
        </dd>
      </div>
      <div>
        <dt>Vigencia del regalo</dt>
        <dd>{welcome.validDays} días</dd>
      </div>
      <div>
        <dt>Aviso antes del vencimiento</dt>
        <dd>{welcome.reminderDays} días antes</dd>
      </div>
      <div>
        <dt>Tope de regalos por mes</dt>
        <dd>{welcome.monthlyCap} por negocio</dd>
      </div>
    </>
  );
}
