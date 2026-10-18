"use client";

import { useEffect, useRef, useState } from "react";
import { Trash } from "iconoir-react";
import {
  Alert,
  Button,
  CheckboxField,
  Form,
  FormActions,
  Text,
  TextField,
} from "../../../ui";
import { Skeleton, SkeletonScreen } from "../../../app/components/ui";
import { StaffFormModal } from "../../../app/backoffice/staff/staff-form-modal";
import {
  PanelRequestError,
  panelRequest,
} from "../../../app/backoffice/panel-request";
import {
  editableAmount,
  formatAmount,
  type StockItem,
} from "../../stock/ui/stock-types";
import type {
  LibraryRecipeDTO,
  ProductCompositionDTO,
} from "../server/contracts";
import { loadRecipeReview } from "./recipe-requests";
import { RecipeDraftSource } from "./recipe-source";
import { RecipeLines } from "./recipe-lines";
import {
  blankIngredient,
  compositionPayload,
  compositionUrl,
  draftIngredients,
  recipeError,
  recipePayload,
  recipeUrl,
  savedIngredients,
  savedRecipeState,
  reconcileRecipeDraft,
  type LibrarySummary,
  type RecipeComponent,
  type RecipeDraft,
  type RecipeLine,
  type RecipeProduct,
} from "./recipe-types";

import {
  CompositionBasisFields,
  CompositionReview,
} from "./composition-basis-fields";
import {
  defaultBasis,
  readBasis,
  validBasis,
  basisLabel,
} from "./composition-basis-draft";

