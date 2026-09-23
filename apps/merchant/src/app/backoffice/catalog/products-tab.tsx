"use client";

import { useMemo, useState } from "react";
import { CatalogList } from "./catalog-list";
import { Search } from "iconoir-react";
import type { Category, Location, Product } from "./types";

type Props = {
  products: Product[];
  categories: Category[];
  locations: Location[];
  currencyCode: string;
  onNew: () => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  canDelete: boolean;
};

export function ProductsTab({
  products,
  categories,
  locations,
  currencyCode,
  onNew,
  onEdit,
  onDelete,
  canDelete,
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
          Podés cargarlo manualmente o usar el importador inteligente desde una
          foto o PDF.
        </p>
        <button className="button" type="button" onClick={onNew}>
          Crear producto
        </button>
      </section>
    );
  }

  return (
    <>
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
        <select
          className="catalog-filter"
          value={categoryId}
          aria-label="Filtrar por categoría"
          onChange={(event) => setCategoryId(event.target.value)}
        >
          <option value="">Todas las categorías</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        {locations.length > 1 && (
          <select
            className="catalog-filter"
            value={locationId}
            aria-label="Filtrar por local"
            onChange={(event) => setLocationId(event.target.value)}
          >
            <option value="">Todos los locales</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        )}
      </div>
      {filtered.length === 0 ? (
        <p className="field-help">No hay productos para ese filtro.</p>
      ) : (
        <CatalogList
          products={filtered}
          categories={categories}
          currencyCode={currencyCode}
          onEdit={onEdit}
          onDelete={onDelete}
          canDelete={canDelete}
        />
      )}
    </>
  );
}
