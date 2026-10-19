"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { EditPencil } from "iconoir-react";
import {
  Alert,
  Button,
  Card,
  Dialog,
  FormActions,
  Heading,
  SelectField,
  Text,
  TextAreaField,
  TextField,
} from "../../../ui";
import type { PosCatalogProductV2, PosOrderV2, SaleType } from "../contracts";
import { MeasuredCart } from "./measured-cart";
import { measuredMoney } from "./measured-money";
import { measuredPaymentPreview } from "./measured-payment-preview";
import { MeasuredEditorCustomer } from "./measured-editor-customer";
import {
  appendCartLine,
  newCartLine,
  quantityEditor,
  resolvedCartLine,
  serializeMeasuredCart,
  type QuantityEditor,
} from "./measured-cart-model";
import { MeasuredQuantityDialog } from "./measured-quantity-dialog";
import {
  MeasuredEditorSession,
  measuredEditorAmounts,
} from "./measured-editor-model";
import { MeasuredProductCatalog } from "./measured-product-catalog";
import { PosTablePicker, tableUnavailable, usePosTables } from "./pos-tables";
import { PosError } from "./pos-types";

const labels: Record<SaleType, string> = {
  table: "Mesa",
  pickup: "Para retirar",
  delivery: "Delivery",
  counter: "Mostrador",
  legacy: "Pedido existente",
};
export type MeasuredPosEditorProps = {
  /** Parent retains session across remounts; requestExit gates selection changes. */
  session: MeasuredEditorSession;
  onExit: () => void;
  onSaved: (order: PosOrderV2) => void;
  onPrepare: (order: PosOrderV2) => void;
  onAccessError?: (error: unknown) => void;
};
export function MeasuredPosEditor({
  session,
  onExit,
  onSaved,
  onPrepare,
  onAccessError,
}: MeasuredPosEditorProps) {
  useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const live = useRef<MeasuredEditorSession | null>(session);
  live.current = session;
  useEffect(() => {
    live.current = session;
    return () => {
      session.customer.cancel();
      if (live.current === session) live.current = null;
    };
  }, [session]);
  const { draft, context, catalog } = session;
  const [detailsEditor, setDetailsEditor] = useState<
    "order" | "location" | null
  >(null);
  const [view, setView] = useState<"catalog" | "order">("catalog");
  const [exitOpen, setExitOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [locationChange, setLocationChange] = useState<string | null>(null);
  const [pending, setPending] = useState<{
    product: PosCatalogProductV2;
    editor: QuantityEditor;
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const state = session.commands.getSnapshot();
  const blocked = session.blocked;
  const units = catalog?.salesMassUnits ?? [];
  const tableError = useCallback(
    (cause: unknown) => {
      session.retireIdentity();
      onAccessError?.(cause);
    },
    [session, onAccessError],
  );
  const tables = usePosTables(
    draft.locationId,
    0,
    tableError,
    context.tablesEnabled && draft.saleType === "table",
    { client: session.client, cache: session.cache },
  );
  const unavailable =
    (context.tablesEnabled &&
      draft.saleType === "table" &&
      (tables.tables === null || (!!tables.tables.length && !draft.tableId))) ||
    tableUnavailable(tables.tables, draft.tableId, session.order?.id);
  useEffect(() => {
    void session.loadCatalog();
  }, [session, draft.locationId]);
  let total: string | undefined;
  let lineAmounts: Record<string, string> | undefined;
  try {
    const amounts = measuredEditorAmounts(
      draft.lines,
      units,
      context.currencyCode,
    );
    total = amounts.total;
    lineAmounts = amounts.lineAmounts;
  } catch {
    /* Partial captures remain visible. */
  }
  const validation = session.validation();
  let benefitPreview: ReturnType<typeof measuredPaymentPreview> | null = null;
  if (session.customer.state.resolved && draft.lines.length) {
    try {
      benefitPreview = measuredPaymentPreview(
        {
          status: "open",
          business: { name: "", currencyCode: context.currencyCode },
          items: draft.lines.map((line) => ({
            ...resolvedCartLine(line, units),
            lineId: line.key,
          })),
        },
        session.customer.state.resolved,
        null,
        session.customer.state.excluded,
      );
    } catch {
      /* Keep incomplete quantities visible. */
    }
  }
  const conflict = session.conflict;
  const conflictError =
    conflict?.error instanceof PosError ? conflict.error : null;
  const current = conflictError?.payload.order as PosOrderV2 | undefined;
  const products = conflictError?.payload.products as
    PosCatalogProductV2[] | undefined;
  let pendingError: string | undefined;
  if (pending)
    try {
      serializeMeasuredCart(
        appendCartLine(
          draft.lines,
          newCartLine(pending.product, "preview", pending.editor, units),
        ),
        units,
        context.currencyCode,
      );
    } catch (cause) {
      pendingError = (cause as Error).message;
    }
  async function save(prepare = false, retry = false) {
    const result = await session.save(prepare, retry);
    if (!result || live.current !== session) return;
    onSaved(result.order);
    if (result.prepare && session.commands.getSnapshot().status !== "retired")
      onPrepare(result.order);
  }
  function add(product: PosCatalogProductV2) {
    setMessage(null);
    if (product.soldByWeight) {
      setPending({
        product,
        editor: quantityEditor(null, product.pricingUnit),
      });
      return;
    }
    try {
      session.change({
        lines: appendCartLine(
          draft.lines,
          newCartLine(
            product,
            crypto.randomUUID(),
            { source: null, unit: "unit", buffer: "1", edited: true },
            units,
          ),
        ),
      });
    } catch (cause) {
      setMessage((cause as Error).message);
    }
  }
  const confirmation = (
    <Button
      className="md:w-full"
      isDisabled={
        blocked ||
        !!validation ||
        unavailable ||
        !!pending ||
        (draft.saleType === "counter" && !draft.lines.length)
      }
      onPress={() => void save(draft.saleType === "counter")}
    >
      {state.status === "pending"
        ? "Guardando…"
        : draft.saleType === "counter"
          ? "Continuar al cobro"
          : "Confirmar orden"}
    </Button>
  );
  const totalLabel =
    total === undefined
      ? "Revisa las cantidades"
      : measuredMoney(
          benefitPreview?.amounts?.collected ?? total,
          context.currencyCode,
        );
  const primary = (
    <div className="grid gap-4 border-t border-border p-5">
      <div className="flex items-center justify-between gap-3">
        <Text>Subtotal</Text>
        <Text className="tabular-nums">
          {total === undefined
            ? totalLabel
            : measuredMoney(total, context.currencyCode)}
        </Text>
      </div>
      {benefitPreview?.amounts &&
        !/^0(?:\.00)?$/.test(benefitPreview.amounts.discount) && (
          <div className="flex items-center justify-between gap-3">
            <Text>Descuento</Text>
            <Text>
              {measuredMoney(
                benefitPreview.amounts.discount,
                context.currencyCode,
              )}
            </Text>
          </div>
        )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Heading level={2}>Total</Heading>
        <Text variant="metric">{totalLabel}</Text>
      </div>
      <Text variant="small">
        {session.customer.state.resolved
          ? "Cliente identificado · Beneficios al cobrar"
          : "Sin cliente · No se acreditan beneficios"}
      </Text>
      {benefitPreview?.error && (
        <Alert kind="error" title={benefitPreview.error} />
      )}
      {confirmation}
    </div>
  );
  const mobilePrimary = (
    <div className="flex items-center justify-between gap-4 border-t border-border bg-surface p-4">
      <div className="min-w-0">
        <Text variant="small">Total del pedido</Text>
        <Text variant="label">{totalLabel}</Text>
      </div>
      {confirmation}
    </div>
  );
  return (
    <div className="mx-auto grid max-w-6xl gap-6 p-4 pb-36 md:p-6 md:pb-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 break-words">
          <Heading level={1}>
            {session.order?.orderLabel || "Nuevo pedido"}
          </Heading>
          {session.order && (
            <Text variant="muted">
              {session.dirty ? "Cambios sin guardar" : "Pedido guardado"}
            </Text>
          )}
        </div>
        <Button
          variant="quiet"
          isDisabled={blocked}
          onPress={() => {
            if (session.requestExit()) onExit();
            else setExitOpen(true);
          }}
        >
          Salir
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          className="max-w-full rounded-full! border-primary! bg-primary-soft! px-4! text-primary!"
          aria-label={`Editar mesa u orden: ${draft.orderLabel || labels[draft.saleType]}`}
          isDisabled={blocked}
          onPress={() => setDetailsEditor("order")}
        >
          <Text
            as="span"
            variant="label"
            className="min-w-0 break-words text-primary"
          >
            {draft.orderLabel || labels[draft.saleType]}
          </Text>
          <EditPencil className="size-4 shrink-0" aria-hidden="true" />
        </Button>
        <Button
          variant="secondary"
          className="max-w-full rounded-full! border-primary! bg-primary-soft! px-4! text-primary!"
          aria-label={`Editar local: ${context.locations.find((l) => l.id === draft.locationId)?.name ?? "Sin local"}`}
          isDisabled={blocked}
          onPress={() => setDetailsEditor("location")}
        >
          <Text
            as="span"
            variant="label"
            className="min-w-0 break-words text-primary"
          >
            {context.locations.find((l) => l.id === draft.locationId)?.name ??
              "Elegir local"}
          </Text>
          <EditPencil className="size-4 shrink-0" aria-hidden="true" />
        </Button>
      </div>
      <Dialog
        title={
          detailsEditor === "location" ? "Cambiar local" : "Editar mesa u orden"
        }
        isOpen={detailsEditor !== null && !blocked}
        onOpenChange={(open) => {
          if (!open) setDetailsEditor(null);
        }}
      >
        <div className="grid gap-4">
          {detailsEditor === "location" ? (
            <SelectField
              label="Local"
              selectedKey={draft.locationId || null}
              options={context.locations.map((l) => ({
                id: l.id,
                label: l.name,
              }))}
              isDisabled={blocked || context.locations.length === 1}
              onSelectionChange={(key) => {
                const id = String(key);
                if (id === draft.locationId) return;
                setDetailsEditor(null);
                if (!session.changeLocation(id, false)) setLocationChange(id);
              }}
            />
          ) : (
            <>
              <SelectField
                label="Tipo de venta"
                selectedKey={draft.saleType}
                options={[
                  ...context.saleTypes,
                  ...(session.order?.saleType === "legacy"
                    ? ["legacy" as const]
                    : []),
                ].map((id) => ({ id, label: labels[id] }))}
                isDisabled={blocked}
                onSelectionChange={(key) =>
                  session.change({
                    saleType: key as SaleType,
                    tableId: null,
                    orderLabel: "",
                  })
                }
              />
              {draft.saleType === "table" && context.tablesEnabled ? (
                <PosTablePicker
                  {...tables}
                  tableId={draft.tableId}
                  name={draft.orderLabel}
                  orderId={session.order?.id}
                  disabled={blocked}
                  onChange={(tableId, orderLabel) =>
                    session.change({ tableId, orderLabel })
                  }
                />
              ) : (
                draft.saleType !== "counter" && (
                  <TextField
                    label={
                      draft.saleType === "table"
                        ? "Nombre de mesa"
                        : "Nombre o referencia"
                    }
                    value={draft.orderLabel}
                    onChange={(orderLabel) => session.change({ orderLabel })}
                    isRequired
                    maxLength={60}
                    isDisabled={blocked}
                  />
                )
              )}
              {draft.saleType === "counter" && (
                <Text variant="muted">
                  La referencia de Mostrador se asigna al guardar.
                </Text>
              )}
            </>
          )}
          <Button variant="secondary" onPress={() => setDetailsEditor(null)}>
            Listo
          </Button>
        </div>
      </Dialog>
      {(session.error || message) && (
        <Alert kind="error" title={session.error || message || ""} />
      )}
      {state.status === "retired" && (
        <Alert
          kind="error"
          title="El acceso o el contexto cambió. Vuelve a abrir el pedido."
        />
      )}
      {state.status === "uncertain" && (
        <Alert kind="error" title="Aún no sabemos si el pedido se guardó.">
          <Text>
            Conservamos el mismo intento. Recupéralo antes de salir o crear otro
            pedido.
          </Text>
          {state.error instanceof Error && <Text>{state.error.message}</Text>}
          <Button onPress={() => void save(false, true)}>
            Recuperar guardado
          </Button>
        </Alert>
      )}
      {conflict && (
        <Alert
          kind="error"
          title="El pedido cambió. Revisa antes de continuar."
        >
          {current && (
            <div className="grid gap-2">
              <Text variant="label">
                Versión actual {current.version}: {current.orderLabel} ·{" "}
                {current.status}
              </Text>
              <Text>
                {current.location?.name} · {labels[current.saleType]} ·{" "}
                {current.business.currencyCode} {current.total}
              </Text>
              <Text>{current.note || "Sin nota"}</Text>
              {current.items.map((line) => (
                <Text key={line.lineId}>
                  {line.name}: {line.quantity} {line.measure.quantityUnit} ·{" "}
                  {line.unitPrice} por {line.measure.priceUnit} ·{" "}
                  {line.lineTotal}
                </Text>
              ))}
              <Button
                variant="secondary"
                onPress={() => session.reviewVersion()}
              >
                He revisado la orden actual; conservar mi borrador
              </Button>
            </div>
          )}
          {products && (
            <div className="grid gap-2">
              {products.map((product) => (
                <Text key={product.id}>
                  {product.name}: {product.unitPrice ?? "Sin precio"} por{" "}
                  {product.pricingUnit} · revisión {product.catalogRevision}
                </Text>
              ))}
              <Text>
                Revisa las tarifas actuales. Un cambio de medida requiere
                escribir otra cantidad.
              </Text>
              <Button
                variant="secondary"
                onPress={() => session.reviewCatalog()}
              >
                He revisado los productos; actualizar las líneas nuevas
              </Button>
            </div>
          )}
          {!current && !products && (
            <Text>
              No podemos resolver este conflicto aquí. Conserva el borrador y
              revisa el pedido antes de volver a intentar.
            </Text>
          )}
        </Alert>
      )}
      <div
        className="flex gap-2 md:hidden"
        role="group"
        aria-label="Vista del editor"
      >
        <Button
          variant={view === "catalog" ? "primary" : "secondary"}
          aria-pressed={view === "catalog"}
          onPress={() => setView("catalog")}
        >
          Catálogo
        </Button>
        <Button
          variant={view === "order" ? "primary" : "secondary"}
          aria-pressed={view === "order"}
          onPress={() => setView("order")}
        >
          Orden ({draft.lines.length})
        </Button>
      </div>
      <div className="grid min-w-0 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <section
          aria-label="Catálogo"
          className={`${view === "catalog" ? "" : "hidden"} min-w-0 md:block xl:col-span-2`}
        >
          <div className="mb-4">
            <Heading level={2}>Catálogo</Heading>
          </div>
          {!draft.locationId ? (
            <Text>Elige un local para ver sus productos.</Text>
          ) : session.catalogLoading ? (
            <Text>Cargando catálogo…</Text>
          ) : catalog ? (
            <MeasuredProductCatalog
              key={draft.locationId}
              catalog={catalog}
              currencyCode={context.currencyCode}
              disabled={blocked}
              onAdd={add}
            />
          ) : (
            <Button
              variant="secondary"
              onPress={() => void session.loadCatalog()}
            >
              Reintentar catálogo
            </Button>
          )}
        </section>
        <section
          aria-label="Orden"
          className={`${view === "order" ? "" : "hidden"} min-w-0 md:block`}
        >
          <Card as="div" className="overflow-hidden rounded-2xl p-0! sm:p-0!">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
              <Heading level={2}>Venta actual</Heading>
              <Text
                as="span"
                variant="small"
                className="rounded-sm border border-border px-2 py-1"
              >
                {session.order
                  ? session.dirty
                    ? "Cambios sin guardar"
                    : "Guardado"
                  : "Borrador"}
              </Text>
            </div>
            <MeasuredEditorCustomer
              session={session}
              onAccessError={onAccessError}
            />
            <div className="grid gap-4 p-5">
              <MeasuredCart
                lineAmounts={lineAmounts}
                lines={draft.lines}
                enabledUnits={units}
                currencyCode={context.currencyCode}
                busy={blocked}
                onChange={(lines) => session.change({ lines })}
              />
              <div className="grid gap-2">
                <Button
                  variant="quiet"
                  className="justify-start! px-0!"
                  isDisabled={blocked}
                  onPress={() => setNoteOpen(true)}
                >
                  <EditPencil className="size-4" aria-hidden="true" />
                  {draft.note
                    ? "Editar nota del pedido"
                    : "Añadir nota al pedido"}
                </Button>
                {draft.note && (
                  <Text variant="small" className="line-clamp-2 break-words">
                    {draft.note}
                  </Text>
                )}
              </div>
              {validation && (
                <div role="status">
                  <Text variant="small">{validation}</Text>
                </div>
              )}
            </div>
            <div className="hidden md:block">{primary}</div>
          </Card>
          <div className="fixed inset-x-0 bottom-0 z-20 md:hidden">
            {mobilePrimary}
          </div>
        </section>
        {view === "catalog" && (
          <div className="fixed inset-x-0 bottom-0 z-20 md:hidden">
            {mobilePrimary}
          </div>
        )}
      </div>
      <Dialog
        title="Nota del pedido"
        isOpen={noteOpen && !blocked}
        onOpenChange={setNoteOpen}
      >
        <TextAreaField
          label="Nota del pedido"
          value={draft.note}
          maxLength={1000}
          isDisabled={blocked}
          onChange={(note) => session.change({ note })}
        />
        <div className="mt-4 flex justify-end">
          <Button onPress={() => setNoteOpen(false)}>Listo</Button>
        </div>
      </Dialog>
      {pending && (
        <MeasuredQuantityDialog
          name={pending.product.name}
          editor={pending.editor}
          enabledUnits={units}
          error={pendingError}
          onChange={(editor) => setPending({ ...pending, editor })}
          onCancel={() => setPending(null)}
          onConfirm={() => {
            session.change({
              lines: appendCartLine(
                draft.lines,
                newCartLine(
                  pending.product,
                  crypto.randomUUID(),
                  pending.editor,
                  units,
                ),
              ),
            });
            setPending(null);
          }}
        />
      )}
      <Dialog
        isOpen={exitOpen}
        title="Tienes cambios sin guardar"
        onOpenChange={setExitOpen}
      >
        <Text>
          Puedes seguir trabajando o descartar tus cambios. El pedido guardado
          seguirá abierto.
        </Text>
        <FormActions>
          <Button variant="secondary" onPress={() => setExitOpen(false)}>
            Seguir trabajando
          </Button>
          <Button
            onPress={() => {
              if (session.requestExit(true)) onExit();
            }}
          >
            Descartar cambios y salir
          </Button>
        </FormActions>
      </Dialog>
      <Dialog
        isOpen={locationChange !== null}
        title="Cambiar de local"
        onOpenChange={(open) => {
          if (!open) setLocationChange(null);
        }}
      >
        <Text>
          Para cambiar de local, retira explícitamente las líneas actuales.
          Puedes seguir trabajando y conservarlas.
        </Text>
        <FormActions>
          <Button variant="secondary" onPress={() => setLocationChange(null)}>
            Seguir trabajando
          </Button>
          <Button
            onPress={() => {
              if (locationChange) session.changeLocation(locationChange, true);
              setLocationChange(null);
            }}
          >
            Retirar líneas y cambiar local
          </Button>
        </FormActions>
      </Dialog>
    </div>
  );
}
