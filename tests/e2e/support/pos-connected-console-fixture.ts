import { editorCatalog, editorOrder } from "./pos-measured-editor-fixture";
export const connectedCatalog = {
  ...editorCatalog,
  products: editorCatalog.products
    .filter((p) => p.id === "coffee")
    .map((p) => ({ ...p, unitPrice: "2.00" })),
};
export const connectedOrder = {
  ...editorOrder,
  id: "connected",
  saleType: "counter" as const,
  orderLabel: "Mostrador 1",
  tableLabel: "Mostrador 1",
  location: { id: "north", name: "Local Norte" },
  total: "2.00",
  items: editorOrder.items.slice(0, 1),
};
