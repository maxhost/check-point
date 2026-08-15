"use client";

import { useMemo, useState } from "react";
import { CatalogList } from "./catalog-list";
import type { Category, Product } from "./types";

type Props = {
  products: Product[];
  categories: Category[];
  currencyCode: string;
  onNew: () => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
};

export function ProductsTab({
  products,
  categories,
  currencyCode,
  onNew,
  onEdit,
  onDelete,
}: Props) {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((product) => {
      if (categoryId && product.categoryId !== categoryId) return false;
      if (term && !product.name.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [products, search, categoryId]);

  if (products.length === 0) {
    return (
      <section className="panel catalog-empty">
        <h2>Aún no tienes productos</h2>
        <p>Crea el primero para armar tu catálogo de venta.</p>
        <button className="button" type="button" onClick={onNew}>
          Crear producto
        </button>
      </section>
    );
  }

  return (
    <>
      <div className="catalog-toolbar">
        <input
          className="catalog-search"
          type="search"
          value={search}
          placeholder="Buscar producto…"
          aria-label="Buscar producto"
          onChange={(event) => setSearch(event.target.value)}
        />
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
        <button className="button" type="button" onClick={onNew}>
          Nuevo producto
        </button>
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
        />
      )}
    </>
  );
}
