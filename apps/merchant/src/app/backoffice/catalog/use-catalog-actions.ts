"use client";
import { useState } from "react";
import { jsonInit, useCatalog } from "./use-catalog";
import { useCatalogTour } from "./catalog-tour-context";
import type { CatalogHelpTour } from "./catalog-tour-state";
import type { Category, Product, ProductPayload } from "./types";

export type CatalogConfirm =
  | { kind: "product"; product: Product }
  | { kind: "category"; category: Category };
export function useCatalogActions() {
  const data = useCatalog();
  const tour = useCatalogTour()!;
  const [tab, setTab] = useState<"products" | "categories">("products");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [confirm, setConfirm] = useState<CatalogConfirm | null>(null);
  const [showAiImport, setShowAiImport] = useState(false);
  const editorOpen = creating || editing !== null;
  function newProduct() {
    setEditing(null);
    setCreating(true);
    tour.notify({ type: "opened" });
  }
  function editProduct(product: Product) {
    setCreating(false);
    setEditing(product);
    tour.notify({ type: "selected", id: product.id });
  }
  function deleteProduct(product: Product) {
    setConfirm({ kind: "product", product });
    tour.notify({ type: "selected", id: product.id });
  }
  function deleteCategory(category: Category) {
    setConfirm({ kind: "category", category });
    tour.notify({ type: "selected", id: category.id });
  }
  async function saveProduct(payload: ProductPayload, id: string | null) {
    const notify = tour.ticket();
    const ok = await data.mutate(
      id ? `/api/catalog/product/${id}` : "/api/catalog/product",
      jsonInit(id ? "PUT" : "POST", payload),
      "Producto guardado.",
      "No pudimos guardar el producto.",
      () =>
        notify({
          type: "saved",
          id: id ?? undefined,
          task: id ? "edit-product" : "create-product",
        }),
    );
    if (ok) {
      setCreating(false);
      setEditing(null);
    }
    return ok;
  }
  async function createCategory(name: string) {
    const notify = tour.ticket();
    return data.createCategory(name, (id) =>
      notify({ type: "saved", id, task: "create-category" }),
    );
  }
  async function renameCategory(id: string, name: string) {
    const notify = tour.ticket();
    return data.mutate(
      `/api/catalog/category/${id}`,
      jsonInit("PUT", { name }),
      "Categoría renombrada.",
      "No pudimos renombrar la categoría.",
      () => notify({ type: "saved", id, task: "edit-category" }),
    );
  }
  async function runConfirm() {
    if (!confirm || data.writing || data.refreshFailed) return;
    const target = confirm;
    const id =
      target.kind === "product" ? target.product.id : target.category.id;
    const notify = tour.ticket();
    const ok = await data.mutate(
      `/api/catalog/${target.kind}/${id}`,
      { method: "DELETE" },
      target.kind === "product" ? "Producto borrado." : "Categoría borrada.",
      "No pudimos borrar el elemento.",
      () =>
        notify({
          type: "saved",
          id,
          task:
            target.kind === "product" ? "delete-product" : "delete-category",
        }),
    );
    if (ok) setConfirm(null);
  }
  function closeEditor() {
    setCreating(false);
    setEditing(null);
    tour.stop();
  }
  function closeConfirm() {
    setConfirm(null);
    tour.stop();
  }
  function closeImport() {
    setShowAiImport(false);
    tour.stop();
  }
  function prepareHelp(task: CatalogHelpTour) {
    if (task.endsWith("category")) setTab("categories");
    else if (task.endsWith("product")) setTab("products");
  }
  return {
    ...data,
    tab,
    setTab,
    creating,
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
    createCategory,
    renameCategory,
    runConfirm,
    closeEditor,
    closeConfirm,
    closeImport,
    prepareHelp,
  };
}
