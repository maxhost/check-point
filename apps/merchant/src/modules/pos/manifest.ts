import { GASTRONOMIA } from "../categories";
import type { ModuleManifest } from "../contract";

/** Spec 0220 / ADR 0130 y 0141 — el POS: ordenes de mesa, cobro y ticket. Permiso propio `pos`.
 * Usa Mesas si esta encendido (`optional`); sin Mesas toma ordenes sin mesa. */
export const manifest: ModuleManifest = {
  analyticsActions: [
    {
      key: "view_voided_orders",
      label: "Ver anulados",
      href: "/backoffice/pos?status=voided",
      permission: "pos",
    },
  ],
  id: "pos",
  name: "POS",
  description: "Órdenes de mesa, cobro y ticket",
  requires: [],
  optional: ["tables"],
  suggestedFor: [...GASTRONOMIA],
  permissions: [
    {
      id: "pos",
      label: "POS",
      description: "Abrir, editar, cobrar y anular órdenes de mesa.",
    },
  ],
  navigation: [{ path: "", label: "POS", icon: "Shop", permission: "pos" }],
  settingsPanel: true,
  operation: { primaryAction: { label: "Nueva orden", icon: "Plus" } },
  startPage: { path: "", permission: "pos" },
};
