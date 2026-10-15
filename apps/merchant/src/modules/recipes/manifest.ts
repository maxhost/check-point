import type { ModuleManifest } from "../contract";
import { GASTRONOMIA } from "../categories";

/** Spec 0210 / 0216 — Recetas: recetas independientes y composiciones de productos. Requiere Stock (de ahi
 * puede importar, ADR 0139 §1). Permiso propio `recipes`. */
export const manifest: ModuleManifest = {
  id: "recipes",
  name: "Recetas",
  description: "Recetas y composiciones de tus productos",
  requires: ["stock"],
  optional: ["pos"],
  suggestedFor: [...GASTRONOMIA],
  permissions: [
    {
      id: "recipes",
      label: "Recetas",
      description: "Crear recetas y componer productos y combos.",
    },
  ],
  navigation: [],
};
