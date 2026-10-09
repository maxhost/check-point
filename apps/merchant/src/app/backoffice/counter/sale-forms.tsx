"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Erase, Search, Xmark } from "iconoir-react";
import { Button } from "../../../ui";
import { type CartLine, type CounterProduct, formatMoney } from "./types";

/** Alphabetical by default; optional server ranking, with personal picks kept separate. */
export function DetailedSale({
  products,
  categories,
  habitualProductIds,
  lastPurchase,
  currencyCode,
  cart,
  onAdd,
  onQty,
  onLinePrice,
  onRepeat,
  disabled = false,
  productOrder,
  showPrices = true,
  allowPriceInput = true,
  searchOnly = false,
  compactSearch = false,
  showHeading = true,
  stickyControls = false,
}: {
  products: CounterProduct[];
  categories: { id: string; name: string }[];
  habitualProductIds: string[];
  lastPurchase: { items: { productId: string; quantity: number }[] } | null;
  currencyCode: string;
  cart: CartLine[];
  onAdd: (product: CounterProduct) => void;
  onQty: (productId: string, delta: number) => void;
  onLinePrice: (productId: string, value: number) => void;
  onRepeat: () => void;
  disabled?: boolean;
  /** Optional server ranking; the counter keeps its alphabetical default. */
  productOrder?: string[];
  /** POS taking an order can hide amounts without changing stored prices. */
  showPrices?: boolean;
  allowPriceInput?: boolean;
  /** Compact catalog search for adding items while reviewing a POS draft. */
  searchOnly?: boolean;
  compactSearch?: boolean;
  showHeading?: boolean;
  stickyControls?: boolean;
}) {
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchOpen, setSearchOpen] = useState(searchOnly);
  const searchRevealRef = useRef<HTMLDivElement>(null);
  const searchResultsRef = useRef<HTMLUListElement>(null);
  const stickyToolbarRef = useRef<HTMLDivElement>(null);
  const [toolbarStuck, setToolbarStuck] = useState(false);
  useEffect(() => {
    if (!stickyControls) return;
    let frame = 0;
    function measure() {
      frame = 0;
      const toolbar = stickyToolbarRef.current;
      setToolbarStuck(
        !!toolbar &&
          toolbar.offsetHeight > 0 &&
          toolbar.getBoundingClientRect().top <= 0,
      );
    }
    function scheduleMeasure() {
      if (!frame) frame = requestAnimationFrame(measure);
    }
    scheduleMeasure();
    window.addEventListener("scroll", scheduleMeasure, {
      passive: true,
      capture: true,
    });
    window.addEventListener("resize", scheduleMeasure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleMeasure, true);
      window.removeEventListener("resize", scheduleMeasure);
    };
  }, [stickyControls, searchOpen]);
  const stickyToolbarClass = `sticky top-0 z-20 py-2 transition-colors duration-200 motion-reduce:transition-none ${toolbarStuck ? "bg-canvas" : "bg-transparent"}`;
  useEffect(() => {
    if (!stickyControls || !searchOpen || !query.trim()) return;
    const frame = requestAnimationFrame(() => {
      searchResultsRef.current?.scrollIntoView({
        block: "start",
        behavior: "instant",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [query, searchOpen, stickyControls]);
  const [searchClosing, setSearchClosing] = useState(false);
  const inlineSearch = !showHeading && !searchOnly;
  useEffect(() => {
    if (!inlineSearch || !searchOpen) return;
    searchInputRef.current?.focus();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animation = searchRevealRef.current?.animate(
      [{ clipPath: "inset(0 0 0 100%)" }, { clipPath: "inset(0 0 0 0%)" }],
      { duration: 180, easing: "ease-out" },
    );
    return () => animation?.cancel();
  }, [inlineSearch, searchOpen]);
  async function toggleSearch() {
    if (searchClosing) return;
    if (
      inlineSearch &&
      searchOpen &&
      searchRevealRef.current &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setSearchClosing(true);
      const animation = searchRevealRef.current.animate(
        [{ clipPath: "inset(0 0 0 0%)" }, { clipPath: "inset(0 0 0 100%)" }],
        { duration: 180, easing: "ease-in", fill: "forwards" },
      );
      try {
        await animation.finished;
      } catch {
        return;
      }
      animation.cancel();
      setSearchClosing(false);
    }
    setSearchOpen(!searchOpen);
    setQuery("");
  }
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [repeatApplied, setRepeatApplied] = useState(false);
  const sortedProducts = useMemo(() => {
    const ranking = new Map(
      (productOrder ?? []).map((id, index) => [id, index]),
    );
    return [...products].sort(
      (a, b) =>
        (ranking.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
          (ranking.get(b.id) ?? Number.MAX_SAFE_INTEGER) ||
        a.name.localeCompare(b.name, "es"),
    );
  }, [products, productOrder]);
  const shown = useMemo(() => {
    if (searchOpen || searchOnly) {
      const q = query.trim().toLocaleLowerCase("es");
      return q
        ? sortedProducts.filter((p) =>
            p.name.toLocaleLowerCase("es").includes(q),
          )
        : searchOnly
          ? []
          : sortedProducts;
    }
    return categoryId === null
      ? sortedProducts
      : sortedProducts.filter((p) =>
          categoryId === "other"
            ? !p.categoryId ||
              !categories.some((category) => category.id === p.categoryId)
            : p.categoryId === categoryId,
        );
  }, [sortedProducts, searchOpen, searchOnly, query, categoryId, categories]);
  const byId = new Map(products.map((product) => [product.id, product]));
  const habitual = habitualProductIds
    .map((id) => byId.get(id))
    .filter((p): p is CounterProduct => Boolean(p));
  const visibleCategories = categories
    .filter((category) =>
      products.some((product) => product.categoryId === category.id),
    )
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  const hasOther = products.some(
    (product) =>
      product.categoryId === null ||
      !categories.some((category) => category.id === product.categoryId),
  );

  function card(product: CounterProduct) {
    const line = cart.find((item) => item.productId === product.id);
    return (
      <li key={product.id} className="counter-product">
        <div className="counter-product-main">
          <button
            type="button"
            disabled={disabled}
            className="counter-product-add"
            onClick={() => {
              onAdd(product);
              if (searchOnly) setQuery("");
            }}
            aria-label={`Agregar ${product.name}`}
          >
            <strong>{product.name}</strong>
            {showPrices && (
              <small>
                {product.unitPrice === null
                  ? "Sin precio"
                  : formatMoney(product.unitPrice, currencyCode)}
              </small>
            )}
          </button>
          {line && !searchOnly && (
            <div
              className="counter-qty"
              aria-label={`Cantidad de ${product.name}: ${line.quantity}`}
            >
              <button
                type="button"
                disabled={disabled}
                aria-label={`Quitar un ${product.name}`}
                onClick={() => onQty(product.id, -1)}
              >
                −
              </button>
              <output>{line.quantity}</output>
              <button
                type="button"
                disabled={disabled}
                aria-label={`Agregar un ${product.name}`}
                onClick={() => onQty(product.id, 1)}
              >
                +
              </button>
            </div>
          )}
        </div>
        {allowPriceInput && line && !line.hasStoredPrice && (
          <label className="counter-line-price">
            Precio unitario de {product.name}
            <input
              disabled={disabled}
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={line.unitPrice || ""}
              onChange={(event) =>
                onLinePrice(product.id, Number(event.target.value))
              }
            />
          </label>
        )}
      </li>
    );
  }

  const searchButton = (
    <button
      type="button"
      disabled={disabled || searchClosing}
      className={!showHeading ? "h-11 shrink-0" : undefined}
      aria-expanded={searchOpen}
      aria-label={searchOpen ? "Cerrar búsqueda" : "Buscar"}
      onClick={() => void toggleSearch()}
    >
      {compactSearch ? (
        searchOpen ? (
          <Xmark aria-hidden="true" width={24} height={24} />
        ) : (
          <Search aria-hidden="true" width={24} height={24} />
        )
      ) : searchOpen ? (
        "Cerrar búsqueda"
      ) : (
        "Buscar"
      )}
    </button>
  );
  const categoryControls = (
    <div
      className={`counter-categories${showHeading ? "" : " min-w-0 flex-1"}`}
      role="group"
      aria-label="Categorías"
    >
      <button
        type="button"
        disabled={disabled}
        className={categoryId === null ? "is-active" : ""}
        onClick={() => setCategoryId(null)}
      >
        Todos
      </button>
      {visibleCategories.map((category) => (
        <button
          key={category.id}
          type="button"
          disabled={disabled}
          className={categoryId === category.id ? "is-active" : ""}
          onClick={() => setCategoryId(category.id)}
        >
          {category.name}
        </button>
      ))}
      {hasOther && (
        <button
          type="button"
          disabled={disabled}
          className={categoryId === "other" ? "is-active" : ""}
          onClick={() => setCategoryId("other")}
        >
          Otros
        </button>
      )}
    </div>
  );
  const customClear = inlineSearch || searchOnly;
  const searchInput = (
    <input
      ref={searchInputRef}
      className={`counter-search${inlineSearch ? " h-11 min-w-0 py-0" : ""}${customClear ? " w-full pr-11!" : ""}`}
      disabled={disabled}
      type={customClear ? "text" : "search"}
      aria-label={
        searchOnly ? "Buscar producto para añadir" : "Buscar producto"
      }
      placeholder={
        searchOnly ? "Buscar producto para añadir…" : "Buscar producto…"
      }
      value={query}
      onChange={(event) => setQuery(event.target.value)}
      autoFocus={!searchOnly && !inlineSearch}
    />
  );
  const searchField = customClear ? (
    <div ref={searchRevealRef} className="relative min-w-0 flex-1">
      {searchInput}
      {query && (
        <Button
          variant="quiet"
          aria-label="Limpiar búsqueda"
          className="absolute top-0 right-0 bottom-0 my-auto size-11 border-0! bg-transparent! p-0!"
          isDisabled={disabled}
          onPress={() => {
            setQuery("");
            searchInputRef.current?.focus();
          }}
        >
          <Erase aria-hidden="true" className="size-5" />
        </Button>
      )}
    </div>
  ) : (
    searchInput
  );
  return (
    <div
      className={stickyControls && searchOnly ? "contents" : "counter-detailed"}
    >
      {habitual.length > 0 && !searchOpen && (
        <section
          className="counter-picks"
          aria-label="Habituales de este cliente"
        >
          <h3>Habituales de este cliente</h3>
          <ul className="counter-product-list">{habitual.map(card)}</ul>
        </section>
      )}
      {lastPurchase && !searchOpen && (
        <details className="counter-repeat">
          <summary>Cargar última compra</summary>
          <ul>
            {lastPurchase.items.map((item) => (
              <li key={item.productId}>
                {item.quantity} × {byId.get(item.productId)?.name}
              </li>
            ))}
          </ul>
          <p>Se usarán los precios actuales del catálogo.</p>
          <button
            type="button"
            disabled={disabled || repeatApplied}
            onClick={() => {
              onRepeat();
              setRepeatApplied(true);
            }}
          >
            {repeatApplied
              ? "Compra agregada"
              : "Agregar estos productos al carrito"}
          </button>
        </details>
      )}
      {!searchOnly && (
        <div
          ref={stickyToolbarRef}
          className={`counter-catalog-heading${showHeading ? "" : " items-start gap-2"}${stickyControls ? ` ${stickyToolbarClass}` : ""}`}
        >
          {showHeading ? (
            <h3>Catálogo</h3>
          ) : searchOpen ? (
            searchField
          ) : (
            categoryControls
          )}
          {searchButton}
        </div>
      )}
      {searchOpen || searchOnly
        ? (showHeading || searchOnly) &&
          (stickyControls && searchOnly ? (
            <div
              ref={stickyToolbarRef}
              className={`grid ${stickyToolbarClass}`}
            >
              {searchField}
            </div>
          ) : (
            searchField
          ))
        : showHeading
          ? categoryControls
          : null}
      <ul
        ref={searchResultsRef}
        className={`counter-product-list${stickyControls ? " scroll-mt-20" : ""}`}
      >
        {shown.map(card)}
      </ul>
      {shown.length === 0 && (!searchOnly || query.trim()) && (
        <p className="counter-empty">
          {products.length
            ? "No hay productos que coincidan."
            : "Este comercio aún no tiene productos en el catálogo."}
        </p>
      )}
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
        usa la venta detallada.
      </p>
    </div>
  );
}
