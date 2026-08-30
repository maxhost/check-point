"use client";

import { useEffect, useState } from "react";
import { ConfirmDialog } from "../../components/confirm-dialog";
import { ModuleHeader, Toast } from "../../components/ui";
import { CategoryManager } from "./category-manager";
import { ProductEditor } from "./product-editor";
import { ProductsTab } from "./products-tab";
import type { Catalog, Category, Product, ProductPayload } from "./types";

type Confirm =
  | { kind: "product"; product: Product }
  | { kind: "category"; category: Category };

type Tab = "products" | "categories";

export default function CatalogPage() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [tab, setTab] = useState<Tab>("products");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void reload();
  }, []);

  async function reload() {
    try {
      const res = await fetch("/api/catalog");
      const payload = (await res.json().catch(() => null)) as
        | Catalog
        | { error?: string }
        | null;
      if (!res.ok || !payload || !("products" in payload)) {
        throw new Error(
          (payload as { error?: string } | null)?.error ??
            "No pudimos cargar el catálogo.",
        );
      }
      setCatalog(payload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Error de carga.");
    }
  }

  async function mutate(
    input: RequestInfo,
    init: RequestInit,
    okMessage: string,
    fallback: string,
  ): Promise<boolean> {
    try {
      const res = await fetch(input, init);
      const payload = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) throw new Error(payload?.error ?? fallback);
      await reload();
      setNotice(okMessage);
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : fallback);
      return false;
    }
  }

  const jsonInit = (method: string, body: unknown): RequestInit => ({
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

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

  async function createCategory(name: string): Promise<Category | null> {
    if (!name) return null;
    try {
      const res = await fetch(
        "/api/catalog/category",
        jsonInit("POST", { name }),
      );
      const cat = (await res.json().catch(() => null)) as
        | Category
        | { error?: string }
        | null;
      if (!res.ok || !cat || !("id" in cat)) {
        throw new Error(
          (cat as { error?: string } | null)?.error ??
            "No pudimos crear la categoría.",
        );
      }
      await reload();
      setNotice("Categoría creada.");
      return cat;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Error.");
      return null;
    }
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

  function closeEditor() {
    setCreating(false);
    setEditing(null);
  }

  if (!catalog) {
    return (
      <main className="merchant-shell">
        <div className="brand-page loyalty-skeleton" aria-busy="true">
          {error ? (
            <p className="form-error">{error}</p>
          ) : (
            <span className="skeleton-line skeleton-title" />
          )}
        </div>
      </main>
    );
  }

  const editorOpen = creating || editing !== null;
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
          title="Tu catálogo de productos"
          description="Lo que vende tu negocio. El valor en puntos lo define tu programa."
          closeHref="/backoffice"
          onClose={editorOpen ? closeEditor : undefined}
        />
        {editorOpen ? (
          <ProductEditor
            product={editing}
            categories={catalog.categories}
            locations={catalog.locations}
            onCreateCategory={createCategory}
            onSave={saveProduct}
            onCancel={closeEditor}
            onError={setError}
          />
        ) : (
          <>
            <div className="catalog-tabs" role="tablist">
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
            {tab === "products" ? (
              <ProductsTab
                products={catalog.products}
                categories={catalog.categories}
                currencyCode={catalog.currencyCode}
                onNew={() => {
                  setEditing(null);
                  setCreating(true);
                }}
                onEdit={(product) => {
                  setCreating(false);
                  setEditing(product);
                }}
                onDelete={(product) => setConfirm({ kind: "product", product })}
              />
            ) : (
              <CategoryManager
                categories={catalog.categories}
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
                onDelete={(category) =>
                  setConfirm({ kind: "category", category })
                }
              />
            )}
          </>
        )}
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
