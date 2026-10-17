import type { ModuleManifest } from "../contract";
export const manifest: ModuleManifest = {
  analyticsActions: [
    {
      key: "record_expense",
      label: "Cargar gastos",
      href: "/backoffice/expenses",
      permission: "expenses",
    },
  ],
  id: "expenses",
  name: "Gastos",
  description: "Pagos del negocio, desde dictado o foto.",
  requires: [],
  suggestedFor: [],
  permissions: [
    {
      id: "expenses",
      label: "Gastos",
      description: "Registrar y consultar pagos, incluidos sueldos.",
    },
  ],
  navigation: [
    { path: "", label: "Gastos", icon: "Wallet", permission: "expenses" },
  ],
};
