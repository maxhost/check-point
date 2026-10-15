"use client";

import { useEffect, useState } from "react";
import { EditPencil, Plus } from "iconoir-react";
import { Alert, Button, Text } from "../../../ui";
import {
  ModuleHeader,
  Skeleton,
  SkeletonScreen,
  Toast,
} from "../../../app/components/ui";
import { RecipeModal } from "./recipe-modal";
import { loadRecipes } from "./recipe-requests";
import { recipeError, type RecipeProduct } from "./recipe-types";

export function RecipesConsole() {
  const [data, setData] = useState<Awaited<
    ReturnType<typeof loadRecipes>
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState<RecipeProduct | "new" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void loadRecipes()
      .then((result) => {
        if (active) setData(result);
      })
      .catch((cause) => {
        if (active) setError(recipeError(cause));
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  function reload() {
    setData(null);
    setError(null);
    setAttempt((value) => value + 1);
  }
  return (
    <main className="merchant-shell">
      <div className="brand-page catalog-page grid gap-6">
        <ModuleHeader
          eyebrow="Recetas"
          title="Recetas"
          description="Define los ingredientes de cada producto de tu catálogo."
          closeHref="/backoffice"
        />
        <Toast message={notice} onDismiss={() => setNotice(null)} />
        <div className="flex flex-wrap justify-end gap-3">
          <Button
            onPress={() => setEditing("new")}
            isDisabled={!data?.products.length}
          >
            <Plus aria-hidden="true" className="size-5" />
            Nueva receta
          </Button>
        </div>
        {error && (
          <Alert kind="error" title={error}>
            <Button variant="secondary" onPress={reload}>
              Reintentar recetas
            </Button>
          </Alert>
        )}
        {!data && !error && (
          <SkeletonScreen label="Cargando recetas" className="grid gap-3">
            {[0, 1, 2].map((row) => (
              <div
                key={row}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface p-4 md:p-6"
              >
                <div className="grid w-full gap-2">
                  <Skeleton className="block h-6 w-full max-w-64" />
                  <Skeleton className="block h-6 w-full max-w-40" />
                </div>
                <Skeleton className="block size-12 shrink-0" />
              </div>
            ))}
          </SkeletonScreen>
        )}
        {data && !data.products.length && (
          <Text variant="muted">
            Añade productos a tu catálogo para crear sus recetas.
          </Text>
        )}
        {data && data.products.length > 0 && !data.recipes.length && (
          <Text variant="muted">
            Todavía no tienes recetas. Selecciona «Nueva receta» para elegir un
            producto y añadir sus ingredientes.
          </Text>
        )}
        {!!data?.recipes.length && (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            {data.recipes.map((product) => (
              <div
                key={product.productId}
                className="flex items-center justify-between gap-4 border-b border-border px-4 py-4 last:border-b-0 md:px-6"
              >
                <div className="grid min-w-0 gap-1 break-words">
                  <Text variant="label">
                    {product.productName}
                    {product.isCombo ? " · Combo" : ""}
                  </Text>
                  <Text variant="muted">
                    {product.isCombo
                      ? `${product.recipeCount} ${product.recipeCount === 1 ? "receta" : "recetas"}`
                      : `${product.ingredientCount} ${product.ingredientCount === 1 ? "ingrediente" : "ingredientes"}`}{" "}
                    por unidad
                  </Text>
                </div>
                <Button
                  variant="secondary"
                  aria-label={`Editar receta de ${product.productName}`}
                  onPress={() => setEditing(product)}
                >
                  <EditPencil aria-hidden="true" className="size-5" />
                  Editar
                </Button>
              </div>
            ))}
          </div>
        )}
        {editing && data && (
          <RecipeModal
            products={data.products}
            library={data.library}
            initialProduct={editing === "new" ? null : editing}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              setNotice("Receta guardada");
              reload();
            }}
          />
        )}
      </div>
    </main>
  );
}
