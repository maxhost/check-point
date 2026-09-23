"use client";

import { useEffect, useState } from "react";
import { MagicWand, Plus } from "iconoir-react";
import { ConfirmDialog } from "../../components/confirm-dialog";
import { ModuleHeader, Skeleton, SkeletonScreen, Toast } from "../../components/ui";
import { CatalogAiImport } from "./catalog-ai-import";
import { CategoryManager } from "./category-manager";
import { ProductEditor } from "./product-editor";
import { ProductsTab } from "./products-tab";
import type { Catalog, Category, Product, ProductPayload } from "./types";

type Confirm =
  | { kind: "product"; product: Product }
  | { kind: "category"; category: Category };

type Tab = "products" | "categories";

export default function CatalogPage({ canDelete = true }: { canDelete?: boolean }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [tab, setTab] = useState<Tab>("products");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [showAiImport, setShowAiImport] = useState(false);
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
        {error ? <p className="form-error">{error}</p> : <CatalogSkeleton />}
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
            <p>{catalog.categories.length === 1 ? "categoría" : "categorías"}</p>
          </div>
          <div>
            <span>{catalog.locations.length}</span>
            <p>{catalog.locations.length === 1 ? "local" : "locales"}</p>
          </div>
        </section>
        <section className="catalog-ai-banner">
          <div className="catalog-ai-icon" aria-hidden="true"><MagicWand /></div>
          <div>
            <p className="eyebrow">Carga inteligente</p>
            <h2>Convertí una foto o PDF en tu catálogo</h2>
            <p>La IA preparará categorías, productos y precios para que solo revises y completes.</p>
          </div>
          <button className="button alt" type="button" onClick={() => setShowAiImport(true)}>
            Probar importador
          </button>
        </section>
        <div className="catalog-section-head">
          <div className="catalog-tabs" role="tablist" aria-label="Vista del catálogo">
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
          <button className="button catalog-primary-action" type="button" onClick={() => {
            setEditing(null);
            setCreating(true);
          }}>
            <Plus aria-hidden="true" /> Nuevo producto
          </button>
        </div>
            {tab === "products" ? (
              <ProductsTab
                products={catalog.products}
                categories={catalog.categories}
                locations={catalog.locations}
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
                canDelete={canDelete}
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
          onCancel={closeEditor}
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

export function CatalogSkeleton() {
  return (
    <SkeletonScreen label="Cargando catálogo" className="brand-page catalog-page catalog-skeleton">
      <div className="catalog-skeleton-head"><div><Skeleton width={90} height={14} /><Skeleton width="min(430px, 80vw)" height={38} /><Skeleton width="min(520px, 85vw)" height={18} /></div><Skeleton width={44} height={44} radius={22} /></div>
      <div className="catalog-overview">{[0, 1, 2].map((item) => <div key={item}><Skeleton width={42} height={28} /><Skeleton width={72} height={14} /></div>)}</div>
      <Skeleton height={150} radius={20} />
      <div className="catalog-skeleton-cards">{[0, 1, 2].map((item) => <Skeleton key={item} height={104} radius={18} />)}</div>
    </SkeletonScreen>
  );
}
