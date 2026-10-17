"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, EditPencil, Microphone, Plus, Trash } from "iconoir-react";
import {
  Alert,
  Button,
  CheckboxField,
  FileButton,
  Form,
  FormActions,
  Heading,
  Text,
  TextAreaField,
} from "../../../ui";
import { StaffFormModal } from "../../../app/backoffice/staff/staff-form-modal";
import { prepareDraftPhotos } from "../../../app/backoffice/draft-photos";
import {
  panelRequest,
  PanelRequestError,
} from "../../../app/backoffice/panel-request";
import type { ExpenseConcept, ExpenseContext, ExpenseDraft } from "../types";
import { ExpenseLineFields, ExpenseLocationField } from "./expense-line-fields";
import {
  blankExpense,
  confirmedLine,
  errorMessage,
  fromDraft,
  operationFor,
  type EditableExpense,
} from "./expenses-model";

type Method = "voice" | "photo" | "manual";

export function ExpensesInputModal({
  context: initialContext,
  initialLocation,
  onClose,
  onSaved,
}: {
  context: ExpenseContext;
  initialLocation: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [context, setContext] = useState(initialContext);
  const [method, setMethod] = useState<Method>("voice");
  const [location, setLocation] = useState(initialLocation);
  const [concepts, setConcepts] = useState<ExpenseConcept[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [lines, setLines] = useState<EditableExpense[]>(() => [
    blankExpense(context, initialLocation),
  ]);
  const [reviewing, setReviewing] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [unparsed, setUnparsed] = useState<string[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState<"analyze" | "save" | "currency" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [currencyConflict, setCurrencyConflict] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const lock = useRef(false);
  const mounted = useRef(false);
  const operation = useRef<ReturnType<typeof operationFor> | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    void panelRequest<{ concepts: ExpenseConcept[] }>(
      "/api/modules/expenses/concepts",
    )
      .then((data) => {
        if (active) {
          setConcepts(data.concepts);
          setLoadError(null);
        }
      })
      .catch((cause) => {
        if (active) setLoadError(errorMessage(cause));
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  const editing = reviewing || method === "manual";
  let validation = "";
  try {
    if (!concepts) throw new Error("Espera a que se carguen los conceptos.");
    if (!lines.length || lines.length > 30)
      throw new Error("Incluye entre 1 y 30 pagos.");
    for (const line of lines) confirmedLine(line, context, concepts);
    if (unparsed.length && !acknowledged)
      throw new Error("Revisa los fragmentos pendientes antes de confirmar.");
  } catch (cause) {
    validation = errorMessage(cause);
  }

  function close() {
    if (lock.current) return;
    setPhotos([]);
    onClose();
  }
  function patch(key: string, changes: Partial<EditableExpense>) {
    if (!lock.current)
      setLines((current) =>
        current.map((line) =>
          line.key === key ? { ...line, ...changes } : line,
        ),
      );
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
    if (
      lock.current ||
      !concepts ||
      !location ||
      (method === "photo" ? !photos.length : !text.trim())
    )
      return;
    lock.current = true;
    setBusy("analyze");
    setError(null);
    try {
      let result: { draft: ExpenseDraft };
      if (method === "photo") {
        const prepared = await prepareDraftPhotos(photos);
        const body = new FormData();
        for (const photo of prepared) body.append("photos", photo);
        body.append("locationId", location);
        result = await panelRequest(
          "/api/modules/expenses/entries/draft-photo",
          "POST",
          body,
        );
      } else {
        result = await panelRequest(
          "/api/modules/expenses/entries/draft",
          "POST",
          {
            text: text.trim(),
            locationId: location === "business" ? null : location,
          },
        );
      }
      if (!mounted.current) return;
      setLines(
        result.draft.lines.length
          ? result.draft.lines.map((line) => fromDraft(line, context, location))
          : [blankExpense(context, location)],
      );
      setUnparsed(result.draft.unparsed);
      setAcknowledged(false);
      setReviewing(true);
      setHasDraft(true);
    } catch (cause) {
      if (mounted.current) setError(errorMessage(cause));
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(null);
    }
  }
  async function save() {
    if (lock.current || validation || !concepts || currencyConflict) return;
    lock.current = true;
    setBusy("save");
    setError(null);
    try {
      const body = {
        expectedCurrencyCode: context.currencyCode,
        lines: lines.map((line) => confirmedLine(line, context, concepts)),
      };
      operation.current = operationFor(operation.current, body);
      await panelRequest("/api/modules/expenses/entries", "POST", {
        operationId: operation.current.id,
        ...body,
      });
      if (mounted.current) {
        setPhotos([]);
        setText("");
        onSaved();
      }
    } catch (cause) {
      if (mounted.current) {
        setError(errorMessage(cause));
        setCurrencyConflict(
          cause instanceof PanelRequestError &&
            cause.code === "currency_conflict",
        );
        if (
          cause instanceof PanelRequestError &&
          cause.code === "operation_conflict"
        )
          operation.current = null;
      }
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(null);
    }
  }
  async function updateCurrency() {
    if (lock.current) return;
    lock.current = true;
    setBusy("currency");
    try {
      const next = await panelRequest<ExpenseContext>(
        "/api/modules/expenses/context",
      );
      if (!mounted.current) return;
      setContext(next);
      setCurrencyConflict(false);
      setError(null);
      operation.current = null;
      setNotice(
        `La moneda actual es ${next.currencyCode}. Revisa los montos antes de confirmar; no se han convertido.`,
      );
    } catch (cause) {
      if (mounted.current) setError(errorMessage(cause));
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(null);
    }
  }

  return (
    <StaffFormModal
      open
      eyebrow="Gastos"
      title="Registrar gasto"
      description={
        editing
          ? "Revisa y corrige los pagos antes de confirmar."
          : "Ingresa tus pagos por audio, foto o a mano. Nada se registra hasta que confirmes."
      }
      onClose={close}
      dismissible={!busy}
    >
      <div className="grid gap-6">
        {!reviewing && (
          <div
            role="group"
            aria-label="Forma de ingresar los gastos"
            className="grid grid-cols-3 gap-2"
          >
            {[
              { id: "voice" as const, label: "Audio", icon: Microphone },
              { id: "photo" as const, label: "Foto", icon: Camera },
              { id: "manual" as const, label: "Manual", icon: EditPencil },
            ].map(({ id, label, icon: Icon }) => (
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
        {loadError && (
          <Alert kind="error" title={loadError}>
            <Button
              variant="secondary"
              onPress={() => {
                setLoadError(null);
                setAttempt((value) => value + 1);
              }}
            >
              Reintentar conceptos
            </Button>
          </Alert>
        )}
        {!concepts && !loadError && <Text>Cargando conceptos…</Text>}
        {error && <Alert kind="error" title={error} />}
        {notice && <Alert title={notice} />}
        {currencyConflict && (
          <Button
            variant="secondary"
            isDisabled={!!busy}
            onPress={() => void updateCurrency()}
          >
            Consultar moneda actual y revisar montos
          </Button>
        )}
        {!editing && (
          <Form
            onSubmit={(event) => {
              event.preventDefault();
              void analyze();
            }}
          >
            <ExpenseLocationField
              context={context}
              value={location}
              onChange={setLocation}
              isDisabled={!!busy}
              label="Local para estos pagos"
            />
            <Text variant="small">
              La fecha propuesta usa la zona de tu negocio: {context.timeZone}.
              Puedes corregirla después.
            </Text>
            {method === "photo" ? (
              <div className="grid gap-3">
                <Text>
                  Elige de 1 a 3 fotos. Se conservan en este borrador hasta
                  guardar o descartar.
                </Text>
                <Text variant="small">
                  Hasta 4 MB por foto y 4,4 MB en total después de prepararlas.
                </Text>
                <div className="flex flex-wrap gap-2">
                  <FileButton
                    accept="image/*"
                    multiple
                    inputLabel="Fotos de gastos desde galería"
                    isDisabled={!!busy}
                    onSelect={(files) => selectPhotos(files)}
                  >
                    {photos.length ? "Cambiar fotos" : "Elegir fotos"}
                  </FileButton>
                  <FileButton
                    accept="image/*"
                    camera
                    inputLabel="Foto de gasto desde cámara"
                    icon={<Camera />}
                    isDisabled={!!busy || photos.length >= 3}
                    onSelect={(files) => selectPhotos(files, true)}
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
                        if (!lock.current)
                          setPhotos((current) =>
                            current.filter((_, i) => i !== index),
                          );
                      }}
                    >
                      <Trash aria-hidden="true" className="size-5" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <TextAreaField
                label="Describe tus pagos"
                description="Usa el micrófono de tu teclado. Menciona qué pagaste y el monto. Si no dices la fecha, se propone hoy en tu negocio."
                placeholder="Pagué alquiler 900, agua 20 y el sueldo de Luis 450."
                value={text}
                maxLength={2000}
                onChange={setText}
                isDisabled={!!busy}
              />
            )}
            {busy === "analyze" && (
              <div role="status">
                <Text>
                  Estamos preparando tu borrador. Puede tardar hasta 45
                  segundos.
                </Text>
              </div>
            )}
            {hasDraft && (
              <Button
                variant="quiet"
                isDisabled={!!busy}
                onPress={() => setReviewing(true)}
              >
                Volver al borrador sin reanalizar
              </Button>
            )}
            <FormActions>
              <Button variant="secondary" onPress={close} isDisabled={!!busy}>
                Descartar
              </Button>
              <Button
                type="submit"
                isLoading={busy === "analyze"}
                isDisabled={
                  !!busy ||
                  !concepts ||
                  !location ||
                  (method === "photo" ? !photos.length : !text.trim())
                }
              >
                Analizar
              </Button>
            </FormActions>
            {error && (
              <Button
                variant="quiet"
                isDisabled={!!busy}
                onPress={() => {
                  setMethod("manual");
                  setError(null);
                }}
              >
                Cargar a mano
              </Button>
            )}
          </Form>
        )}
        {editing && (
          <Form
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            {unparsed.length > 0 && (
              <Alert
                kind="warning"
                title="Hay información pendiente de revisión"
              >
                <div className="grid gap-2">
                  {unparsed.map((fragment, index) => (
                    <Text key={index}>{fragment}</Text>
                  ))}
                  <CheckboxField
                    label="He revisado estos fragmentos y añadido los pagos que quiero registrar."
                    isSelected={acknowledged}
                    onChange={setAcknowledged}
                    isDisabled={!!busy}
                  />
                </div>
              </Alert>
            )}
            {lines.map((line, index) => (
              <section
                key={line.key}
                aria-label={`Pago ${index + 1}`}
                className="grid gap-4 border-b border-border pb-6"
              >
                <div className="flex items-center justify-between gap-3">
                  <Heading level={3}>Pago {index + 1}</Heading>
                  <Button
                    variant="quiet"
                    aria-label={`Quitar pago ${index + 1}`}
                    isDisabled={!!busy || lines.length === 1}
                    onPress={() => {
                      if (!lock.current)
                        setLines((current) =>
                          current.filter((entry) => entry.key !== line.key),
                        );
                    }}
                  >
                    <Trash aria-hidden="true" className="size-5" />
                  </Button>
                </div>
                <ExpenseLineFields
                  line={line}
                  context={context}
                  concepts={concepts ?? []}
                  patch={(changes) => patch(line.key, changes)}
                  isDisabled={!!busy}
                />
              </section>
            ))}
            <Button
              variant="secondary"
              isDisabled={!!busy || lines.length >= 30}
              onPress={() => {
                if (!lock.current)
                  setLines((current) => [
                    ...current,
                    blankExpense(context, location),
                  ]);
              }}
            >
              <Plus aria-hidden="true" className="size-5" />
              Añadir pago
            </Button>
            {reviewing && (
              <Button
                variant="quiet"
                isDisabled={!!busy}
                onPress={() => {
                  setReviewing(false);
                  setError(null);
                }}
              >
                {method === "photo" ? "Volver a las fotos" : "Volver al texto"}
              </Button>
            )}
            {validation && <Text variant="small">{validation}</Text>}
            <FormActions>
              <Button variant="secondary" onPress={close} isDisabled={!!busy}>
                Descartar
              </Button>
              <Button
                type="submit"
                isLoading={busy === "save"}
                isDisabled={!!busy || !!validation || currencyConflict}
              >
                Confirmar{" "}
                {lines.length === 1 ? "pago" : `${lines.length} pagos`}
              </Button>
            </FormActions>
          </Form>
        )}
      </div>
    </StaffFormModal>
  );
}
