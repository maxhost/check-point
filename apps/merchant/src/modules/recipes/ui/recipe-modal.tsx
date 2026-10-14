"use client";

import { useEffect, useRef, useState } from "react";
import { Spark } from "iconoir-react";
import {
  Alert,
  Button,
  CheckboxField,
  Form,
  FileButton,
  FormActions,
  Text,
  TextAreaField,
  TextField,
} from "../../../ui";
import { Skeleton, SkeletonScreen } from "../../../app/components/ui";
import { StaffFormModal } from "../../../app/backoffice/staff/staff-form-modal";
import { requestPhotoDraft } from "../../../app/backoffice/draft-photos";
import { panelRequest } from "../../../app/backoffice/panel-request";
import {
  editableAmount,
  formatAmount,
  type StockItem,
} from "../../stock/ui/stock-types";
import { RecipeLines } from "./recipe-lines";
import {
  blankIngredient,
  draftIngredients,
  recipeError,
  recipePayload,
  recipeUrl,
  type RecipeDetail,
  type RecipeDraft,
  type RecipeLine,
  type RecipeSummary,
} from "./recipe-types";

export function RecipeModal({
  products,
  initialProduct,
  onClose,
  onSaved,
}: {
  products: RecipeSummary[];
  initialProduct: RecipeSummary | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [product, setProduct] = useState(initialProduct);
  const [search, setSearch] = useState("");
  const [operating, setOperating] = useState(false);
  const operatingLock = useRef(false);
  function close() {
    if (!operatingLock.current) onClose();
  }
  function changeBusy(value: boolean) {
    operatingLock.current = value;
    setOperating(value);
  }
  return (
    <StaffFormModal
      open
      eyebrow="Recetas"
      title={product ? product.productName : "Nueva receta"}
      description={
        product
          ? "Define los ingredientes necesarios para una unidad de este producto."
          : "Busca el producto del catálogo al que pertenece la receta."
      }
      onClose={close}
      dismissible={!operating}
    >
      {product ? (
        <RecipeEditor
          key={product.productId}
          product={product}
          onClose={close}
          onSaved={onSaved}
          onBusyChange={changeBusy}
        />
      ) : (
        <div className="grid gap-4">
          <TextField
            label="Buscar producto"
            placeholder="Nombre del producto"
            value={search}
            onChange={setSearch}
          />
          <div className="grid max-h-80 gap-2 overflow-y-auto">
            {products
              .filter(
                (entry) =>
                  entry.lineCount === 0 &&
                  entry.productName
                    .toLocaleLowerCase()
                    .includes(search.trim().toLocaleLowerCase()),
              )
              .map((entry) => (
                <Button
                  key={entry.productId}
                  variant="secondary"
                  onPress={() => setProduct(entry)}
                  className="justify-start"
                >
                  {entry.productName}
                </Button>
              ))}
          </div>
          {!products.some(
            (entry) =>
              entry.lineCount === 0 &&
              entry.productName
                .toLocaleLowerCase()
                .includes(search.trim().toLocaleLowerCase()),
          ) && (
            <Text variant="muted">
              No hay productos sin receta que coincidan. Puedes editar las
              recetas existentes desde la lista.
            </Text>
          )}
          <FormActions>
            <Button variant="secondary" onPress={onClose}>
              Cancelar
            </Button>
          </FormActions>
        </div>
      )}
    </StaffFormModal>
  );
}

function RecipeEditor({
  product,
  onClose,
  onSaved,
  onBusyChange,
}: {
  product: RecipeSummary;
  onClose: () => void;
  onSaved: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [items, setItems] = useState<StockItem[] | null>(null);
  const [retainedIds, setRetainedIds] = useState<string[]>([]);
  const [existingRecipe, setExistingRecipe] = useState(false);
  const [lines, setLines] = useState<RecipeLine[]>([]);
  const [stage, setStage] = useState<"dictate" | "review">("dictate");
  const [text, setText] = useState("");
  const [source, setSource] = useState<"text" | "photo">("text");
  const [photos, setPhotos] = useState<File[]>([]);
  const [yieldCount, setYieldCount] = useState(1);
  const [unparsed, setUnparsed] = useState<string[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState<"analyze" | "save" | null>(null);
  const lock = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    void Promise.all([
      panelRequest<{ items: StockItem[] }>(
        "/api/modules/stock/items?status=all",
      ),
      panelRequest<{ recipe: RecipeDetail }>(recipeUrl(product.productId)),
    ])
      .then(([stock, detail]) => {
        if (!active) return;
        setItems(stock.items);
        setRetainedIds(detail.recipe.lines.map((line) => line.itemId));
        setExistingRecipe(detail.recipe.lines.length > 0);
        setLines(
          detail.recipe.lines.map((line, index) => ({
            key: `existing-${index}`,
            itemId: line.itemId,
            name: line.itemName,
            quantity: editableAmount(line.quantity),
            unit: line.unit,
          })),
        );
        setStage(detail.recipe.lines.length ? "review" : "dictate");
      })
      .catch((cause) => {
        if (active) setLoadError(recipeError(cause));
      });
    return () => {
      active = false;
    };
  }, [product.productId, attempt]);
  let validation = "";
  try {
    if (!items) throw new Error("Espera a que se carguen los insumos.");
    recipePayload(lines, items, retainedIds, existingRecipe);
    if (unparsed.length && !acknowledged)
      throw new Error("Revisa los fragmentos pendientes antes de guardar.");
  } catch (cause) {
    validation = recipeError(cause);
  }
  async function analyze() {
    if (
      lock.current ||
      !items ||
      (source === "photo"
        ? !photos.length
        : !text.trim() || text.trim().length > 2000)
    )
      return;
    lock.current = true;
    onBusyChange(true);
    setBusy("analyze");
    setError(null);
    try {
      const { draft } =
        source === "photo"
          ? await requestPhotoDraft<{ draft: RecipeDraft }>(
              `${recipeUrl(product.productId)}/draft-photo`,
              photos,
            )
          : await panelRequest<{ draft: RecipeDraft }>(
              `${recipeUrl(product.productId)}/draft`,
              "POST",
              { text: text.trim() },
            );
      if (!mounted.current) return;
      setLines(
        draft.lines.length
          ? draftIngredients(draft)
          : [blankIngredient(crypto.randomUUID())],
      );
      setYieldCount(draft.yield);
      setUnparsed(draft.unparsed);
      setAcknowledged(false);
      setStage("review");
    } catch (cause) {
      if (mounted.current) setError(recipeError(cause));
    } finally {
      lock.current = false;
      if (mounted.current) {
        setBusy(null);
        onBusyChange(false);
      }
    }
  }
  async function save() {
    if (lock.current || validation || !items) return;
    lock.current = true;
    onBusyChange(true);
    setBusy("save");
    setError(null);
    try {
      await panelRequest(recipeUrl(product.productId), "PUT", {
        lines: recipePayload(lines, items, retainedIds, existingRecipe),
      });
      if (mounted.current) onSaved();
    } catch (cause) {
      if (mounted.current) setError(recipeError(cause));
    } finally {
      lock.current = false;
      if (mounted.current) {
        setBusy(null);
        onBusyChange(false);
      }
    }
  }
  return (
    <div className="grid gap-6">
      {loadError && (
        <Alert kind="error" title={loadError}>
          <Button
            variant="secondary"
            onPress={() => {
              setLoadError(null);
              setAttempt((value) => value + 1);
            }}
          >
            Reintentar
          </Button>
        </Alert>
      )}
      {!items && !loadError && (
        <SkeletonScreen label="Cargando ingredientes" className="grid gap-3">
          <Skeleton className="block h-12 w-full" />
          <Skeleton className="block h-40 w-full" />
        </SkeletonScreen>
      )}
      {error && <Alert kind="error" title={error} />}
      {items && stage === "dictate" && (
        <Form
          onSubmit={(event) => {
            event.preventDefault();
            void analyze();
          }}
        >
          <div className="flex items-start gap-3 rounded-lg bg-primary-soft p-4">
            <Spark
              aria-hidden="true"
              className="size-5 shrink-0 text-primary"
            />
            <Text>
              La IA prepara un borrador. Revisa los ingredientes antes de
              guardar la receta.
            </Text>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={source === "text" ? "primary" : "secondary"}
              aria-pressed={source === "text"}
              isDisabled={!!busy}
              onPress={() => {
                setSource("text");
                setError(null);
              }}
            >
              Dictado
            </Button>
            <Button
              variant={source === "photo" ? "primary" : "secondary"}
              aria-pressed={source === "photo"}
              isDisabled={!!busy}
              onPress={() => {
                setSource("photo");
                setError(null);
              }}
            >
              Foto
            </Button>
          </div>
          {source === "photo" ? (
            <div className="grid gap-3">
              <Text variant="muted">
                Elige entre 1 y 3 fotos de la receta de {product.productName}.
                Puedes usar la cámara o elegirlas de tu galería.
              </Text>
              <div className="flex flex-wrap gap-2">
                <FileButton
                  accept="image/*"
                  multiple
                  inputLabel="Fotos de la receta"
                  isDisabled={!!busy}
                  onSelect={(files) => {
                    if (lock.current) return;
                    if (files.length > 3) {
                      setError("Elige entre 1 y 3 fotos.");
                      return;
                    }
                    setPhotos(files);
                    setError(null);
                  }}
                >
                  {photos.length ? "Cambiar fotos" : "Elegir fotos"}
                </FileButton>
                <FileButton
                  accept="image/*"
                  camera
                  inputLabel="Cámara para receta"
                  isDisabled={!!busy}
                  onSelect={(files) => {
                    if (lock.current) return;
                    if (photos.length + files.length > 3) {
                      setError(
                        "Puedes añadir hasta 3 fotos. Quita una antes de tomar otra.",
                      );
                      return;
                    }
                    setPhotos((previous) => [...previous, ...files]);
                    setError(null);
                  }}
                >
                  Tomar foto
                </FileButton>
              </div>
              {photos.map((file, index) => (
                <div key={index} className="flex min-w-0 items-center gap-2">
                  <Text className="min-w-0 flex-1 break-words">
                    {file.name}
                  </Text>
                  <Button
                    variant="quiet"
                    aria-label={`Quitar foto ${index + 1}`}
                    isDisabled={!!busy}
                    onPress={() => {
                      setPhotos((previous) =>
                        previous.filter((_, entry) => entry !== index),
                      );
                      setError(null);
                    }}
                  >
                    Quitar
                  </Button>
                </div>
              ))}
              <Text variant="small">
                Máximo 4 MiB por foto y 4,4 MiB en total después de preparar las
                imágenes.
              </Text>
            </div>
          ) : (
            <>
              <TextAreaField
                label="Describe tu receta"
                description="Usa el micrófono en tu teclado. Menciona los ingredientes, sus cantidades y cuántas unidades del producto salen. La transcripción aparecerá aquí."
                placeholder="Para 10 pizzas uso 1 kg de harina, 600 ml de agua, 20 g de sal y 10 g de levadura."
                value={text}
                onChange={setText}
                maxLength={2000}
                isDisabled={!!busy}
              />
              <Text variant="small">
                {text.length} / 2000 caracteres. Puedes corregir el texto antes
                de analizar.
              </Text>
            </>
          )}
          {busy === "analyze" && (
            <div role="status">
              <Text>
                Analizando {source === "photo" ? "las fotos" : "el texto"}…
                Puede tardar hasta 45 segundos.
              </Text>
            </div>
          )}
          {existingRecipe && (
            <Text variant="small">
              El borrador analizado reemplazará los ingredientes actuales al
              guardar.
            </Text>
          )}
          <FormActions>
            <Button variant="secondary" onPress={onClose} isDisabled={!!busy}>
              Descartar
            </Button>
            <Button
              type="submit"
              isLoading={busy === "analyze"}
              isDisabled={
                !!busy || (source === "photo" ? !photos.length : !text.trim())
              }
            >
              Analizar
            </Button>
          </FormActions>
          <div>
            <Button
              variant="quiet"
              isDisabled={!!busy}
              onPress={() => {
                if (!lines.length)
                  setLines([blankIngredient(crypto.randomUUID())]);
                setStage("review");
                setError(null);
              }}
            >
              {" "}
              {lines.length ? "Volver a los ingredientes" : "Cargar a mano"}
            </Button>
          </div>
        </Form>
      )}
      {items && stage === "review" && (
        <Form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <Text variant="label">Revisa los ingredientes</Text>
          <Text variant="muted">
            Las cantidades corresponden a una unidad de {product.productName}.
            {yieldCount > 1
              ? ` Se dividieron las cantidades de la tanda entre ${formatAmount(yieldCount)}.`
              : ""}{" "}
            Completa las cantidades que hayan quedado vacías.
          </Text>
          {unparsed.length > 0 && (
            <Alert kind="warning" title="Hay información que no se pudo leer">
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
          <RecipeLines
            lines={lines}
            items={items}
            onChange={setLines}
            busy={!!busy}
          />
          {existingRecipe && !lines.length && (
            <Alert
              kind="warning"
              title="Al guardar se eliminará la receta de este producto."
            />
          )}
          <div>
            <Button
              variant="quiet"
              isDisabled={!!busy}
              onPress={() => {
                setStage("dictate");
                setError(null);
              }}
            >
              Volver al dictado o las fotos
            </Button>
          </div>
          {validation && <Text variant="small">{validation}</Text>}
          <FormActions>
            <Button variant="secondary" onPress={onClose} isDisabled={!!busy}>
              Descartar
            </Button>
            <Button
              type="submit"
              isLoading={busy === "save"}
              isDisabled={!!busy || !!validation}
            >
              Guardar receta
            </Button>
          </FormActions>
        </Form>
      )}
    </div>
  );
}
