"use client";

import { MagicWand, Plus } from "iconoir-react";
import { ModuleHeader, Toast } from "../../components/ui";
import { CatalogAiImport } from "./catalog-ai-import";
import { CatalogSkeleton } from "./catalog-skeleton";
import { CategoryManager } from "./category-manager";
import { ProductEditor } from "./product-editor";
import { ProductsTab } from "./products-tab";
import { useCatalogActions } from "./use-catalog-actions";
import { CatalogDeleteDialog } from "./catalog-delete-dialog";
import { CatalogTourProvider } from "./catalog-tour-context";
import { CatalogTourController } from "./catalog-tour-controller";

/** ADR 0086 — el copy del bloqueo. La proteccion es el 409 del servidor; esto es su reflejo,
 * para que el merchant no choque contra un error que no esperaba. */
const IMPORTANDO =
  "Estamos importando tu menú. Mientras termina no podés crear productos ni categorías; sí podés editar y borrar lo que ya está.";

export default function CatalogPage({
  canDelete = true,
  isOwner = true,
}: {
  canDelete?: boolean;
  isOwner?: boolean;
}) {
  return (
    <CatalogTourProvider>
      <CatalogContent canDelete={canDelete} isOwner={isOwner} />
    </CatalogTourProvider>
  );
}
function CatalogContent({
  canDelete,
  isOwner,
}: {
  canDelete: boolean;
  isOwner: boolean;
}) {
  const {
    catalog,
    notice,
    error,
    setNotice,
    setError,
    reload,
    createCategory,
    tab,
    setTab,
    editing,
    confirm,
    showAiImport,
    setShowAiImport,
    editorOpen,
    newProduct,
    editProduct,
    deleteProduct,
    deleteCategory,
    saveProduct,
    renameCategory,
    runConfirm,
    closeEditor,
    closeConfirm,
    closeImport,
    prepareHelp,
    refreshFailed,
    writing,
  } = useCatalogActions();

  if (!catalog) {
    return (
      <main className="merchant-shell">
        {error ? (
          <>
            <p className="form-error" role="alert">
              {error}
            </p>
            <button className="button" onClick={() => void reload()}>
              Reintentar
            </button>
          </>
        ) : (
          <CatalogSkeleton />
        )}
      </main>
    );
  }

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
        <CatalogTourController
          catalog={catalog}
          canDelete={canDelete}
          isOwner={isOwner}
          blocked={
            editorOpen ||
            confirm !== null ||
            showAiImport ||
            writing ||
            refreshFailed
          }
          onPrepare={prepareHelp}
          onNotice={setNotice}
        />
        {refreshFailed && (
          <div className="catalog-tour-notice" role="alert">
            <span>Los cambios ya se guardaron. Falta actualizar la lista.</span>
            <button
              data-tour="catalog-refresh"
              className="small-button"
              onClick={() => void reload()}
            >
              Reintentar lectura
            </button>
          </div>
        )}
        <section className="catalog-ai-banner" data-tour="catalog-import-entry">
          <div className="catalog-ai-icon" aria-hidden="true">
            <MagicWand />
          </div>
          <div>
            <p className="eyebrow">Carga inteligente</p>
            <h2>Convertí una foto o PDF en tu catálogo</h2>
            <p>
              La IA crea categorías, productos y precios. Después podés revisar
              y completar tu catálogo.
            </p>
          </div>
          <button
            className="button alt"
            type="button"
            onClick={() => setShowAiImport(true)}
          >
            Importar con IA
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
              data-tour="catalog-products-entry"
              aria-selected={tab === "products"}
              className={tab === "products" ? "active" : ""}
              onClick={() => setTab("products")}
            >
              Productos
            </button>
            <button
              type="button"
              role="tab"
              data-tour="catalog-categories-entry"
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
            data-tour="catalog-new-product"
            disabled={importando || writing || refreshFailed}
            title={importando ? IMPORTANDO : undefined}
            onClick={newProduct}
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
            importInProgress={importando || writing || refreshFailed}
            onNew={newProduct}
            onEdit={editProduct}
            onDelete={deleteProduct}
            canDelete={canDelete}
            actionsDisabled={writing || refreshFailed}
          />
        ) : (
          <CategoryManager
            categories={catalog.categories}
            importInProgress={importando || writing || refreshFailed}
            onCreate={(name) =>
              createCategory(name).then((cat) => cat !== null)
            }
            onRename={renameCategory}
            onDelete={deleteCategory}
            canDelete={canDelete}
            actionsDisabled={writing || refreshFailed}
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
          categoryCreationDisabled={importando || writing || refreshFailed}
        />
        <CatalogAiImport
          open={showAiImport}
          onClose={closeImport}
          onAccepted={async () => {
            await reload();
          }}
        />
      </div>
      <CatalogDeleteDialog
        confirm={confirm}
        busy={writing}
        onCancel={closeConfirm}
        onConfirm={() => void runConfirm()}
      />
    </main>
  );
}
