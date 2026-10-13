import { GASTRONOMIA } from "../categories";
import type { ModuleManifest } from "../contract";

/** Spec 0220 / ADR 0131 y 0141 — Mesas: las mesas de cada local para el POS. Requiere el POS (de
 * ahi importa sus tablas). Sin permiso propio: se administra con `locations`, desde Locales. */
export const manifest: ModuleManifest = {
  id: "tables",
  name: "Mesas",
  description: "Mesas de cada local para el POS",
  requires: ["pos"],
  suggestedFor: [...GASTRONOMIA],
  permissions: [],
  navigation: [],
  locationAction: { label: "Mesas", permission: "locations" },
};
