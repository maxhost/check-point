import {
  type CampaignAction,
  type CampaignStatus,
  nextStatus,
} from "../../../server/marketing/campaign-transitions";
import type { Quality } from "../../../server/marketing/results";

/**
 * What the two campaign screens SAY, in one place. The labels are here and not inline so
 * the listing and the detail cannot drift into calling the same status two things.
 *
 * The available actions are DERIVED from `nextStatus`, never re-listed: a second copy of
 * the transition table is how the detail page ends up offering a button the route answers
 * with 409 `invalid_transition`.
 */

export const STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: "Borrador",
  active: "Activa",
  paused: "Pausada",
  ended: "Finalizada",
  archived: "Archivada",
};

export const ACTION_LABELS: Record<CampaignAction, string> = {
  activate: "Activar",
  pause: "Pausar",
  end: "Finalizar",
  archive: "Archivar",
};

const ACTIONS: readonly CampaignAction[] = [
  "activate",
  "pause",
  "end",
  "archive",
];

export function availableActions(status: CampaignStatus): CampaignAction[] {
  return ACTIONS.filter((action) => nextStatus(status, action) !== null);
}

/** ADR 0021: every number carries its quality, and the four values are NOT synonyms —
 * an observed count is a fact, a configured estimate is arithmetic over a cost the owner
 * declared, and `estimada` is an inference from the holdout. */
export const QUALITY_LABELS: Record<Quality, string> = {
  observada: "Observada",
  estimada: "Estimada",
  estimado_configurado: "Estimado configurado",
  no_disponible: "No disponible",
};

/** `pause_reason` as the owner reads it. `owner` is their own hand; the other two are
 * written by billing and by the tick, and saying so is the difference between «la pausé
 * yo» and «me la pausaron». */
export const PAUSE_REASON_LABELS: Record<string, string> = {
  owner: "La pausaste vos.",
  plan_downgraded: "Se pausó al bajar de plan.",
  no_active_locations:
    "Se pausó porque no quedan locales activos con ubicación.",
};

export function formatDay(value: Date | null): string {
  return value === null ? "sin fecha de fin" : value.toISOString().slice(0, 10);
}
