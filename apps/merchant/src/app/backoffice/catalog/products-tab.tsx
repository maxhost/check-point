"use client";

import { useMemo, useState } from "react";
import { CatalogList } from "./catalog-list";
import { Search } from "iconoir-react";
import { SelectField } from "../../../ui";
import type { Category, Location, Product } from "./types";

type Props = {
  products: Product[];
  categories: Category[];
  locations: Location[];
  currencyCode: string;
  /** ADR 0086 — con una importacion abierta el alta manual da 409; el boton se apaga. */
  importInProgress: boolean;
  onNew: () => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  canDelete: boolean;
  actionsDisabled?: boolean;
};

export function ProductsTab({
  products,
  categories,
  locations,
  currencyCode,
  importInProgress,
  onNew,
  onEdit,
  onDelete,
  canDelete,
  actionsDisabled,
}: Props) {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [locationId, setLocationId] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((product) => {
      if (categoryId && product.categoryId !== categoryId) return false;
      if (
        locationId &&
        !product.availableAllLocations &&
        !product.locationIds.includes(locationId)
      )
        return false;
      if (term && !product.name.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [products, search, categoryId, locationId]);

  if (products.length === 0) {
    return (
      <section className="panel catalog-empty">
        <div className="catalog-empty-art" aria-hidden="true">
          01
        </div>
        <h2>Tu catálogo empieza con un producto</h2>
        <p>
          {importInProgress
            ? "Estamos importando tu menú. En cuanto termine vas a ver los productos acá."
            : "Podés cargarlo manualmente o usar el importador inteligente desde una foto o PDF."}
        </p>
        <button
          className="button"
          type="button"
          disabled={importInProgress}
          onClick={onNew}
        >
          Crear producto
        </button>
      </section>
    );
  }

  return (
    <div data-tour="catalog-product-management">
      <div className="catalog-toolbar">
        <label className="catalog-search">
          <Search aria-hidden="true" />
          <input
            type="search"
            value={search}
            placeholder="Buscar producto…"
            aria-label="Buscar producto"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        {/* «Todas» usa el id `all`: react-aria no admite bien una `Key` vacia, y el estado
            sigue guardando `""` para «sin filtro» (spec 0095). */}
        <SelectField
          hideLabel
          className="catalog-toolbar-select"
          label="Filtrar por categoría"
          selectedKey={categoryId || "all"}
          onSelectionChange={(key) =>
            setCategoryId(key == null || key === "all" ? "" : String(key))
          }
          options={[
            { id: "all", label: "Todas las categorías" },
            ...categories.map((category) => ({
              id: category.id,
              label: category.name,
            })),
          ]}
        />
        {locations.length > 1 && (
          <SelectField
            hideLabel
            className="catalog-toolbar-select"
            label="Filtrar por local"
            selectedKey={locationId || "all"}
            onSelectionChange={(key) =>
              setLocationId(key == null || key === "all" ? "" : String(key))
            }
            options={[
              { id: "all", label: "Todos los locales" },
              ...locations.map((location) => ({
                id: location.id,
                label: location.name,
              })),
            ]}
          />
        )}
      </div>
      {filtered.length === 0 ? (
        <p className="field-help" data-tour="catalog-product-list">
          No hay productos para ese filtro. Ajustá los filtros o la búsqueda
          para elegir un producto.
        </p>
      ) : (
        <CatalogList
          products={filtered}
          categories={categories}
          currencyCode={currencyCode}
          onEdit={onEdit}
          onDelete={onDelete}
          canDelete={canDelete}
          actionsDisabled={actionsDisabled}
        />
      )}
    </div>
  );
}
