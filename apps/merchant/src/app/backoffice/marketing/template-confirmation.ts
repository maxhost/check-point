import type { TemplateView } from "./marketing-types";
import type { TemplateDraft } from "./template-draft";
import { rewardConfirmation } from "./reward-draft";

const crossAudienceLabels = {
  non_members: "Personas que aún no son clientes",
  dormant: "Clientes dormidos",
  any: "Cualquiera de los dos públicos",
};

export function templateConfirmation(
  template: TemplateView,
  draft: TemplateDraft,
  timeZone: string,
  currencyCode: string,
) {
  const lines = template.welcome
    ? [
        "Entrega: al abrir CheckPass desde el inicio y activar notificaciones",
        `Válido: ${draft.welcomeRedeemFrom === "same_visit" ? "en la misma visita" : "desde el día siguiente"}`,
        `Vence a los: ${draft.welcomeValidDays} días`,
        `Aviso push: ${draft.welcomeReminderDays} días antes`,
        `Tope mensual: ${draft.welcomeMonthlyCap} regalos por negocio`,
      ]
    : template.cross
      ? [
          "Aparece en: Mis beneficios",
          `Público: ${draft.crossAudience ? crossAudienceLabels[draft.crossAudience] : "Sin elegir"}`,
          ...(draft.crossAudience === "dormant"
            ? [`Ausencia: ${draft.dormantDays} días`]
            : []),
          `Vigencia desde el reclamo: ${draft.crossValidDays} días`,
          `Tope mensual: ${draft.crossMonthlyCap} cupones reclamados por negocio`,
        ]
      : [
          `Canales: ${draft.channels.map((channel) => (channel === "push" ? "Push" : "Proximidad")).join(" y ")}`,
          `Ausencia: ${draft.dormantDays} días`,
        ];
  lines.push(
    `Mensaje: ${draft.message.trim()}`,
    `Inicio: ${draft.startsAt || "Ahora"}`,
    `Fin: ${draft.endsAt || "Sin fecha de fin"}`,
  );
  if (draft.coupon)
    lines.push(
      `Premio: ${rewardConfirmation(draft, currencyCode, !template.welcome && !template.cross)}`,
    );
  if (template.nearReward)
    lines.push(
      `Umbral: ${draft.nearRewardStamps} sellos o ${draft.nearRewardPercent} % en puntos`,
    );
  if (template.repeat)
    lines.push(
      `Repetición: ${draft.rewardRepeat === "every_30_days" ? "cada 30 días, hasta dos veces" : "una vez"}`,
    );
  lines.push(`Zona horaria: ${timeZone}`);
  return lines.join("\n");
}
