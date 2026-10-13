"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  EditPencil as Pen,
  MoreVert,
  NavArrowLeft,
  Notes,
  Printer,
  QrCode,
  Trash,
  User,
  Xmark,
} from "iconoir-react";
import {
  Alert,
  Button,
  Dialog,
  Heading,
  SegmentedControl,
  Text,
  TextAreaField,
} from "../../../ui";
import { catalogKey, DiscardedPosRead, PosCache } from "./pos-cache";
import { ConfirmationToast } from "../../components/confirmation-toast";
import { DetailedSale } from "../counter/sale-forms";
import { formatMoney } from "../counter/types";
import { PosTablePicker, tableUnavailable, usePosTables } from "./pos-tables";
import { PosCoupon } from "./pos-coupon";
import type { PosPayment } from "./pos-payment";
import type { PosPrinting } from "./pos-printing";
import {
  addProduct,
  PosCart,
  productCart,
  productQuantity,
  quantityForLine,
} from "./pos-cart";
import {
  PosError,
  draftItems,
  linePayload,
  type DraftLine,
  type PosCatalog,
  type PosLocation,
  type PosOrder,
} from "./pos-types";

function signature(
  table: string,
  location: string,
  lines: DraftLine[],
  tableId: string | null,
  note: string,
) {
  return JSON.stringify([
    table.trim(),
    location,
    linePayload(lines),
    tableId,
    note.trim(),
  ]);
}
export function PosEditor({
  order,
  cache,
  catalogRevision,
  tablesRevision,
  locations,
  currencyCode,
  busy,
  saveError,
  onSave,
  onCancel,
  onError,
  onCheckout,
  onScan,
  payment,
  printing,
  onVoid,
  lastLocationId,
}: {
  order: PosOrder | null;
  cache: PosCache;
  catalogRevision: number;
  tablesRevision: number;
  locations: PosLocation[];
  currencyCode: string;
  busy: boolean;
  saveError: string | null;
  onSave: (
    body: unknown,
    optimisticNote?: string | null,
  ) => Promise<PosOrder | null>;
  onCancel: () => void;
  onError: (error: unknown) => void;
  onCheckout: () => void;
  onScan: () => void;
  payment: PosPayment;
  printing: PosPrinting;
  onVoid: () => void;
  lastLocationId: string;
}) {
  const router = useRouter();
  const initialLocation = order
    ? (order.location?.id ?? "")
    : locations.length === 1
      ? locations[0].id
      : locations.some((l) => l.id === lastLocationId)
        ? lastLocationId
        : "";
  const [tableId, setTableId] = useState(order?.tableId ?? null);
  const [table, setTable] = useState(order?.tableLabel ?? "");
  const [locationId, setLocationId] = useState(initialLocation);
  const [lines, setLines] = useState<DraftLine[]>(() =>
    order ? draftItems(order) : [],
  );
  const [baseline, setBaseline] = useState(order);
  const [note, setNote] = useState(order?.note ?? "");
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const noteSaving = useRef(false);
  const [baselineSignature, setBaselineSignature] = useState(() =>
    signature(
      order?.tableLabel ?? "",
      initialLocation,
      order ? draftItems(order) : [],
      order?.tableId ?? null,
      order?.note ?? "",
    ),
  );
  const [surface, setSurface] = useState<"table" | "products" | "order">(
    order ? "order" : "table",
  );
  const tabsRef = useRef<HTMLDivElement>(null);
  const [tabsStuck, setTabsStuck] = useState(false);
  useEffect(() => {
    if (!order || surface !== "order") {
      setTabsStuck(false);
      return;
    }
    let frame = 0;
    function measure() {
      frame = 0;
      const tabs = tabsRef.current;
      setTabsStuck(
        !!tabs &&
          tabs.offsetHeight > 0 &&
          tabs.getBoundingClientRect().top <= 0,
      );
    }
    function scheduleMeasure() {
      if (!frame) frame = requestAnimationFrame(measure);
    }
    scheduleMeasure();
    window.addEventListener("scroll", scheduleMeasure, {
      passive: true,
      capture: true,
    });
    window.addEventListener("resize", scheduleMeasure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleMeasure, true);
      window.removeEventListener("resize", scheduleMeasure);
    };
  }, [order, surface]);
  const [reviewAdded, setReviewAdded] = useState(0);
  const [addedNotice, setAddedNotice] = useState(false);
  const [addedNoticeId, setAddedNoticeId] = useState(0);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [updatedNotice, setUpdatedNotice] = useState<string | null>(null);
  const [updatedNoticeId, setUpdatedNoticeId] = useState(0);
  const [removeClientOpen, setRemoveClientOpen] = useState(false);
  const reviewListRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!reviewAdded) return;
    const frame = requestAnimationFrame(() => {
      reviewListRef.current?.scrollIntoView({
        block: "end",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [reviewAdded]);
  const [catalogStarted, setCatalogStarted] = useState(!order);
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [removedLines, setRemovedLines] = useState<
    { line: DraftLine; index: number }[]
  >([]);
  const [exitTarget, setExitTarget] = useState<string | null>(null);
  const [contextOpen, setContextOpen] = useState(false);
  const [contextTable, setContextTable] = useState(table);
  const [contextTableId, setContextTableId] = useState(tableId);
  const [contextAttempted, setContextAttempted] = useState(false);
  const contextSaving = useRef(false);
  const tableOptions = usePosTables(locationId, tablesRevision, onError);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const allowExit = useRef(false);
  const scrollPositions = useRef({ table: 0, products: 0, order: 0 });
  const dirty =
    signature(table, locationId, lines, tableId, note) !== baselineSignature;
  const conflict = !!order && !!baseline && order.version !== baseline.version;
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  const total =
    lines.reduce(
      (sum, line) => sum + Math.round(line.unitPrice * 100) * line.quantity,
      0,
    ) / 100;
  const money = formatMoney(total, currencyCode);
  const contextInvalid =
    (!order || tableId) && !tableOptions.tables
      ? "Carga las mesas del local."
      : !order && tableOptions.tables?.length && !tableId
        ? "Elige una mesa del local."
        : tableUnavailable(tableOptions.tables, tableId, order?.id)
          ? "La mesa seleccionada ya no está disponible. Revisa las mesas del local."
          : !table.trim()
            ? "Escribe el nombre de la mesa."
            : table.trim().length > 60
              ? "El nombre admite hasta 60 caracteres."
              : !order && locations.length > 1 && !locationId
                ? "Elige un local."
                : null;
  const invalid =
    contextInvalid ??
    (lines.length > 200
      ? "El pedido admite hasta 200 líneas."
      : lines.some(
            (line) =>
              !Number.isFinite(line.unitPrice) ||
              line.unitPrice < 0 ||
              !Number.isInteger(line.quantity) ||
              line.quantity <= 0,
          )
        ? "Revisa las cantidades de los productos."
        : null);
  const [catalogSnapshot, setCatalog] = useState<PosCatalog | null>(() =>
    cache.peek<PosCatalog>(catalogKey(locationId), true),
  );
  const [loadedLocation, setLoadedLocation] = useState(locationId);
  const catalog = loadedLocation === locationId ? catalogSnapshot : null;
  const [catalogError, setCatalogError] = useState<string | null>(null);
  function apply(current: PosOrder) {
    const nextLines = draftItems(current);
    const nextLocation = current.location?.id ?? "";
    setTable(current.tableLabel);
    setTableId(current.tableId ?? null);
    setLocationId(nextLocation);
    setLines(nextLines);
    setNote(current.note ?? "");
    setBaseline(current);
    setBaselineSignature(
      signature(
        current.tableLabel,
        nextLocation,
        nextLines,
        current.tableId ?? null,
        current.note ?? "",
      ),
    );
    setReviewOpen(false);
    setRemovedLines([]);
  }
  // A clean workspace may receive a fresh snapshot from the pre-void check.
  // A modified one keeps its intent until the operator explicitly reviews it.
  useEffect(() => {
    if (order && conflict && !dirty) apply(order);
  }, [order, conflict, dirty]);
  useEffect(() => {
    let active = true;
    setLoadedLocation(locationId);
    setCatalog(cache.peek<PosCatalog>(catalogKey(locationId), true));
    setCatalogError(null);
    if (!catalogStarted || (!order && locations.length > 1 && !locationId))
      return;
    void cache
      .catalog(locationId)
      .then((data) => {
        if (active) setCatalog(data);
      })
      .catch((error) => {
        if (error instanceof DiscardedPosRead) return;
        if (active) setCatalogError(error.message);
        if (error instanceof PosError && [401, 403].includes(error.status ?? 0))
          onError(error);
      });
    return () => {
      active = false;
    };
  }, [
    cache,
    catalogRevision,
    catalogStarted,
    catalogAttempt,
    locationId,
    locations.length,
    onError,
  ]);
  useEffect(() => {
    if (!dirty && !busy) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (allowExit.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const linkClick = (event: MouseEvent) => {
      if (
        allowExit.current ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const anchor =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (
        !(anchor instanceof HTMLAnchorElement) ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download")
      )
        return;
      const url = new URL(anchor.href, window.location.href);
      if (
        url.origin !== window.location.origin ||
        (url.pathname === window.location.pathname &&
          url.search === window.location.search)
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      if (!busy) setExitTarget(url.pathname + url.search + url.hash);
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", linkClick, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", linkClick, true);
    };
  }, [dirty, busy]);
  function changeSurface(next: typeof surface) {
    if (
      !order &&
      surface === "table" &&
      next !== "table" &&
      (contextInvalid || !catalog)
    )
      return;
    if (next === "products" || next === "order") setCatalogStarted(true);
    scrollPositions.current[surface] = window.scrollY;
    setSurface(next);
    requestAnimationFrame(() =>
      window.scrollTo({ top: scrollPositions.current[next] }),
    );
  }
  function leave() {
    allowExit.current = true;
    if (!exitTarget || exitTarget === "list") onCancel();
    else router.push(exitTarget);
  }
  function requestExit() {
    if (busy) return;
    if (dirty) setExitTarget("list");
    else onCancel();
  }
  async function save(exitAfter = false) {
    if (invalid || busy || conflict || (!order && surface !== "order")) return;
    setUpdatedNotice(null);
    const noteChanged = note.trim() !== (baseline?.note ?? "");
    const result = await onSave({
      ...(order ? { version: baseline!.version } : {}),
      tableLabel: table.trim(),
      ...(tableId ? { tableId } : order ? { tableId: null } : {}),
      ...(locationId ? { locationId } : {}),
      items: linePayload(lines),
      ...(!order || noteChanged ? { note: note.trim() || null } : {}),
    });
    if (!result) return;
    apply(result);
    if (exitAfter) leave();
    else {
      changeSurface("order");
      if (order)
        setUpdatedNotice(
          noteChanged
            ? result.note
              ? "Nota actualizada"
              : "Nota eliminada"
            : "Pedido actualizado",
        );
    }
  }
  function applyNoteSnapshot(current: PosOrder) {
    setNote(current.note ?? "");
    setBaseline(current);
    setBaselineSignature(
      signature(
        current.tableLabel,
        current.location?.id ?? "",
        draftItems(current),
        current.tableId ?? null,
        current.note ?? "",
      ),
    );
  }
  async function saveNote() {
    if (busy || conflict || noteSaving.current || noteText.trim().length > 1000)
      return;
    if (!baseline) {
      setNote(noteText.trim());
      setNoteOpen(false);
      return;
    }
    const previous = baseline;
    const nextNote = noteText.trim() || null;
    noteSaving.current = true;
    applyNoteSnapshot({ ...previous, note: nextNote });
    setNoteOpen(false);
    setUpdatedNoticeId((current) => current + 1);
    setUpdatedNotice(nextNote ? "Nota actualizada" : "Nota eliminada");
    try {
      const result = await onSave(
        {
          version: previous.version,
          tableLabel: previous.tableLabel,
          tableId: previous.tableId ?? null,
          ...(previous.location?.id
            ? { locationId: previous.location.id }
            : {}),
          items: linePayload(draftItems(previous)),
          note: nextNote,
        },
        nextNote,
      );
      if (!result) {
        applyNoteSnapshot(previous);
        setUpdatedNotice(null);
        setNoteOpen(true);
        return;
      }
      applyNoteSnapshot(result);
    } finally {
      noteSaving.current = false;
    }
  }
  async function saveTable() {
    if (!baseline || busy || conflict || contextSaving.current) return;
    contextSaving.current = true;
    setContextAttempted(true);
    setUpdatedNotice(null);
    const draftLines = lines;
    const draftRemoved = removedLines;
    const draftNote = note;
    const savedLines = draftItems(baseline);
    const preserveProducts =
      JSON.stringify(linePayload(lines)) !==
      JSON.stringify(linePayload(savedLines));
    try {
      const result = await onSave({
        version: baseline.version,
        tableLabel: contextTable.trim(),
        tableId: contextTableId,
        ...(baseline.location?.id ? { locationId: baseline.location.id } : {}),
        items: linePayload(savedLines),
      });
      if (!result) return;
      apply(result);
      setNote(draftNote);
      if (preserveProducts) {
        setLines(draftLines);
        setRemovedLines(draftRemoved);
      }
      setContextOpen(false);
      setUpdatedNotice("Pedido actualizado");
    } finally {
      contextSaving.current = false;
    }
  }
  function removeLine(key: string) {
    const index = lines.findIndex((line) => line.key === key);
    if (busy || conflict || index < 0) return;
    setRemovedLines((current) => [...current, { line: lines[index], index }]);
    setLines((current) => current.filter((line) => line.key !== key));
  }
  function undoRemove() {
    const removed = removedLines.at(-1);
    if (!removed || busy || conflict || lines.length >= 200) return;
    setLines((current) => {
      const next = [...current];
      next.splice(Math.min(removed.index, next.length), 0, removed.line);
      return next;
    });
    setRemovedLines((current) => current.slice(0, -1));
  }
  const step = surface === "table" ? 1 : surface === "products" ? 2 : 3;
  const stepTitle =
    surface === "table"
      ? "Mesa"
      : surface === "products"
        ? "Tomar pedido"
        : "Revisar pedido";
  const contextFields = (
    <PosTablePicker
      {...tableOptions}
      tableId={tableId}
      name={table}
      orderId={order?.id}
      disabled={busy || conflict}
      onChange={(id, name) => {
        setTableId(id);
        setTable(name);
      }}
    />
  );
  const noteButton = (
    <Button
      variant="quiet"
      aria-label={note ? "Nota de la orden: nota añadida" : "Nota de la orden"}
      aria-haspopup="dialog"
      aria-expanded={noteOpen}
      className={`close-module size-12 shrink-0 rounded-full! p-0! ${note ? "bg-primary! text-on-primary!" : "bg-primary-soft!"}`}
      isDisabled={busy || conflict}
      onPress={() => {
        setNoteText(note);
        setNoteOpen(true);
      }}
    >
      <Notes aria-hidden="true" className="size-6" />
    </Button>
  );
  const actionsButton = (
    <Button
      variant="quiet"
      aria-label={
        note ? "Acciones de la orden: nota añadida" : "Acciones de la orden"
      }
      aria-haspopup="dialog"
      aria-expanded={actionsOpen}
      className={`close-module relative size-12 shrink-0 rounded-full! bg-primary-soft! p-0! ${note ? "border-2! border-primary!" : ""}`}
      isDisabled={busy}
      onPress={() => setActionsOpen(true)}
    >
      <MoreVert aria-hidden="true" className="size-6" />
    </Button>
  );
  return (
    <div
      className={`grid min-w-0 gap-4 ${order ? (surface === "products" ? "pb-24" : "pb-44") : surface === "products" ? "pb-24" : "pb-36"} md:flex md:flex-1 md:flex-col md:pb-0 print:hidden`}
    >
      <div className="flex items-center justify-between gap-3">
        {!order && surface !== "table" && (
          <Button
            variant="quiet"
            className="close-module size-11 shrink-0 rounded-full! bg-primary-soft! p-0!"
            aria-label={
              surface === "order" ? "Volver a tomar pedido" : "Volver a mesa"
            }
            isDisabled={busy}
            onPress={() =>
              changeSurface(surface === "order" ? "products" : "table")
            }
          >
            <NavArrowLeft aria-hidden="true" className="size-6" />
          </Button>
        )}
        {(order || surface === "table") && (
          <div aria-hidden="true" className="size-11 shrink-0" />
        )}
        <div className="grid min-w-0 flex-1 gap-1">
          {!order && (
            <>
              <Text variant="small" className="sr-only">
                Paso {step} de 3: {stepTitle}
              </Text>
              <div aria-hidden="true" className="flex justify-center gap-2">
                {[1, 2, 3].map((stage) => (
                  <span
                    key={stage}
                    className={`h-1 w-6 rounded-full ${stage === step ? "bg-primary" : "bg-disabled"}`}
                  />
                ))}
              </div>
            </>
          )}
          {order ? (
            <div
              role="heading"
              aria-level={1}
              className="mx-auto w-fit max-w-full text-center break-words"
            >
              <Button
                variant="quiet"
                aria-label={`Cambiar mesa: ${table.trim() || "Mesa sin nombre"}`}
                aria-haspopup="dialog"
                aria-expanded={contextOpen}
                className="max-w-full rounded-full! border! border-primary! bg-primary-soft! px-4! py-2!"
                isDisabled={busy || conflict}
                onPress={() => {
                  setContextTable(table);
                  setContextTableId(tableId);
                  setContextAttempted(false);
                  setContextOpen(true);
                }}
              >
                <Text
                  variant="label"
                  className="min-w-0 break-words text-primary!"
                >
                  {table.trim() || "Mesa sin nombre"}
                </Text>
                <Pen aria-hidden="true" className="size-5 shrink-0" />
              </Button>
            </div>
          ) : (
            <div
              role="heading"
              aria-level={1}
              className="text-center break-words"
            >
              <Text variant="small">{table.trim() || "Mesa sin nombre"}</Text>
            </div>
          )}
        </div>
        <Button
          variant="quiet"
          aria-label="Volver al listado de órdenes"
          className="close-module size-11 shrink-0 rounded-full! bg-primary-soft! p-0!"
          isDisabled={busy}
          onPress={requestExit}
        >
          <Xmark aria-hidden="true" className="size-6" />
        </Button>
      </div>
      {!order ? (
        surface === "table" ? (
          <>
            {contextFields}
            {catalogError && (
              <Alert kind="error" title={catalogError}>
                <Button
                  variant="secondary"
                  isDisabled={busy}
                  onPress={() => setCatalogAttempt((attempt) => attempt + 1)}
                >
                  Reintentar carga del catálogo
                </Button>
              </Alert>
            )}
          </>
        ) : null
      ) : null}
      {conflict && (
        <Alert kind="error" title="Otra persona modificó este pedido">
          Tus cambios siguen aquí. Revisa ambos pedidos antes de continuar.
          <Button
            variant="secondary"
            isDisabled={busy}
            onPress={() => setReviewOpen(true)}
          >
            Revisar versión actual
          </Button>
        </Alert>
      )}
      {order && (
        <div
          ref={tabsRef}
          className={
            surface === "order"
              ? `sticky top-0 z-20 py-2 transition-colors duration-200 motion-reduce:transition-none ${tabsStuck ? "bg-canvas" : "bg-transparent"}`
              : undefined
          }
        >
          <SegmentedControl
            aria-label="Vista del pedido"
            fullWidth
            selectedKey={surface}
            onSelectionChange={(key) => changeSurface(key as typeof surface)}
            isDisabled={busy}
            options={[
              { id: "products", label: "Editar" },
              { id: "order", label: `Pedido (${count})` },
            ]}
          />
        </div>
      )}
      <div
        className={
          surface === "products" ? `min-w-0${order ? " pt-2" : ""}` : "hidden"
        }
      >
        {catalogError && <Alert kind="error" title={catalogError} />}
        {!catalog ? (
          <Text variant="muted">
            {locations.length > 1 && !locationId
              ? "Elige el local para ver su catálogo."
              : "Cargando catálogo…"}
          </Text>
        ) : (
          <DetailedSale
            key={locationId}
            products={catalog.products}
            productOrder={catalog.bestSellingProductIds}
            categories={catalog.categories}
            habitualProductIds={[]}
            lastPurchase={null}
            currencyCode={currencyCode}
            cart={productCart(lines)}
            disabled={busy || conflict}
            showPrices={false}
            compactSearch
            clearSearchOnAdd={!!order}
            showHeading={false}
            stickyControls
            allowPriceInput={false}
            onAdd={(p) => {
              if (
                p.unitPrice === null ||
                (lines.length >= 200 &&
                  !lines.some((line) => line.productId === p.id))
              )
                return;
              setLines((current) => addProduct(current, p));
              if (order) {
                setAddedNoticeId((current) => current + 1);
                setAddedNotice(true);
              }
            }}
            onQty={(id, delta) => {
              setLines((current) => productQuantity(current, id, delta));
              if (order && delta > 0) {
                setAddedNoticeId((current) => current + 1);
                setAddedNotice(true);
              }
            }}
            onLinePrice={() => {}}
            onRepeat={() => {}}
          />
        )}
      </div>
      <div
        ref={reviewListRef}
        className={
          surface === "order"
            ? `grid gap-4 scroll-mb-36 md:scroll-mb-4${order ? " pt-2" : ""}`
            : "hidden"
        }
      >
        {!order && catalog && (
          <DetailedSale
            key={`review-${locationId}`}
            products={catalog.products}
            productOrder={catalog.bestSellingProductIds}
            categories={catalog.categories}
            habitualProductIds={[]}
            lastPurchase={null}
            currencyCode={currencyCode}
            cart={productCart(lines)}
            disabled={busy}
            showPrices={false}
            allowPriceInput={false}
            searchOnly
            stickyControls
            onAdd={(p) => {
              if (
                p.unitPrice === null ||
                (lines.length >= 200 &&
                  !lines.some((line) => line.productId === p.id))
              )
                return;
              setLines((current) => addProduct(current, p));
              setReviewAdded((current) => current + 1);
              setAddedNoticeId((current) => current + 1);
              setAddedNotice(true);
            }}
            onQty={(id, delta) =>
              setLines((current) => productQuantity(current, id, delta))
            }
            onLinePrice={() => {}}
            onRepeat={() => {}}
          />
        )}
        {!order && catalogError && <Alert kind="error" title={catalogError} />}
        {!order && removedLines.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Text variant="small">
              Quitaste {removedLines.at(-1)!.line.name}.
            </Text>
            <Button
              variant="quiet"
              isDisabled={busy || lines.length >= 200}
              onPress={undoRemove}
            >
              Deshacer
            </Button>
          </div>
        )}
        {order && payment.resolved && (
          <div className="grid gap-3">
            <div
              role="group"
              aria-label="Cliente identificado"
              className="flex w-full min-w-0 max-w-full items-center gap-3 rounded-xl border border-accent bg-surface-subtle p-2 md:w-fit"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface text-content-muted">
                <User aria-hidden="true" className="size-5" />
              </span>
              <div className="grid min-w-0 flex-1 gap-1 md:flex-none">
                <Text variant="small">Cliente</Text>
                <Text variant="label" className="min-w-0 wrap-anywhere">
                  {payment.resolved.consumer.displayName}
                </Text>
              </div>
              <Button
                variant="quiet"
                aria-label="Quitar cliente"
                aria-haspopup="dialog"
                aria-expanded={removeClientOpen}
                className="size-11 shrink-0 rounded-full! p-0! text-danger!"
                isDisabled={busy}
                onPress={() => setRemoveClientOpen(true)}
              >
                <Trash aria-hidden="true" className="size-5" />
              </Button>
            </div>
            <PosCoupon
              state={payment.resolved.couponState}
              order={order}
              productId={payment.productId}
              onProduct={payment.setProduct}
              onRemove={payment.removeCoupon}
              busy={busy || dirty || conflict}
              excludedId={payment.excludedId}
            />
            {payment.preview?.error &&
              !(
                payment.resolved.couponState.status === "selected" &&
                !payment.resolved.couponState.verdict.valid
              ) && <Alert kind="error" title={payment.preview.error} />}
          </div>
        )}
        {order && payment.clientError && (
          <Alert kind="error" title={payment.clientError}>
            <Button
              variant="quiet"
              isDisabled={busy}
              onPress={() => setRemoveClientOpen(true)}
            >
              Quitar cliente
            </Button>
          </Alert>
        )}
        <PosCart
          lines={lines}
          currencyCode={currencyCode}
          busy={busy || conflict}
          onQty={(key, delta) =>
            setLines((current) => quantityForLine(current, key, delta))
          }
          showPrices={!!order}
          onRemove={order ? undefined : removeLine}
        />
      </div>
      <div className="counter-detailed-footer grid gap-2 bg-surface md:sticky md:bottom-0 md:left-auto md:mt-auto md:w-full md:translate-x-0">
        {order && surface === "products" ? (
          <>
            {invalid && <Text variant="small">{invalid}</Text>}
            <div className="flex items-center gap-3">
              <Button
                className="h-12 min-w-0 flex-1"
                isLoading={busy}
                isDisabled={!dirty || !!invalid || conflict}
                onPress={() => void save()}
              >
                Guardar cambios
              </Button>
              {actionsButton}
              {dirty && (
                <Button
                  variant="danger"
                  aria-label="Descartar cambios"
                  className="size-12 shrink-0 rounded-full! p-0!"
                  isDisabled={busy}
                  onPress={() => setDiscardOpen(true)}
                >
                  <Xmark aria-hidden="true" className="size-6" />
                </Button>
              )}
            </div>
          </>
        ) : order ? (
          <>
            {dirty && !conflict && (
              <Text variant="small">
                Guarda los cambios antes de escanear o cobrar.
              </Text>
            )}
            <div className="flex items-center justify-between gap-3 pt-2 pb-3">
              <Text variant="label">Total:</Text>
              <Heading level={3}>
                {!dirty && payment.preview?.netCents != null
                  ? formatMoney(payment.preview.netCents / 100, currencyCode)
                  : money}
              </Heading>
            </div>
            {invalid && <Text variant="small">{invalid}</Text>}
            <div className="flex items-center gap-3">
              {!order || dirty ? (
                <Button
                  className="h-12 min-w-0 flex-1"
                  isLoading={busy}
                  isDisabled={!!invalid || conflict}
                  onPress={() => void save()}
                >
                  {order ? "Guardar cambios" : "Guardar orden"}
                </Button>
              ) : (
                <Button
                  className="h-12 min-w-0 flex-1"
                  isDisabled={busy || conflict || !lines.length}
                  onPress={onCheckout}
                >
                  Cobrar
                </Button>
              )}
              {actionsButton}
            </div>
          </>
        ) : surface === "table" ? (
          <>
            {contextInvalid && <Text variant="small">{contextInvalid}</Text>}
            <Button
              fullWidth
              isDisabled={busy || !!contextInvalid || !catalog}
              isLoading={!contextInvalid && !catalog && !catalogError}
              onPress={() => changeSurface("products")}
            >
              Tomar pedido
            </Button>
          </>
        ) : surface === "products" ? (
          <div className="flex items-center gap-3">
            <Button
              className="h-12 min-w-0 flex-1"
              isDisabled={busy}
              onPress={() => changeSurface("order")}
            >
              Revisar pedido
            </Button>
            {noteButton}
          </div>
        ) : (
          <>
            {invalid && <Text variant="small">{invalid}</Text>}
            <div className="flex items-center gap-3">
              <Button
                className="h-12 min-w-0 flex-1"
                isLoading={busy}
                isDisabled={!!invalid}
                onPress={() => void save()}
              >
                Guardar pedido
              </Button>
              {noteButton}
            </div>
          </>
        )}
      </div>
      {addedNotice &&
        ((order && surface === "products") ||
          (!order && surface === "order")) && (
          <ConfirmationToast
            key={addedNoticeId}
            message="Producto añadido"
            durationMs={1400}
            onDismiss={() => setAddedNotice(false)}
          />
        )}
      <ConfirmationToast
        key={updatedNoticeId}
        message={updatedNotice}
        onDismiss={() => setUpdatedNotice(null)}
      />
      <Dialog
        isOpen={noteOpen}
        onOpenChange={(open) => {
          if (!busy) setNoteOpen(open);
        }}
        isDismissable={!busy}
        title="Nota de la orden"
        description={
          order
            ? "Añade los datos para la factura u otra información del pedido. Aplicar nota guarda solo la nota de esta orden."
            : "Añade los datos para la factura u otra información del pedido. La nota se guardará cuando guardes el pedido."
        }
      >
        <div className="grid gap-4">
          {saveError && <Alert kind="error" title={saveError} />}
          <TextAreaField
            label="Nota"
            autoFocus
            value={noteText}
            onChange={setNoteText}
            isDisabled={busy || conflict}
            description={`${noteText.trim().length} de 1000 caracteres`}
            errorMessage={
              noteText.trim().length > 1000
                ? "La nota admite hasta 1000 caracteres. Acorta el texto para continuar."
                : undefined
            }
          />
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              isDisabled={busy}
              onPress={() => setNoteOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              isDisabled={busy || conflict || noteText.trim().length > 1000}
              isLoading={busy && noteSaving.current}
              onPress={() => void saveNote()}
            >
              Aplicar nota
            </Button>
          </div>
        </div>
      </Dialog>
      <Dialog
        isOpen={removeClientOpen}
        onOpenChange={(open) => {
          if (!busy) setRemoveClientOpen(open);
        }}
        isDismissable={!busy}
        title="Quitar cliente de la orden"
        description="Se quitarán el cliente y su beneficio de esta orden. Los productos del pedido se conservarán."
      >
        <div className="mt-4 flex justify-end gap-3">
          <Button
            variant="secondary"
            isDisabled={busy}
            onPress={() => setRemoveClientOpen(false)}
          >
            Cancelar
          </Button>
          <Button
            variant="danger"
            isDisabled={busy}
            onPress={() => {
              if (busy) return;
              payment.removeClient();
              setRemoveClientOpen(false);
            }}
          >
            Quitar cliente
          </Button>
        </div>
      </Dialog>
      <Dialog
        isOpen={discardOpen}
        onOpenChange={(open) => {
          if (!busy) setDiscardOpen(open);
        }}
        isDismissable={!busy}
        title="Descartar cambios"
        description="Se eliminarán los cambios sin guardar y volverás al pedido guardado."
      >
        <div className="mt-4 flex justify-end gap-3">
          <Button
            variant="secondary"
            isDisabled={busy}
            onPress={() => setDiscardOpen(false)}
          >
            Cancelar
          </Button>
          <Button
            variant="danger"
            isDisabled={busy}
            onPress={() => {
              if (busy || !order) return;
              apply(order);
              setAddedNotice(false);
              setDiscardOpen(false);
              changeSurface("order");
              setUpdatedNotice(null);
            }}
          >
            Descartar cambios
          </Button>
        </div>
      </Dialog>
      <Dialog
        isOpen={!!exitTarget}
        onOpenChange={(open) => {
          if (!open && !busy) setExitTarget(null);
        }}
        isDismissable={!busy}
        title="¿Salir con cambios sin guardar?"
        description={
          !order && surface !== "order"
            ? "Continúa con los pasos del pedido, descarta los cambios o sigue trabajando."
            : "Guarda el pedido, descarta los cambios o sigue trabajando."
        }
      >
        <div className="grid gap-3">
          {!order && surface !== "order" ? (
            <Button
              isDisabled={busy || !!contextInvalid || !catalog}
              onPress={() => {
                setExitTarget(null);
                changeSurface(surface === "table" ? "products" : "order");
              }}
            >
              {surface === "table" ? "Tomar pedido" : "Revisar pedido"}
            </Button>
          ) : (
            <Button
              isLoading={busy}
              isDisabled={!!invalid || conflict}
              onPress={() => void save(true)}
            >
              Guardar y salir
            </Button>
          )}
          <Button
            variant="secondary"
            isDisabled={busy}
            onPress={() => setExitTarget(null)}
          >
            Seguir trabajando
          </Button>
          <Button
            variant="quiet"
            className="text-danger!"
            isDisabled={busy}
            onPress={leave}
          >
            Descartar cambios
          </Button>
        </div>
      </Dialog>
      <Dialog
        isOpen={contextOpen}
        onOpenChange={(open) => {
          if (!contextSaving.current) setContextOpen(open);
        }}
        title="Cambiar mesa"
        isDismissable={!busy}
      >
        {contextAttempted && saveError && (
          <Alert kind="error" title={saveError} />
        )}
        <PosTablePicker
          {...tableOptions}
          tableId={contextTableId}
          name={contextTable}
          hideOccupied
          orderId={order?.id}
          disabled={busy || conflict}
          onChange={(id, name) => {
            setContextTableId(id);
            setContextTable(name);
          }}
        />
        <div className="mt-4 flex justify-end gap-3">
          <Button
            variant="secondary"
            isDisabled={busy}
            onPress={() => setContextOpen(false)}
          >
            Cancelar
          </Button>
          <Button
            isDisabled={
              busy ||
              conflict ||
              !contextTable.trim() ||
              contextTable.trim().length > 60 ||
              (contextTableId === (baseline?.tableId ?? null) &&
                contextTable.trim() === baseline?.tableLabel.trim()) ||
              !tableOptions.tables ||
              (!!tableOptions.tables.length && !contextTableId) ||
              tableUnavailable(tableOptions.tables, contextTableId, order?.id)
            }
            isLoading={busy && contextAttempted}
            onPress={() => void saveTable()}
          >
            Guardar
          </Button>
        </div>
      </Dialog>
      <Dialog
        isOpen={actionsOpen}
        onOpenChange={setActionsOpen}
        title="Acciones de la orden"
        headerAction={
          <Button
            variant="quiet"
            aria-label="Cerrar acciones de la orden"
            className="close-module size-11 shrink-0 rounded-full! bg-primary-soft! p-0!"
            onPress={() => setActionsOpen(false)}
          >
            <Xmark aria-hidden="true" className="size-6" />
          </Button>
        }
      >
        <div className="grid gap-3">
          <Button
            variant="secondary"
            isDisabled={busy || conflict}
            onPress={() => {
              setActionsOpen(false);
              setNoteText(note);
              setNoteOpen(true);
            }}
          >
            <Notes aria-hidden="true" className="size-5" />
            {note ? "Editar nota" : "Añadir nota"}
          </Button>
          {order && (
            <Button
              variant="secondary"
              isDisabled={busy || dirty || conflict || !lines.length}
              onPress={() => {
                setActionsOpen(false);
                onScan();
              }}
            >
              <QrCode aria-hidden="true" className="size-5" />
              Escanear QR
            </Button>
          )}
          {order && printing.enabled && (
            <Button
              variant="secondary"
              isDisabled={
                busy ||
                dirty ||
                conflict ||
                !lines.length ||
                !printing.ready ||
                printing.busy
              }
              isLoading={printing.busy}
              onPress={() => {
                setActionsOpen(false);
                printing.print();
              }}
            >
              <Printer aria-hidden="true" className="size-5" />
              Imprimir pedido
            </Button>
          )}
          {order && dirty && (
            <Text variant="muted">
              Guarda los cambios antes de escanear, imprimir o anular.
            </Text>
          )}
          {order && (
            <div className="mt-2 border-t border-border pt-4">
              <Button
                variant="danger"
                fullWidth
                isDisabled={busy || dirty || conflict}
                onPress={() => {
                  setActionsOpen(false);
                  onVoid();
                }}
              >
                <Trash aria-hidden="true" className="size-5" />
                Anular
              </Button>
            </div>
          )}
        </div>
      </Dialog>
      <Dialog
        isOpen={reviewOpen}
        onOpenChange={setReviewOpen}
        title="Revisar conflicto"
        description="Compara tus cambios con el pedido guardado. Usar la versión actual descarta tu borrador."
      >
        <div className="grid gap-4">
          <div>
            <Heading level={3}>Tus cambios · {table}</Heading>
            <Text className="whitespace-pre-wrap wrap-anywhere">
              Nota: {note || "Sin nota"}
            </Text>
            {lines.map((line) => (
              <Text key={line.key}>
                {line.quantity} × {line.name} ·{" "}
                {formatMoney(line.unitPrice * line.quantity, currencyCode)}
              </Text>
            ))}
          </div>
          <div>
            <Heading level={3}>Versión actual · {order?.tableLabel}</Heading>
            <Text className="whitespace-pre-wrap wrap-anywhere">
              Nota: {order?.note || "Sin nota"}
            </Text>
            {order?.items.map((line) => (
              <Text key={line.lineId}>
                {line.quantity} × {line.name} ·{" "}
                {formatMoney(Number(line.lineTotal), currencyCode)}
              </Text>
            ))}
          </div>
          <Button
            onPress={() => {
              if (order) apply(order);
            }}
          >
            Usar versión actual
          </Button>
          <Button variant="secondary" onPress={() => setReviewOpen(false)}>
            Conservar mi borrador
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
