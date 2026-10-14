"use client";

import { useEffect, useRef, useState } from "react";
import {
  Camera,
  EditPencil,
  Microphone,
  Plus,
  Spark,
  Trash,
} from "iconoir-react";
import {
  Alert,
  Button,
  CheckboxField,
  FileButton,
  Form,
  FormActions,
  Heading,
  SelectField,
  Text,
  TextAreaField,
  TextField,
} from "../../../ui";
import { StaffFormModal } from "../../../app/backoffice/staff/staff-form-modal";
import { requestPhotoDraft } from "../../../app/backoffice/draft-photos";
import { panelRequest } from "../../../app/backoffice/panel-request";
import {
  baseUnit,
  blankLine,
  countedQuantity,
  entryLines,
  editableAmount,
  units,
  type EntryUnit,
  type StockDraft,
  type StockItem,
  type StockLine,
} from "./stock-types";

type Method = "voice" | "photo" | "text";
const message = (cause: unknown) =>
  cause instanceof Error
    ? cause.message
    : "No pudimos completar la acción. Intenta otra vez.";

export function StockInputModal({
  kind,
  locationId,
  onClose,
  onSaved,
}: {
  kind: "new" | "adjustment";
  locationId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const adjusting = kind === "adjustment";
  const [method, setMethod] = useState<Method>(adjusting ? "text" : "voice");
  const [items, setItems] = useState<StockItem[] | null>(null);
  const [itemError, setItemError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [lines, setLines] = useState<StockLine[]>([blankLine("first")]);
  const [draftLines, setDraftLines] = useState<StockLine[]>([]);
  const [transcript, setTranscript] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [reviewing, setReviewing] = useState(false);
  const [unparsed, setUnparsed] = useState<string[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState<"analyze" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
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
    void panelRequest<{ items: StockItem[] }>(
      `/api/modules/stock/items?locationId=${encodeURIComponent(locationId)}`,
    )
      .then((data) => {
        if (active)
          setItems(data.items.filter((item) => item.status === "active"));
      })
      .catch((cause) => {
        if (active) setItemError(message(cause));
      });
    return () => {
      active = false;
    };
  }, [attempt, locationId]);
  const visibleLines = reviewing ? draftLines : lines;
  const updateLines = reviewing ? setDraftLines : setLines;
  function patch(key: string, patch: Partial<StockLine>) {
    updateLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }
  function selectItem(key: string, id: string) {
    const item = items?.find((item) => item.id === id);
    patch(key, {
      itemId: item?.id ?? null,
      name: item?.name ?? "",
      unit: item?.unit ?? "unit",
    });
  }
  let validation = "";
  try {
    if (!items) throw new Error("Espera a que se carguen los insumos.");
    if (adjusting) {
      const line = lines[0];
      const item = items.find((item) => item.id === line.itemId);
      if (!item) throw new Error("Selecciona un insumo existente.");
      if (item.unit !== baseUnit(line.unit))
        throw new Error("Revisa la unidad del insumo.");
      countedQuantity(line.quantity, line.unit);
    } else entryLines(visibleLines, items);
    if (reviewing && unparsed.length && !acknowledged)
      throw new Error("Revisa los fragmentos pendientes antes de guardar.");
  } catch (cause) {
    validation = message(cause);
  }

  function close() {
    if (!lock.current) onClose();
  }
  function selectPhotos(selected: File[], append = false) {
    if (lock.current) return;
    const next = append ? [...photos, ...selected] : selected;
    if (next.length > 3) {
      setError("Elige entre 1 y 3 fotos. Quita una antes de añadir otra.");
      return;
    }
    setPhotos(next);
    setError(null);
  }
  async function analyze() {
    const text = transcript.trim();
    if (
      lock.current ||
      !items ||
      (method === "photo" ? !photos.length : !text || text.length > 2000)
    )
      return;
    lock.current = true;
    setBusy("analyze");
    setError(null);
    try {
      const result =
        method === "photo"
          ? await requestPhotoDraft<{ draft: StockDraft }>(
              "/api/modules/stock/entries/draft-photo",
              photos,
            )
          : await panelRequest<{ draft: StockDraft }>(
              "/api/modules/stock/entries/draft",
              "POST",
              { text },
            );
      if (!mounted.current) return;
      setDraftLines(
        result.draft.lines.length
          ? result.draft.lines.map((line) => ({
              key: crypto.randomUUID(),
              itemId: line.itemId,
              name: line.name,
              quantity: editableAmount(line.quantity),
              unit: line.unit,
              totalCost: editableAmount(line.totalCost),
              sourceText: line.sourceText,
            }))
          : [blankLine(crypto.randomUUID())],
      );
      setUnparsed(result.draft.unparsed);
      setAcknowledged(false);
      setReviewing(true);
    } catch (cause) {
      if (mounted.current) setError(message(cause));
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(null);
    }
  }
  async function save() {
    if (lock.current || validation || !items) return;
    lock.current = true;
    setBusy("save");
    setError(null);
    try {
      if (adjusting) {
        const line = lines[0];
        await panelRequest(
          `/api/modules/stock/items/${encodeURIComponent(line.itemId!)}/adjustments`,
          "POST",
          {
            locationId,
            countedQuantity: countedQuantity(line.quantity, line.unit),
          },
        );
      } else {
        await panelRequest("/api/modules/stock/entries", "POST", {
          locationId,
          lines: entryLines(visibleLines, items),
        });
      }
      if (mounted.current) onSaved();
    } catch (cause) {
      if (mounted.current) setError(message(cause));
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(null);
    }
  }
  const options = adjusting
    ? []
    : [
        { id: "voice" as const, label: "Audio", icon: Microphone },
        { id: "photo" as const, label: "Foto", icon: Camera },
        { id: "text" as const, label: "Manual", icon: EditPencil },
      ];

  return (
    <StaffFormModal
      open
      eyebrow="Registro de stock"
      title={adjusting ? "Ajustar stock" : "Nuevo stock"}
      description={
        adjusting
          ? "Indica cuánto tienes ahora. El ajuste se calcula a partir del conteo."
          : reviewing
            ? "Revisa los ítems, corrige lo que necesites y guarda o descarta la compra."
            : "Ingresa tu compra por audio, foto o a mano. El precio es opcional."
      }
      onClose={close}
      dismissible={!busy}
    >
      <div className="grid gap-6">
        {!adjusting && !reviewing && (
          <div
            role="group"
            aria-label="Forma de ingresar el stock"
            className="grid grid-cols-3 gap-2"
          >
            {options.map(({ id, label, icon: Icon }) => (
              <Button
                key={id}
                variant={method === id ? "primary" : "secondary"}
                aria-pressed={method === id}
                isDisabled={!!busy}
                onPress={() => {
                  if (!lock.current) {
                    setMethod(id);
                    setError(null);
                  }
                }}
              >
                <Icon aria-hidden="true" className="size-5" />
                {label}
              </Button>
            ))}
          </div>
        )}
        {itemError && (
          <Alert kind="error" title={itemError}>
            <Button
              variant="secondary"
              onPress={() => {
                setItemError(null);
                setAttempt((value) => value + 1);
              }}
            >
              Reintentar insumos
            </Button>
          </Alert>
        )}
        {!items && !itemError && <Text>Cargando insumos…</Text>}
        {error && <Alert kind="error" title={error} />}
        {!adjusting && !reviewing && method !== "text" && (
          <Form
            onSubmit={(event) => {
              event.preventDefault();
              void analyze();
            }}
          >
            <div className="flex items-start gap-3 rounded-lg bg-primary-soft p-4">
              <Spark
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-primary"
              />
              <Text>
                La IA prepara un borrador. Nada se registra hasta que lo revises
                y guardes.
              </Text>
            </div>
            {method === "photo" ? (
              <div className="grid gap-3">
                <Text>Elige de 1 a 3 fotos de tu compra o comprobante.</Text>
                <Text variant="small">
                  Preparamos las fotos antes de enviarlas: hasta 4 MB por foto y
                  4,4 MB en total.
                </Text>
                <div className="flex flex-wrap gap-2">
                  <FileButton
                    accept="image/*"
                    multiple
                    inputLabel="Fotos de stock desde galería"
                    isDisabled={!!busy}
                    onSelect={(files) => selectPhotos(files)}
                  >
                    {photos.length ? "Cambiar fotos" : "Elegir fotos"}
                  </FileButton>
                  <FileButton
                    accept="image/*"
                    camera
                    inputLabel="Foto de stock desde cámara"
                    isDisabled={!!busy || photos.length >= 3}
                    onSelect={(files) => selectPhotos(files, true)}
                    icon={<Camera />}
                  >
                    Tomar foto
                  </FileButton>
                </div>
                {photos.map((photo, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between gap-3"
                  >
                    <Text className="min-w-0 break-all">
                      {index + 1}. {photo.name}
                    </Text>
                    <Button
                      variant="quiet"
                      aria-label={`Quitar foto ${index + 1}`}
                      isDisabled={!!busy}
                      onPress={() => {
                        if (lock.current) return;
                        setPhotos((current) =>
                          current.filter((_, i) => i !== index),
                        );
                        setError(null);
                      }}
                    >
                      <Trash aria-hidden="true" className="size-5" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <TextAreaField
                  label="Describe tu compra"
                  description="Usa el micrófono en tu teclado. Menciona el nombre, la cantidad y, si lo tienes, el precio total de cada ítem. La transcripción aparecerá aquí."
                  placeholder="Hoy compré 1 kg de harina por 25, un cartón de 30 huevos por 4 y 2 kg de tomates por 7."
                  value={transcript}
                  onChange={setTranscript}
                  maxLength={2000}
                  isDisabled={!!busy}
                />
                <Text variant="small">
                  {transcript.length} / 2000 caracteres. Puedes corregir el
                  texto antes de analizar.
                </Text>
              </>
            )}
            {busy === "analyze" && (
              <div role="status">
                <Text>
                  Estamos preparando tu borrador. Puede tardar hasta 45
                  segundos.
                </Text>
              </div>
            )}
            <FormActions>
              <Button variant="secondary" onPress={close} isDisabled={!!busy}>
                Descartar
              </Button>
              <Button
                type="submit"
                isLoading={busy === "analyze"}
                isDisabled={
                  !items ||
                  (method === "photo"
                    ? !photos.length
                    : !transcript.trim() || transcript.trim().length > 2000) ||
                  !!busy
                }
              >
                Analizar
              </Button>
            </FormActions>
            {error && (
              <div>
                <Button
                  variant="quiet"
                  isDisabled={!!busy}
                  onPress={() => {
                    if (!lock.current) {
                      setMethod("text");
                      setError(null);
                    }
                  }}
                >
                  Cargar a mano
                </Button>
              </div>
            )}
          </Form>
        )}
        {(adjusting || reviewing || method === "text") && (
          <Form
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            {reviewing && (
              <div className="grid gap-2">
                <Heading level={2}>Revisa los ítems</Heading>
                <Text variant="muted">
                  El precio indicado es el total de cada línea. Puedes dejarlo
                  vacío si no lo conoces.
                </Text>
              </div>
            )}
            {reviewing && unparsed.length > 0 && (
              <Alert kind="warning" title="Hay información que no se pudo leer">
                <div className="grid gap-2">
                  {unparsed.map((text, index) => (
                    <Text key={index}>{text}</Text>
                  ))}
                  <CheckboxField
                    label="He revisado estos fragmentos y añadido los ítems que quiero registrar."
                    isSelected={acknowledged}
                    onChange={setAcknowledged}
                    isDisabled={!!busy}
                  />
                </div>
              </Alert>
            )}
            {adjusting && items?.length === 0 && (
              <Text variant="muted">
                No tienes insumos activos. Registra una compra primero para
                poder hacer un conteo.
              </Text>
            )}
            <div className="grid gap-4">
              {visibleLines.map((line, index) => {
                const existing = items?.find((item) => item.id === line.itemId);
                const unitOptions = units.filter(
                  (unit) =>
                    !existing ||
                    baseUnit(unit.id as EntryUnit) === existing.unit,
                );
                return (
                  <div
                    key={line.key}
                    className="grid gap-3 border-b border-border pb-4"
                  >
                    {!adjusting && (
                      <div className="flex items-center justify-between gap-3">
                        <Text variant="label">
                          Ítem {index + 1}
                          {!line.itemId && line.name.trim()
                            ? " · Insumo nuevo"
                            : ""}
                        </Text>
                        <Button
                          variant="quiet"
                          aria-label={`Quitar ítem ${index + 1}`}
                          isDisabled={!!busy || visibleLines.length <= 1}
                          onPress={() =>
                            updateLines((current) =>
                              current.filter((entry) => entry.key !== line.key),
                            )
                          }
                        >
                          <Trash aria-hidden="true" className="size-5" />
                        </Button>
                      </div>
                    )}
                    <SelectField
                      label="Insumo"
                      options={[
                        ...(!adjusting
                          ? [{ id: "new", label: "Crear insumo nuevo" }]
                          : []),
                        ...(items ?? []).map((item) => ({
                          id: item.id,
                          label: item.name,
                        })),
                      ]}
                      selectedKey={line.itemId ?? (adjusting ? null : "new")}
                      onSelectionChange={(id) => {
                        if (id !== null) selectItem(line.key, String(id));
                      }}
                      isDisabled={!!busy || !items}
                    />
                    {!line.itemId && !adjusting && (
                      <TextField
                        label="Nombre del insumo nuevo"
                        placeholder="Harina"
                        value={line.name}
                        onChange={(name) => patch(line.key, { name })}
                        maxLength={80}
                        isDisabled={!!busy}
                      />
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <TextField
                        label={adjusting ? "Cantidad contada" : "Cantidad"}
                        placeholder={adjusting ? "0" : "1"}
                        inputMode="decimal"
                        value={line.quantity}
                        onChange={(quantity) => patch(line.key, { quantity })}
                        isDisabled={!!busy}
                      />
                      <SelectField
                        label="Unidad"
                        options={unitOptions}
                        selectedKey={line.unit}
                        onSelectionChange={(unit) => {
                          if (unit !== null)
                            patch(line.key, { unit: unit as EntryUnit });
                        }}
                        isDisabled={!!busy}
                      />
                    </div>
                    {!adjusting && (
                      <TextField
                        label="Precio total (opcional)"
                        description="Total pagado por la cantidad de esta línea, no por unidad."
                        placeholder="Sin precio"
                        inputMode="decimal"
                        value={line.totalCost}
                        onChange={(totalCost) => patch(line.key, { totalCost })}
                        isDisabled={!!busy}
                      />
                    )}
                    {reviewing && line.sourceText && (
                      <Text variant="small">
                        Texto original: {line.sourceText}
                      </Text>
                    )}
                  </div>
                );
              })}
            </div>
            {!adjusting && (
              <div>
                <Button
                  variant="secondary"
                  isDisabled={!!busy || visibleLines.length >= 30}
                  onPress={() =>
                    updateLines((current) => [
                      ...current,
                      blankLine(crypto.randomUUID()),
                    ])
                  }
                >
                  <Plus aria-hidden="true" className="size-5" />
                  Añadir ítem
                </Button>
              </div>
            )}
            {reviewing && (
              <div>
                <Button
                  variant="quiet"
                  isDisabled={!!busy}
                  onPress={() => {
                    setReviewing(false);
                    setError(null);
                  }}
                >
                  {method === "photo"
                    ? "Volver a las fotos"
                    : "Volver al texto"}
                </Button>
              </div>
            )}
            {validation && <Text variant="small">{validation}</Text>}
            <FormActions>
              <Button variant="secondary" isDisabled={!!busy} onPress={close}>
                Descartar
              </Button>
              <Button
                type="submit"
                isLoading={busy === "save"}
                isDisabled={!!busy || !!validation}
              >
                {adjusting ? "Guardar conteo" : "Guardar compra"}
              </Button>
            </FormActions>
          </Form>
        )}
      </div>
    </StaffFormModal>
  );
}
