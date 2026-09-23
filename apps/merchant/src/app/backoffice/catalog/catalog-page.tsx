"use client";

import { useState } from "react";
import { MagicWand, Plus } from "iconoir-react";
import { ConfirmDialog } from "../../components/confirm-dialog";
import { ModuleHeader, Toast } from "../../components/ui";
import { CatalogAiImport } from "./catalog-ai-import";
import { CatalogSkeleton } from "./catalog-skeleton";
import { CategoryManager } from "./category-manager";
import { ProductEditor } from "./product-editor";
import { ProductsTab } from "./products-tab";
import { jsonInit, useCatalog } from "./use-catalog";
import type { Category, Product, ProductPayload } from "./types";

type Confirm =
  | { kind: "product"; product: Product }
  | { kind: "category"; category: Category };

type Tab = "products" | "categories";

/** ADR 0086 — el copy del bloqueo. La proteccion es el 409 del servidor; esto es su reflejo,
 * para que el merchant no choque contra un error que no esperaba. */
const IMPORTANDO =
  "Estamos importando tu menú. Mientras termina no podés crear productos ni categorías; sí podés editar y borrar lo que ya está.";

export default function CatalogPage({
  canDelete = true,
}: {
  canDelete?: boolean;
}) {
  const {
    catalog,
    notice,
    error,
    setNotice,
    setError,
    reload,
    mutate,
    createCategory,
  } = useCatalog();
  const [tab, setTab] = useState<Tab>("products");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [showAiImport, setShowAiImport] = useState(false);

  async function saveProduct(payload: ProductPayload, id: string | null) {
    const ok = await mutate(
      id ? `/api/catalog/product/${id}` : "/api/catalog/product",
      jsonInit(id ? "PUT" : "POST", payload),
      "Producto guardado.",
      "No pudimos guardar el producto.",
    );
    if (ok) {
      setCreating(false);
      setEditing(null);
    }
    return ok;
  }

  function runConfirm() {
    if (!confirm) return;
    const target = confirm;
    setConfirm(null);
    if (target.kind === "product") {
      void mutate(
        `/api/catalog/product/${target.product.id}`,
        { method: "DELETE" },
        "Producto borrado.",
        "No pudimos borrar el producto.",
      );
    } else {
      void mutate(
        `/api/catalog/category/${target.category.id}`,
        { method: "DELETE" },
        "Categoría borrada.",
        "No pudimos borrar la categoría.",
      );
    }
  }

  if (!catalog) {
    return (
      <main className="merchant-shell">
        {error ? <p className="form-error">{error}</p> : <CatalogSkeleton />}
      </main>
    );
  }

  const editorOpen = creating || editing !== null;
  const importando = catalog.importInProgress;
  return (
    <main className="merchant-shell">
      <div className="brand-page catalog-page">
        <Toast
          message={error ?? notice}
          kind={error ? "error" : "success"}
          onDismiss={() => {
            setError(null);
            setNotice(null);
          }}
        />
        <ModuleHeader
          eyebrow="Catálogo"
          title="Productos listos para vender"
          description="Organizá productos, precios y disponibilidad para cada local."
          closeHref="/backoffice"
        />
        <section className="catalog-overview" aria-label="Resumen del catálogo">
          <div>
            <span>{catalog.products.length}</span>
            <p>{catalog.products.length === 1 ? "producto" : "productos"}</p>
          </div>
          <div>
            <span>{catalog.categories.length}</span>
            <p>
              {catalog.categories.length === 1 ? "categoría" : "categorías"}
            </p>
          </div>
          <div>
            <span>{catalog.locations.length}</span>
            <p>{catalog.locations.length === 1 ? "local" : "locales"}</p>
          </div>
        </section>
        <section className="catalog-ai-banner">
          <div className="catalog-ai-icon" aria-hidden="true">
            <MagicWand />
          </div>
          <div>
            <p className="eyebrow">Carga inteligente</p>
            <h2>Convertí una foto o PDF en tu catálogo</h2>
            <p>
              La IA preparará categorías, productos y precios para que solo
              revises y completes.
            </p>
          </div>
          <button
            className="button alt"
            type="button"
            onClick={() => setShowAiImport(true)}
          >
            Probar importador
          </button>
        </section>
        {importando && <p className="field-help">{IMPORTANDO}</p>}
        <div className="catalog-section-head">
          <div
            className="catalog-tabs"
            role="tablist"
            aria-label="Vista del catálogo"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === "products"}
              className={tab === "products" ? "active" : ""}
              onClick={() => setTab("products")}
            >
              Productos
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "categories"}
              className={tab === "categories" ? "active" : ""}
              onClick={() => setTab("categories")}
            >
              Categorías
            </button>
          </div>
          <button
            className="button catalog-primary-action"
            type="button"
            disabled={importando}
            title={importando ? IMPORTANDO : undefined}
            onClick={() => {
              setEditing(null);
              setCreating(true);
            }}
          >
            <Plus aria-hidden="true" /> Nuevo producto
          </button>
        </div>
        {tab === "products" ? (
          <ProductsTab
            products={catalog.products}
            categories={catalog.categories}
            locations={catalog.locations}
            currencyCode={catalog.currencyCode}
            importInProgress={importando}
            onNew={() => {
              setEditing(null);
              setCreating(true);
            }}
            onEdit={(product) => {
              setCreating(false);
              setEditing(product);
            }}
            onDelete={(product) => setConfirm({ kind: "product", product })}
            canDelete={canDelete}
          />
        ) : (
          <CategoryManager
            categories={catalog.categories}
            importInProgress={importando}
            onCreate={(name) =>
              createCategory(name).then((cat) => cat !== null)
            }
            onRename={(id, name) =>
              mutate(
                `/api/catalog/category/${id}`,
                jsonInit("PUT", { name }),
                "Categoría renombrada.",
                "No pudimos renombrar la categoría.",
              )
            }
            onDelete={(category) => setConfirm({ kind: "category", category })}
            canDelete={canDelete}
          />
        )}
        <ProductEditor
          key={`${editing?.id ?? "new"}-${editorOpen ? "open" : "closed"}`}
          open={editorOpen}
          product={editing}
          categories={catalog.categories}
          locations={catalog.locations}
          currencyCode={catalog.currencyCode}
          onCreateCategory={createCategory}
          onSave={saveProduct}
          onCancel={() => {
            setCreating(false);
            setEditing(null);
          }}
          onError={setError}
        />
        <CatalogAiImport
          open={showAiImport}
          onClose={() => setShowAiImport(false)}
          onAccepted={reload}
        />
      </div>
      <ConfirmDialog
        open={confirm !== null}
        title={
          confirm?.kind === "category" ? "Borrar categoría" : "Borrar producto"
        }
        description={
          confirm?.kind === "category"
            ? "Sus productos quedarán sin categoría. Esta acción no se puede deshacer."
            : "El producto se eliminará del catálogo. Esta acción no se puede deshacer."
        }
        confirmLabel="Borrar"
        onCancel={() => setConfirm(null)}
        onConfirm={runConfirm}
      />
    </main>
  );
}
