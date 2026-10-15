import { BUSINESS_CATEGORIES } from "../../lib/business-categories";
import type { ModuleManifest } from "../contract";

export const manifest: ModuleManifest = {
  id: "profitability",
  name: "Rentabilidad",
  description: "Costos fijos y del personal de tus locales",
  requires: [],
  suggestedFor: BUSINESS_CATEGORIES.map((category) => category.gcid),
  permissions: [
    {
      id: "profitability",
      label: "Rentabilidad",
      description: "Ver y editar costos fijos, sueldos y márgenes.",
    },
  ],
  navigation: [],
};