export function RecipeModal({
  products,
  library,
  initialProduct,
  onClose,
  onSaved,
  onAccessDenied,
}: {
  products: RecipeProduct[];
  library: LibrarySummary[];
  initialProduct: RecipeProduct | null;
  onClose: () => void;
  onSaved: () => void;
  onAccessDenied?: () => void;
}) {
  const [step, setStep] = useState(initialProduct ? 4 : 1);
  const [isCombo, setIsCombo] = useState<boolean | null>(null);
  const [product, setProduct] = useState<RecipeProduct | null>(null);
  const [search, setSearch] = useState("");
  const [recipeSearch, setRecipeSearch] = useState("");
  const [basis, setBasis] = useState(defaultBasis);
  const [basisInvalid, setBasisInvalid] = useState(false);
  const [reviewRequired, setReviewRequired] = useState<
    "composition" | "library" | "unknown-library" | null
  >(null);
  const [remote, setRemote] = useState<
    ProductCompositionDTO | LibraryRecipeDTO | null
  >(null);
  const [denied, setDenied] = useState(false);
  const [revisionId, setRevisionId] = useState<string | null>(null);
  const [components, setComponents] = useState<RecipeComponent[]>([]);
  const [recipe, setRecipe] = useState<LibraryRecipeDTO | null>(null);
  const [name, setName] = useState("");
  const [lines, setLines] = useState<RecipeLine[]>([]);
  const [items, setItems] = useState<StockItem[] | null>(null);
  const [stockError, setStockError] = useState<string | null>(null);
  const [stockAttempt, setStockAttempt] = useState(0);
  const [unparsed, setUnparsed] = useState<string[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);
  const [yieldCount, setYieldCount] = useState(1);
  const [busy, setBusy] = useState<"load" | "analyze" | "save" | null>(
    initialProduct ? "load" : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [partialSave, setPartialSave] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(false);
  const operation = useRef(0);
  const savedBody = useRef<string | null>(null);

  useEffect(() => {
    mounted.current = true;
    if (initialProduct) void selectProduct(initialProduct);
    return () => {
      mounted.current = false;
      operation.current++;
    };
    // Each modal instance owns one initial selection; subsequent choices use selectProduct.
  }, []);

  useEffect(() => {
    if (isCombo !== false || !product || items) return;
    let active = true;
    async function loadItems() {
      const locations = await panelRequest<{
        locations: { id: string }[];
        defaultLocationId: string | null;
      }>("/api/modules/recipes/locations");
      const locationId =
        locations.defaultLocationId ?? locations.locations[0]?.id;
      if (!locationId)
        throw new Error(
          "Crea un local para consultar los insumos de la receta.",
        );
      return panelRequest<{ items: StockItem[] }>(
        `/api/modules/stock/items?status=all&locationId=${encodeURIComponent(locationId)}`,
      );
    }
    void loadItems()
      .then((data) => {
        if (active) setItems(data.items);
      })
      .catch((cause) => {
        if (active) {
          setStockError(recipeError(cause));
          if (
            cause instanceof PanelRequestError &&
            (cause.status === 401 || cause.status === 403)
          )
            handleError(cause);
        }
      });
    return () => {
      active = false;
    };
  }, [isCombo, product, items, stockAttempt]);

  function handleError(cause: unknown) {
    if (
      cause instanceof PanelRequestError &&
      (cause.status === 401 || cause.status === 403)
    ) {
      setDenied(true);
      setProduct(null);
      clearRecipe();
      setItems(null);
      setBasis(defaultBasis());
      setRemote(null);
      onAccessDenied?.();
    }
    setError(recipeError(cause));
  }
  function close() {
    if (!lock.current) onClose();
  }
  function go(next: number) {
    setStep(next);
    setError(null);
  }
  function clearRecipe() {
    setRecipe(null);
    setLines([]);
    setComponents([]);
    setName("");
    setUnparsed([]);
    setAcknowledged(false);
    setYieldCount(1);
    savedBody.current = null;
  }
  async function selectProduct(selected: RecipeProduct) {
    if (lock.current) return;
    lock.current = true;
    const token = ++operation.current;
    setBusy("load");
    setError(null);
    try {
      const { composition } = await panelRequest<{
        composition: ProductCompositionDTO;
      }>(compositionUrl(selected.productId));
      const first = composition.recipes[0];
      const detail =
        !composition.isCombo && first
          ? (
              await panelRequest<{ recipe: LibraryRecipeDTO }>(
                recipeUrl(first.recipeId),
              )
            ).recipe
          : null;
      if (!mounted.current || token !== operation.current) return;
      clearRecipe();
      setReviewRequired(null);
      setRemote(null);
      try {
        setBasis(readBasis(composition));
        setBasisInvalid(false);
      } catch {
        setBasisInvalid(true);
        setError(
          "No pudimos verificar la base guardada. Consulta de nuevo antes de guardar.",
        );
      }
      if (detail) savedBody.current = savedRecipeState(detail).body;
      setProduct(selected);
      setRevisionId(composition.revisionId);
      setName(detail?.name ?? selected.productName);
      setSearch("");
      setRecipeSearch("");
      setComponents(
        composition.recipes.map((entry) => ({
          recipeId: entry.recipeId,
          recipeName: entry.recipeName,
          quantity: editableAmount(entry.quantity),
        })),
      );
      setRecipe(detail);
      setLines(detail ? savedIngredients(detail) : []);
      if (composition.recipes.length) {
        setIsCombo(composition.isCombo);
        setStep(4);
      } else setStep(2);
    } catch (cause) {
      if (mounted.current) handleError(cause);
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(null);
    }
  }

  function acceptDraft(draft: RecipeDraft) {
    setLines(
      draft.lines.length
        ? draftIngredients(draft)
        : [blankIngredient(crypto.randomUUID())],
    );
    setYieldCount(draft.yield);
    setUnparsed(draft.unparsed);
    setAcknowledged(false);
    go(4);
  }

  let validation = "";
  try {
    if (basisInvalid)
      throw new Error("Consulta la base guardada antes de continuar.");
    validBasis(basis);
    if (!product || isCombo === null)
      throw new Error("Elige el tipo y un producto.");
    if (isCombo) compositionPayload(true, components, revisionId, basis);
    else {
      if (!name.trim() || [...name.trim()].length > 120)
        throw new Error("El nombre debe tener entre 1 y 120 caracteres.");
      if (!items) throw new Error("Espera a que se carguen los insumos.");
      if (recipe?.status === "archived")
        throw new Error("La receta está archivada. Elige otro producto.");
      recipePayload(
        lines,
        items,
        recipe?.lines.map((line) => line.itemId),
      );
      if (unparsed.length && !acknowledged)
        throw new Error("Revisa los fragmentos pendientes antes de guardar.");
    }
  } catch (cause) {
    validation = recipeError(cause);
  }

  async function save() {
    if (
      lock.current ||
      validation ||
      reviewRequired ||
      denied ||
      !product ||
      isCombo === null
    )
      return;
    lock.current = true;
    setBusy("save");
    setError(null);
    let saving: "composition" | "library" | "unknown-library" = "composition";
    try {
      let selectedComponents = components;
      if (!isCombo && items) {
        const body = {
          name: name.trim(),
          lines: recipePayload(
            lines,
            items,
            recipe?.lines.map((line) => line.itemId),
          ),
        };
        let saved = recipe;
        if (!saved || JSON.stringify(body) !== savedBody.current) {
          saving = saved ? "library" : "unknown-library";
          const result = await panelRequest<{ recipe: LibraryRecipeDTO }>(
            saved ? recipeUrl(saved.id) : "/api/modules/recipes/library",
            saved ? "PUT" : "POST",
            {
              ...body,
              ...(saved ? { expectedRevisionId: saved.revisionId } : {}),
            },
          );
          saved = result.recipe;
          // Library persistence can succeed before composition fails. Keep its identity,
          // revision and resolved item IDs so retry neither recreates recipe nor insumos.
          const persisted = savedRecipeState(saved, items);
          savedBody.current = persisted.body;
          if (mounted.current) {
            setRecipe(saved);
            setLines(persisted.lines);
            setItems(persisted.items);
            setPartialSave(true);
          }
        }
        selectedComponents = [
          {
            recipeId: saved.id,
            recipeName: saved.name,
            quantity: components[0]?.quantity ?? "1",
          },
        ];
      }
      saving = "composition";
      await panelRequest(
        compositionUrl(product.productId),
        "PUT",
        compositionPayload(isCombo, selectedComponents, revisionId, basis),
      );
      if (mounted.current) onSaved();
    } catch (cause) {
      if (mounted.current) {
        handleError(cause);
        if (
          !(cause instanceof PanelRequestError) ||
          cause.status === 409 ||
          cause.status >= 500
        )
          setReviewRequired(saving);
      }
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(null);
    }
  }

  async function reviewRemote() {
    if (lock.current || !product || denied) return;
    lock.current = true;
    setBusy("load");
    setRemote(null);
    try {
      const result = await loadRecipeReview(
        product.productId,
        reviewRequired,
        recipe?.id ?? null,
        name,
      );
      if (mounted.current) setRemote(result);
    } catch (cause) {
      if (mounted.current) handleError(cause);
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(null);
    }
  }

  function keepDraft() {
    if (!remote) return;
    if ("recipes" in remote) {
      try {
        const checked = readBasis(remote);
        if (basisInvalid) {
          setBasis(checked);
          setBasisInvalid(false);
        }
      } catch {
        setError("La base remota sigue sin verificar.");
        return;
      }
      setRevisionId(remote.revisionId);
    } else {
      const reconciled = reconcileRecipeDraft(remote, lines, items ?? []);
      setItems(reconciled.items);
      setLines(reconciled.lines);
      savedBody.current = reconciled.body;
      setRecipe(remote);
      setPartialSave(true);
    }
    setReviewRequired(null);
    setRemote(null);
    setError(null);
  }

  const query = search.trim().toLocaleLowerCase();
  const matches = query
    ? products.filter((entry) =>
        entry.productName.toLocaleLowerCase().includes(query),
      )
    : [];
  const recipeQuery = recipeSearch.trim().toLocaleLowerCase();
  const available = recipeQuery
    ? library.filter(
        (entry) =>
          entry.status === "active" &&
          entry.name.toLocaleLowerCase().includes(recipeQuery) &&
          !components.some((component) => component.recipeId === entry.id),
      )
    : [];

  return (
    <StaffFormModal
      open
      eyebrow="Recetas"
      title={product ? product.productName : "Nueva receta"}
      description={`Paso ${step} de 4 · ${["Tipo de receta", "Producto del catálogo", isCombo ? "Recetas del combo" : "Crea el borrador", "Revisa y confirma"][step - 1]}`}
      onClose={close}
      dismissible={!busy}
    >
      <div className="grid gap-6">
        {error && <Alert kind="error" title={error} />}
        {!denied && reviewRequired && (
          <CompositionReview
            remote={remote}
            uncertainLibrary={reviewRequired === "unknown-library"}
            busy={!!busy}
            onConsult={() => void reviewRemote()}
            onKeep={keepDraft}
          />
        )}
        {!denied && partialSave && (
          <Alert
            kind="warning"
            title="La receta ya se guardó. Falta confirmar su composición en el producto."
          >
            Revisa cualquier aviso antes de confirmar. Si cierras, la receta
            seguirá en la biblioteca.
          </Alert>
        )}
        {busy === "load" && (
          <SkeletonScreen label="Cargando receta" className="grid gap-3">
            <Skeleton className="block h-12 w-full" />
            <Skeleton className="block h-40 w-full" />
          </SkeletonScreen>
        )}
        {!denied && !busy && initialProduct && !product && (
          <Button
            variant="secondary"
            onPress={() => void selectProduct(initialProduct)}
          >
            Reintentar
          </Button>
        )}
        {!denied && busy !== "load" && step === 1 && (
          <div className="grid gap-4">
            <Text variant="label">Elige el tipo de receta</Text>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Combo", value: true },
                { label: "Catálogo", value: false },
              ].map((kind) => (
                <Button
                  key={kind.label}
                  variant={isCombo === kind.value ? "primary" : "secondary"}
                  aria-pressed={isCombo === kind.value}
                  isDisabled={!!busy || partialSave}
                  onPress={() => {
                    if (isCombo !== kind.value) {
                      clearRecipe();
                      setName(product?.productName ?? "");
                    }
                    setIsCombo(kind.value);
                  }}
                >
                  {kind.label}
                </Button>
              ))}
            </div>
            <FormActions>
              <Button variant="secondary" onPress={close}>
                Cancelar
              </Button>
              <Button isDisabled={isCombo === null} onPress={() => go(2)}>
                Continuar
              </Button>
            </FormActions>
          </div>
        )}
        {!denied && busy !== "load" && step === 2 && (
          <div className="grid gap-4">
            {product ? (
              <>
                <Text variant="label">{product.productName}</Text>
                <div>
                  <Button
                    variant="quiet"
                    isDisabled={!!busy || partialSave}
                    onPress={() => {
                      setProduct(null);
                      setRevisionId(null);
                      clearRecipe();
                    }}
                  >
                    Cambiar producto
                  </Button>
                </div>
                {isCombo === false && (
                  <TextField
                    label="Nombre de la receta"
                    value={name}
                    onChange={setName}
                    maxLength={120}
                    isDisabled={!!busy}
                  />
                )}
              </>
            ) : (
              <>
                <TextField
                  label="Buscar producto"
                  placeholder="Nombre del producto"
                  value={search}
                  onChange={setSearch}
                  maxLength={120}
                  isDisabled={!!busy}
                />
                {!!query && (
                  <div className="grid max-h-80 gap-2 overflow-y-auto">
                    {matches.map((entry) => (
                      <Button
                        key={entry.productId}
                        variant="secondary"
                        className="justify-start"
                        onPress={() => void selectProduct(entry)}
                      >
                        {entry.productName}
                      </Button>
                    ))}
                  </div>
                )}
                {!!query && !matches.length && (
                  <Text variant="muted">
                    No hay productos que coincidan con tu búsqueda.
                  </Text>
                )}
              </>
            )}
            <FormActions>
              <Button variant="secondary" onPress={() => go(1)}>
                Atrás
              </Button>
              <Button
                isDisabled={!product || (isCombo === false && !name.trim())}
                onPress={() => go(3)}
              >
                Continuar
              </Button>
            </FormActions>
          </div>
        )}
        {!denied && busy !== "load" && product && isCombo === false && (
          <RecipeDraftSource
            active={step === 3}
            name={name}
            productName={product.productName}
            hasLines={!!lines.length}
            busy={!!busy}
            onDraft={acceptDraft}
            onBack={() => go(2)}
            onManual={() => {
              if (!lines.length)
                setLines([blankIngredient(crypto.randomUUID())]);
              go(4);
            }}
            onBusyChange={(value) => {
              lock.current = value;
              setBusy(value ? "analyze" : null);
            }}
          />
        )}
        {!denied &&
          busy !== "load" &&
          step === 3 &&
          product &&
          isCombo === true && (
            <div className="grid gap-4">
              <TextField
                label="Buscar recetas"
                placeholder="Nombre de la receta"
                value={recipeSearch}
                onChange={setRecipeSearch}
                maxLength={120}
              />
              {!!recipeQuery && (
                <div className="grid max-h-80 gap-2 overflow-y-auto">
                  {available.map((entry) => (
                    <Button
                      key={entry.id}
                      variant="secondary"
                      className="justify-start"
                      isDisabled={components.length >= 50}
                      onPress={() => {
                        setComponents([
                          ...components,
                          {
                            recipeId: entry.id,
                            recipeName: entry.name,
                            quantity: "1",
                          },
                        ]);
                        setRecipeSearch("");
                      }}
                    >
                      {entry.name}
                    </Button>
                  ))}
                </div>
              )}
              {!!recipeQuery && !available.length && (
                <Text variant="muted">
                  No hay recetas disponibles que coincidan con tu búsqueda.
                </Text>
              )}
              {!library.some((entry) => entry.status === "active") && (
                <Text variant="muted">
                  Crea primero una receta de Catálogo para poder añadirla al
                  combo.
                </Text>
              )}
              <Text variant="label">
                Recetas del combo ({components.length})
              </Text>
              {components.map((entry) => (
                <div
                  key={entry.recipeId}
                  className="flex items-center justify-between gap-3"
                >
                  <Text>{entry.recipeName}</Text>
                  <Button
                    variant="quiet"
                    aria-label={`Quitar ${entry.recipeName}`}
                    onPress={() =>
                      setComponents(
                        components.filter(
                          (component) => component.recipeId !== entry.recipeId,
                        ),
                      )
                    }
                  >
                    <Trash aria-hidden="true" className="size-5" />
                  </Button>
                </div>
              ))}
              <FormActions>
                <Button variant="secondary" onPress={() => go(2)}>
                  Atrás
                </Button>
                <Button isDisabled={!components.length} onPress={() => go(4)}>
                  Revisar
                </Button>
              </FormActions>
            </div>
          )}
        {!denied && busy !== "load" && step === 4 && product && (
          <Form
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <Text variant="label">
              {isCombo ? "Revisa las recetas del combo" : name}
            </Text>
            {basisInvalid ? (
              <Alert kind="error" title="Base guardada sin verificar">
                <Button
                  variant="secondary"
                  onPress={() => {
                    setReviewRequired("composition");
                    void reviewRemote();
                  }}
                >
                  Consultar base de nuevo
                </Button>
              </Alert>
            ) : (
              <CompositionBasisFields
                value={basis}
                onChange={setBasis}
                disabled={!!busy || !!reviewRequired}
              />
            )}
            {isCombo ? (
              <>
                <Text variant="muted">
                  Indica la cantidad de cada receta de biblioteca para producir{" "}
                  {basisLabel(basis)} de {product.productName}.
                </Text>
                {components.map((entry) => (
                  <TextField
                    key={entry.recipeId}
                    label={`Cantidad de ${entry.recipeName}`}
                    inputMode="decimal"
                    value={entry.quantity}
                    isDisabled={!!busy}
                    onChange={(quantity) =>
                      setComponents(
                        components.map((component) =>
                          component.recipeId === entry.recipeId
                            ? { ...component, quantity }
                            : component,
                        ),
                      )
                    }
                  />
                ))}
              </>
            ) : (
              <>
                <Text variant="muted">
                  Revisa los ingredientes por una unidad de la receta de
                  biblioteca. La base del producto se define por separado.
                  {yieldCount > 1
                    ? ` Se dividieron las cantidades de la tanda entre ${formatAmount(yieldCount)}.`
                    : ""}
                </Text>
                {components[0] &&
                  Number(components[0].quantity.replace(",", ".")) !== 1 && (
                    <Text variant="small">
                      Este producto usa {components[0].quantity} unidades de
                      esta receta para producir {basisLabel(basis)} del
                      producto.
                    </Text>
                  )}
                {recipe && (
                  <Text variant="small">
                    Los cambios de esta receta también se aplicarán a los
                    productos y combos que la usan.
                  </Text>
                )}
                {unparsed.length > 0 && (
                  <Alert
                    kind="warning"
                    title="Hay información que no se pudo leer"
                  >
                    <div className="grid gap-2">
                      {unparsed.map((fragment, index) => (
                        <Text key={index}>{fragment}</Text>
                      ))}
                      <CheckboxField
                        label="He revisado estos fragmentos y añadido los ingredientes que corresponden."
                        isSelected={acknowledged}
                        onChange={setAcknowledged}
                        isDisabled={!!busy}
                      />
                    </div>
                  </Alert>
                )}
                {stockError && (
                  <Alert kind="error" title={stockError}>
                    <Button
                      variant="secondary"
                      onPress={() => {
                        setStockError(null);
                        setStockAttempt((value) => value + 1);
                      }}
                    >
                      Reintentar insumos
                    </Button>
                  </Alert>
                )}
                {!items && !stockError && (
                  <SkeletonScreen label="Cargando ingredientes">
                    <Skeleton className="block h-40 w-full" />
                  </SkeletonScreen>
                )}
                {items && (
                  <RecipeLines
                    lines={lines}
                    items={items}
                    busy={!!busy}
                    onChange={setLines}
                  />
                )}
              </>
            )}
            {validation && <Text variant="small">{validation}</Text>}
            <FormActions>
              <Button
                variant="secondary"
                isDisabled={!!busy}
                onPress={() => go(3)}
              >
                Atrás
              </Button>
              <Button
                type="submit"
                isDisabled={
                  !!busy || !!validation || !!reviewRequired || denied
                }
                isLoading={busy === "save"}
              >
                Confirmar receta
              </Button>
            </FormActions>
          </Form>
        )}
      </div>
    </StaffFormModal>
  );
}
