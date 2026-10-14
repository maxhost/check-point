import type { BusinessModule } from "../../../apps/merchant/src/app/backoffice/settings/module-navigation";

export function businessModules(
  stock = false,
  recipes = false,
): BusinessModule[] {
  return [
    {
      id: "stock",
      name: "Stock",
      description: "Insumos, compras y stock estimado",
      requires: [],
      enabled: stock,
      suggested: true,
      navigation: [
        { path: "", label: "Stock", icon: "Package", permission: "stock" },
      ],
      permissions: [
        {
          id: "stock",
          label: "Stock",
          description: "Insumos, compras, ajustes y stock estimado.",
        },
      ],
    },
    {
      id: "recipes",
      name: "Recetas",
      description: "Receta de cada producto, costo y margen",
      requires: ["stock"],
      enabled: recipes,
      suggested: false,
      navigation: [
        { path: "", label: "Recetas", icon: "Book", permission: "recipes" },
      ],
      permissions: [
        {
          id: "recipes",
          label: "Recetas",
          description: "Recetas, costo y margen de cada producto.",
        },
      ],
    },
  ];
}

/** Un tercer módulo prueba que el core consume el DTO, sin una lista fija de dos ids. */
export function extraModule(enabled = false): BusinessModule {
  return {
    id: "appointments",
    name: "Turnos de prueba",
    description: "Organiza reservas de prueba",
    requires: ["stock"],
    enabled,
    suggested: true,
    navigation: [
      {
        path: "",
        label: "Turnos de prueba",
        icon: "Planet",
        permission: "appointments_manage",
      },
      {
        path: "history",
        label: "Historial de turnos",
        icon: "Book",
        permission: "appointments_history",
      },
    ],
    permissions: [
      {
        id: "appointments_manage",
        label: "Gestionar turnos",
        description: "Crear y editar reservas de prueba.",
      },
    ],
  };
}

export function operationModules(pos = true, tables = true): BusinessModule[] {
  return [
    {
      id: "pos",
      name: "POS",
      description: "Órdenes de mesa, cobro y ticket",
      requires: [],
      enabled: pos,
      suggested: true,
      navigation: [{ path: "", label: "POS", icon: "Shop", permission: "pos" }],
      permissions: [
        {
          id: "pos",
          label: "POS",
          description: "Abrir, editar, cobrar y anular órdenes de mesa.",
        },
      ],
    },
    {
      id: "tables",
      name: "Mesas",
      description: "Mesas de cada local para el POS",
      requires: ["pos"],
      enabled: tables && pos,
      suggested: true,
      navigation: [],
      permissions: [],
    },
  ];
}
