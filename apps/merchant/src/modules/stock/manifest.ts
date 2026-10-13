import { GASTRONOMIA } from "../categories";
import type { ModuleManifest } from "../contract";

/** Spec 0210 / 0216 — Stock: insumos, compras, ajustes y stock estimado. Permiso propio `stock`. */
export const manifest: ModuleManifest = {
  id: "stock",
  name: "Stock",
  description: "Insumos, compras y stock estimado",
  requires: [],
  suggestedFor: [
    ...GASTRONOMIA,
    "gcid:pharmacy",
    "gcid:grocery_store",
    "gcid:clothing_store",
    "gcid:pet_store",
  ],
  permissions: [
    {
      id: "stock",
      label: "Stock",
      description: "Insumos, compras, ajustes y stock estimado.",
    },
  ],
  navigation: [
    { path: "", label: "Stock", icon: "Package", permission: "stock" },
  ],
};
