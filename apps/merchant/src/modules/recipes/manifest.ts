import type { ModuleManifest } from "../contract";
import { GASTRONOMIA } from "../categories";

/** Spec 0210 / 0216 — Recetas: receta de cada producto, costo y margen. Requiere Stock (de ahi
 * puede importar, ADR 0139 §1). Permiso propio `recipes`. */
export const manifest: ModuleManifest = {
  id: "recipes",
  name: "Recetas",
  description: "Receta de cada producto, costo y margen",
  requires: ["stock"],
  suggestedFor: [...GASTRONOMIA],
  permissions: [
    {
      id: "recipes",
      label: "Recetas",
      description: "Recetas, costo y margen de cada producto.",
    },
  ],
  navigation: [
    { path: "", label: "Recetas", icon: "Book", permission: "recipes" },
  ],
};
