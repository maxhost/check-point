"use client";
import { useState } from "react";
import { Xmark } from "iconoir-react";
import { Button, SearchField, SelectField, Text } from "../../../ui";
import type { PosCatalogProductV2, PosCatalogV2 } from "../contracts";
import { unitLabel } from "./measured-cart-model";

export function MeasuredProductCatalog({
  catalog,
  currencyCode,
  disabled,
  onAdd,
}: {
  catalog: PosCatalogV2;
  currencyCode: string;
  disabled: boolean;
  onAdd: (product: PosCatalogProductV2) => void;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const products = catalog.products.filter(
    (product) =>
      product.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()) &&
      (category === "all" ||
        (category === "frequent"
          ? catalog.frequentProductIds.includes(product.id)
          : product.categoryId === category)),
  );
  return (
    <div className="grid gap-4">
      <div className="grid min-w-0 grid-cols-2 items-start gap-3">
        <SearchField
          className="min-w-0"
          label="Buscar productos"
          value={search}
          onChange={setSearch}
        />
        <div className="flex min-w-0 items-end gap-2">
          <SelectField
            className="min-w-0 flex-1"
            label="Categoría"
            selectedKey={category}
            onSelectionChange={(key) => setCategory(String(key))}
            options={[
              { id: "all", label: "Todos" },
              { id: "frequent", label: "Frecuentes" },
              ...catalog.categories.map((c) => ({ id: c.id, label: c.name })),
            ]}
          />
          {category !== "all" && (
            <Button
              variant="quiet"
              className="mb-0.5 size-11 shrink-0 p-0!"
              aria-label="Mostrar todas las categorías"
              onPress={() => setCategory("all")}
            >
              <Xmark className="size-5" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
      <div className="grid gap-2 @sm/catalog:grid-cols-2 @3xl/catalog:grid-cols-3">
        {products.map((product) => (
          <Button
            key={product.id}
            variant="secondary"
            className="h-auto! min-w-0 justify-start! whitespace-normal! p-4! text-left"
            isDisabled={disabled || product.unitPrice === null}
            aria-label={`Añadir ${product.name}`}
            onPress={() => onAdd(product)}
          >
            <div className="min-w-0 break-words">
              <Text variant="label">{product.name}</Text>
              <Text variant="small">
                {product.unitPrice === null
                  ? "Sin precio de venta"
                  : `${currencyCode} ${product.unitPrice.replace(".", ",")} por ${unitLabel(product.pricingUnit)}`}
              </Text>
            </div>
          </Button>
        ))}
      </div>
      {!products.length && (
        <Text variant="muted">
          No hay productos que coincidan. Prueba otra búsqueda o categoría.
        </Text>
      )}
    </div>
  );
}
