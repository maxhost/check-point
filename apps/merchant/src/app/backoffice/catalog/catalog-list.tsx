"use client";

import type { Category, Product } from "./types";
import { formatMoney } from "./types";

type Props = {
  products: Product[];
  categories: Category[];
  currencyCode: string;
  onNew: () => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
};

export function CatalogList({
  products,
  categories,
  currencyCode,
  onNew,
  onEdit,
  onDelete,
}: Props) {
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

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
    <ul className="catalog-list">
      {products.map((product) => (
        <li key={product.id} className="catalog-item">
          <div className="catalog-thumb" aria-hidden="true">
            {product.imagePath ? (
              <img src={product.imagePath} alt="" />
            ) : (
              <span>{product.name.slice(0, 2).toUpperCase()}</span>
            )}
          </div>
          <div className="catalog-item-body">
            <strong>{product.name}</strong>
            <span className="catalog-item-meta">
              {product.categoryId
                ? (categoryName.get(product.categoryId) ?? "Sin categoría")
                : "Sin categoría"}
              {" · "}
              {product.unitPrice != null
                ? formatMoney(product.unitPrice, currencyCode)
                : "Sin precio"}
              {!product.availableAllLocations && " · Locales limitados"}
            </span>
          </div>
          <div className="catalog-item-actions">
            <button
              type="button"
              className="small-button"
              onClick={() => onEdit(product)}
            >
              Editar
            </button>
            <button
              type="button"
              className="small-button danger"
              onClick={() => onDelete(product)}
            >
              Borrar
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
