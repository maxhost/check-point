"use client";

import { useMemo, useState } from "react";
import {
  type CartLine,
  type CounterProduct,
  cartTotal,
  formatMoney,
} from "./types";

/** Detailed sale: a searchable catalog picker feeding an editable cart. */
export function DetailedSale({
  products,
  currencyCode,
  cart,
  onAdd,
  onQty,
  onLinePrice,
}: {
  products: CounterProduct[];
  currencyCode: string;
  cart: CartLine[];
  onAdd: (product: CounterProduct) => void;
  onQty: (productId: string, delta: number) => void;
  onLinePrice: (productId: string, value: number) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? products.filter((p) => p.name.toLowerCase().includes(q))
      : products;
  }, [products, query]);

  return (
    <div className="counter-detailed">
      {cart.length > 0 && (
        <ul className="counter-cart">
          {cart.map((line) => (
            <li key={line.productId} className="counter-cart-line">
              <div className="counter-cart-name">
                <strong>{line.name}</strong>
                {line.hasStoredPrice ? (
                  <span>{formatMoney(line.unitPrice, currencyCode)}</span>
                ) : (
                  <label className="counter-line-price">
                    Importe
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      value={line.unitPrice ? String(line.unitPrice) : ""}
                      onChange={(e) =>
                        onLinePrice(line.productId, Number(e.target.value))
                      }
                    />
                  </label>
                )}
              </div>
              <div className="counter-qty">
                <button
                  type="button"
                  aria-label="Quitar uno"
                  onClick={() => onQty(line.productId, -1)}
                >
                  −
                </button>
                <span>{line.quantity}</span>
                <button
                  type="button"
                  aria-label="Agregar uno"
                  onClick={() => onQty(line.productId, 1)}
                >
                  +
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="counter-total">
        Total <strong>{formatMoney(cartTotal(cart), currencyCode)}</strong>
      </p>

      <input
        className="counter-search"
        type="search"
        placeholder="Buscar producto…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul className="counter-picker">
        {filtered.map((product) => (
          <li key={product.id}>
            <button type="button" onClick={() => onAdd(product)}>
              <span>{product.name}</span>
              <small>
                {product.unitPrice === null
                  ? "Sin precio · lo tecleás"
                  : formatMoney(product.unitPrice, currencyCode)}
              </small>
            </button>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="counter-empty">No hay productos que coincidan.</li>
        )}
      </ul>
    </div>
  );
}

/** Quick sale: a typed amount + optional note. Immutable once granted (spec 0030). */
export function QuickSale({
  amount,
  onAmount,
  note,
  onNote,
  currencyCode,
}: {
  amount: string;
  onAmount: (value: string) => void;
  note: string;
  onNote: (value: string) => void;
  currencyCode: string;
}) {
  return (
    <div className="counter-quick">
      <label className="counter-field">
        Importe de la venta ({currencyCode})
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          placeholder="0.00"
          value={amount}
          onChange={(e) => onAmount(e.target.value)}
          autoFocus
        />
      </label>
      <label className="counter-field">
        Nota (opcional)
        <input
          type="text"
          maxLength={280}
          placeholder="ej. ticket 0423"
          value={note}
          onChange={(e) => onNote(e.target.value)}
        />
      </label>
      <p className="counter-hint">
        La venta rápida no se puede editar después. Para desglosar por producto,
        usá la venta detallada.
      </p>
    </div>
  );
}
