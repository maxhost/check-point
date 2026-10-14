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
import { panelRequest } from "../../../app/backoffice/panel-request";
import {
  StockLocationField,
  useStockLocations,
} from "../../stock/ui/stock-locations";
import { formatAmount } from "../../stock/ui/stock-types";
import { RecipeModal } from "./recipe-modal";
import { recipeError, type RecipeSummary } from "./recipe-types";

export function RecipesConsole() {
  const local = useStockLocations("/api/modules/recipes/locations");
  const [products, setProducts] = useState<RecipeSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState<RecipeSummary | "new" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (!local.locationId) return;
    void panelRequest<{ recipes: RecipeSummary[] }>(
      `/api/modules/recipes?locationId=${encodeURIComponent(local.locationId)}`,
    )
      .then((data) => {
        if (active) setProducts(data.recipes);
      })
      .catch((cause) => {
        if (active) setError(recipeError(cause));
      });
    return () => {
      active = false;
    };
  }, [attempt, local.locationId]);
  function reload() {
    setProducts(null);
    setError(null);
    setAttempt((value) => value + 1);
  }
  const recipes = products?.filter((product) => product.lineCount > 0) ?? [];
  return (
    <main className="merchant-shell">
      <div className="brand-page catalog-page grid gap-6">
        <ModuleHeader
          eyebrow="Recetas"
          title="Recetas"
          description="Define los ingredientes de cada producto de tu catálogo."
          closeHref="/backoffice"
        />
        {local.locations && (
          <StockLocationField
            locations={local.locations}
            locationId={local.locationId}
            onChange={(id) => {
              setProducts(null);
              setError(null);
              local.setLocationId(id);
            }}
          />
        )}
        {local.error && (
          <Alert kind="error" title={local.error}>
            <Button variant="secondary" onPress={local.reload}>
              Reintentar locales
            </Button>
          </Alert>
        )}
        {local.locations && !local.locationId && local.locations.length > 0 && (
          <Text variant="muted">
            Elige un local para consultar los costos de las recetas.
          </Text>
        )}
        <Toast message={notice} onDismiss={() => setNotice(null)} />
        <div className="flex flex-wrap justify-end gap-3">
          <Button
            onPress={() => setEditing("new")}
            isDisabled={
              !products || !products.some((product) => product.lineCount === 0)
            }
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
        {!products &&
          !error &&
          !local.error &&
          (!local.locations || local.locationId) && (
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
        {products && !products.length && (
          <Text variant="muted">
            Añade productos a tu catálogo para crear sus recetas.
          </Text>
        )}
        {products && products.length > 0 && !recipes.length && (
          <Text variant="muted">
            Todavía no tienes recetas. Selecciona «Nueva receta» para elegir un
            producto y añadir sus ingredientes.
          </Text>
        )}
        {products &&
          products.length > 0 &&
          products.every((product) => product.lineCount > 0) && (
            <Text variant="small">
              Todos los productos tienen receta. Puedes editarlas desde la
              lista.
            </Text>
          )}
        {recipes.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            {recipes.map((product) => (
              <div
                key={product.productId}
                className="flex items-center justify-between gap-4 border-b border-border px-4 py-4 last:border-b-0 md:px-6"
              >
                <div className="grid min-w-0 gap-1 break-words">
                  <Text variant="label">{product.productName}</Text>
                  <Text variant="muted">
                    {product.lineCount}{" "}
                    {product.lineCount === 1 ? "ingrediente" : "ingredientes"}{" "}
                    por unidad
                  </Text>
                  <Text variant="small">
                    Costo de ingredientes:{" "}
                    {product.cost === null
                      ? "Sin costo"
                      : formatAmount(product.cost)}
                    {!product.costComplete && product.cost !== null
                      ? " · Faltan precios"
                      : ""}
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
        {editing && products && local.locationId && (
          <RecipeModal
            products={products}
            locationId={local.locationId}
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
