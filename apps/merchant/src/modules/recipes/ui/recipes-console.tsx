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
import {
  StockLocationField,
  useStockLocations,
} from "../../stock/ui/stock-locations";
import { loadRecipes } from "./recipe-requests";
import { recipeError, recipeMoney, type RecipeProduct } from "./recipe-types";

import { basisLabel, unitLabel } from "./composition-basis-draft";

export function RecipesConsole() {
  const local = useStockLocations("/api/modules/recipes/locations");
  const { locationId } = local;
  const [loaded, setData] = useState<Awaited<
    ReturnType<typeof loadRecipes>
  > | null>(null);
  const [failure, setError] = useState<{
    locationId: string;
    message: string;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState<RecipeProduct | "new" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Hide old amounts immediately, before effects run for the newly chosen local.
  const data = loaded?.locationId === locationId ? loaded : null;
  const error = failure?.locationId === locationId ? failure.message : null;
  useEffect(() => {
    if (!locationId) return;
    let active = true;
    void loadRecipes(locationId)
      .then((result) => {
        if (active) {
          setData(result);
          setError(null);
        }
      })
      .catch((cause) => {
        if (active) setError({ locationId, message: recipeError(cause) });
      });
    return () => {
      active = false;
    };
  }, [attempt, locationId]);
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
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="w-full sm:w-64">
            {local.locations?.length === 1 &&
            local.locations[0].status === "active" ? (
              <Text variant="muted">Local: {local.locations[0].name}</Text>
            ) : local.locations?.length ? (
              <StockLocationField
                locations={local.locations}
                locationId={locationId}
                onChange={(id) => {
                  setData(null);
                  setError(null);
                  setEditing(null);
                  local.setLocationId(id);
                }}
              />
            ) : null}
          </div>
          <Button
            onPress={() => setEditing("new")}
            isDisabled={!data?.products.length}
          >
            <Plus aria-hidden="true" className="size-5" />
            Nueva receta
          </Button>
        </div>
        <Text variant="muted">
          El costo de receta no incluye merma, packaging ni comisiones.
        </Text>
        {local.error && (
          <Alert kind="error" title={local.error}>
            <Button variant="secondary" onPress={local.reload}>
              Reintentar locales
            </Button>
          </Alert>
        )}
        {local.locations?.length === 0 && (
          <Text variant="muted">
            Crea un local para consultar el costo de tus recetas.
          </Text>
        )}
        {!!local.locations?.length && !locationId && (
          <Text variant="muted">
            Elige un local para consultar el costo de tus recetas.
          </Text>
        )}
        {error && (
          <Alert kind="error" title={error}>
            <Button variant="secondary" onPress={reload}>
              Reintentar recetas
            </Button>
          </Alert>
        )}
        {!data &&
          !error &&
          !local.error &&
          (!local.locations || !!locationId) && (
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
                className="grid gap-4 border-b border-border px-4 py-4 last:border-b-0 md:px-6"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="grid min-w-0 gap-1 break-words">
                    <Text variant="label">
                      {product.productName}
                      {product.isCombo ? " · Combo" : ""}
                    </Text>
                    <Text variant="muted">
                      {product.isCombo
                        ? `${product.recipeCount} ${product.recipeCount === 1 ? "receta" : "recetas"}`
                        : `${product.ingredientCount} ${product.ingredientCount === 1 ? "ingrediente" : "ingredientes"}`}{" "}
                      para {basisLabel(product)} de producto
                    </Text>
                    <Text variant="small">
                      Costo, precio y ganancia por 1{" "}
                      {unitLabel(product.pricingUnit ?? "unit")}
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
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-4">
                  {[
                    [
                      "Costo de receta",
                      product.recipeCost === null
                        ? "Sin costo completo"
                        : recipeMoney(
                            product.recipeCost,
                            data.currencyCode,
                            data.minorUnits,
                          ),
                    ],
                    [
                      "Precio",
                      product.price === null
                        ? "Sin precio"
                        : recipeMoney(
                            product.price,
                            data.currencyCode,
                            data.minorUnits,
                          ),
                    ],
                    [
                      "Ganancia",
                      product.profit === null
                        ? "—"
                        : recipeMoney(
                            product.profit,
                            data.currencyCode,
                            data.minorUnits,
                          ),
                    ],
                    [
                      "Margen",
                      product.marginPercent === null
                        ? product.price === "0" || product.price === "0.00"
                          ? "Sin margen"
                          : "—"
                        : `${product.marginPercent.replace(".", ",")} %`,
                    ],
                  ].map(([label, value]) => (
                    <div key={label} className="grid min-w-0 gap-1 break-words">
                      <Text variant="muted">{label}</Text>
                      <Text className="tabular-nums">{value}</Text>
                    </div>
                  ))}
                </div>
                {product.costStatus === "incompatible_basis" && (
                  <Alert
                    kind="warning"
                    title="La base y el modo de venta no son compatibles"
                  >
                    Define una base en unidades para venta por unidad o en masa
                    para venta por peso. Después cambia el modo en Catálogo. El
                    costo y la ganancia no están disponibles.
                  </Alert>
                )}
                {product.costStatus === "rounded_to_zero" && (
                  <Alert
                    kind="warning"
                    title="Consumo menor que la precisión de stock"
                  >
                    Hay un consumo positivo que se redondea a cero. Revisa las
                    cantidades; el costo y la ganancia no están completos.
                  </Alert>
                )}
                {product.missingCosts.length > 0 && (
                  <Alert kind="warning" title="Falta costo en este local">
                    {product.missingCosts
                      .map((item) => item.itemName)
                      .join(", ")}
                  </Alert>
                )}
              </div>
            ))}
          </div>
        )}
        {editing && data && (
          <RecipeModal
            key={`${locationId}:${editing === "new" ? "new" : editing.productId}`}
            products={data.products}
            library={data.library}
            initialProduct={editing === "new" ? null : editing}
            onClose={() => setEditing(null)}
            onAccessDenied={() => {
              setEditing(null);
              setData(null);
              setError({
                locationId: locationId ?? "",
                message:
                  "Tu acceso a Recetas cambió. Revisa tus permisos antes de continuar.",
              });
            }}
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
