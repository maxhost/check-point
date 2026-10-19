import type {
  PosCatalogV2,
  PosOrderV2,
} from "../../../apps/merchant/src/modules/pos/contracts";
import { products, existing } from "./pos-measured-cart-fixture";
export const editorCatalog: PosCatalogV2 = {
  salesMassUnits: ["kg", "lb"],
  products: products.map((product) =>
    product.id === "mass"
      ? {
          ...product,
          name:
            product.name +
            " · cosecha de montaña, selección especial para preparar en casa y compartir con tu familia",
        }
      : product,
  ),
  categories: [{ id: "drinks", name: "Bebidas" }],
  frequentProductIds: ["coffee"],
};
export const editorOrder: PosOrderV2 = {
  contractVersion: 2,
  id: "order-a",
  version: 1,
  status: "open",
  saleType: "pickup",
  orderLabel: "Pedido original",
  tableLabel: "Pedido original",
  tableId: null,
  location: { id: "north", name: "Local Norte" },
  note: "Nota original",
  business: { name: "Comercio", currencyCode: "USD" },
  items: existing,
  total: "4.01",
  createdAt: "2026-10-18T12:00:00Z",
  createdBy: "operator",
  closedAt: null,
  closedBy: null,
  sale: null,
  settlement: null,
};
