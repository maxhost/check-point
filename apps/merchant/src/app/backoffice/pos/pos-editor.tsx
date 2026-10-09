"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  EditPencil as Pen,
  MoreVert,
  NavArrowLeft,
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
  TextField,
} from "../../../ui";
import { catalogKey, DiscardedPosRead, PosCache } from "./pos-cache";
import { ConfirmationToast } from "../../components/confirmation-toast";
import { DetailedSale } from "../counter/sale-forms";
import { formatMoney } from "../counter/types";
import { PosCoupon } from "./pos-coupon";
import type { PosPayment } from "./pos-payment";
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

function signature(table: string, location: string, lines: DraftLine[]) {
  return JSON.stringify([table.trim(), location, linePayload(lines)]);
}
export function PosEditor({
  order,
  cache,
  catalogRevision,
  locations,
  currencyCode,
  busy,
  onSave,
  onCancel,
  onError,
  onCheckout,
  onScan,
  payment,
  onVoid,
  lastLocationId,
}: {
  order: PosOrder | null;
  cache: PosCache;
  catalogRevision: number;
  locations: PosLocation[];
  currencyCode: string;
  busy: boolean;
  onSave: (body: unknown) => Promise<PosOrder | null>;
  onCancel: () => void;
  onError: (error: unknown) => void;
  onCheckout: () => void;
  onScan: () => void;
  payment: PosPayment;
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
  const [table, setTable] = useState(order?.tableLabel ?? "");
  const [locationId, setLocationId] = useState(initialLocation);
  const [lines, setLines] = useState<DraftLine[]>(() =>
    order ? draftItems(order) : [],
  );
  const [baseline, setBaseline] = useState(order);
  const [baselineSignature, setBaselineSignature] = useState(() =>
    signature(
      order?.tableLabel ?? "",
      initialLocation,
      order ? draftItems(order) : [],
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
  const [updatedNotice, setUpdatedNotice] = useState(false);
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
  const [actionsOpen, setActionsOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const allowExit = useRef(false);
  const scrollPositions = useRef({ table: 0, products: 0, order: 0 });
  const dirty = signature(table, locationId, lines) !== baselineSignature;
  const conflict = !!order && !!baseline && order.version !== baseline.version;
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  const total =
    lines.reduce(
      (sum, line) => sum + Math.round(line.unitPrice * 100) * line.quantity,
      0,
    ) / 100;
  const money = formatMoney(total, currencyCode);
  const locationName =
    locations.find((l) => l.id === locationId)?.name ?? order?.location?.name;
  const contextInvalid = !table.trim()
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
    setLocationId(nextLocation);
    setLines(nextLines);
    setBaseline(current);
    setBaselineSignature(
      signature(current.tableLabel, nextLocation, nextLines),
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
    if (!order && next !== "table" && (contextInvalid || !catalog)) return;
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
    setUpdatedNotice(false);
    const result = await onSave({
      ...(order ? { version: baseline!.version } : {}),
      tableLabel: table.trim(),
      ...(locationId ? { locationId } : {}),
      items: linePayload(lines),
    });
    if (!result) return;
    apply(result);
    if (exitAfter) leave();
    else {
      changeSurface("order");
      if (order) setUpdatedNotice(true);
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
    <div className="grid gap-3">
      <TextField
        label="Nombre de mesa"
        value={table}
        onChange={setTable}
        maxLength={60}
        isRequired
        isDisabled={busy || conflict}
        placeholder="Ej.: Mesa 4"
      />
    </div>
  );
  return (
    <div
      className={`grid min-w-0 gap-4 ${order ? (surface === "products" ? (dirty ? "pb-24" : "pb-4") : "pb-44") : surface === "products" ? "pb-24" : "pb-36"} md:pb-0 print:hidden`}
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
        {order ? (
          <Button
            variant="quiet"
            aria-label="Más acciones"
            aria-haspopup="dialog"
            aria-expanded={actionsOpen}
            className="close-module size-11 shrink-0 rounded-full! bg-primary-soft! p-0!"
            isDisabled={busy}
            onPress={() => setActionsOpen(true)}
          >
            <MoreVert aria-hidden="true" className="size-6" />
          </Button>
        ) : surface === "table" ? (
          <div aria-hidden="true" className="size-11 shrink-0" />
        ) : null}
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
            {locations.length === 1 && locationName && (
              <Text variant="small">{locationName}</Text>
            )}
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
            onQty={(id, delta) =>
              setLines((current) => productQuantity(current, id, delta))
            }
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
      <div
        className={
          order && surface === "products" && !dirty
            ? "hidden"
            : "counter-detailed-footer grid gap-2 bg-surface md:static md:w-full md:translate-x-0"
        }
      >
        {order && surface === "products" ? (
          dirty && (
            <>
              {invalid && <Text variant="small">{invalid}</Text>}
              <div className="flex items-center gap-3">
                <Button
                  className="h-12 min-w-0 flex-1"
                  isLoading={busy}
                  isDisabled={!!invalid || conflict}
                  onPress={() => void save()}
                >
                  Guardar cambios
                </Button>
                <Button
                  variant="danger"
                  aria-label="Descartar cambios"
                  className="size-12 shrink-0 rounded-full! p-0!"
                  isDisabled={busy}
                  onPress={() => setDiscardOpen(true)}
                >
                  <Xmark aria-hidden="true" className="size-6" />
                </Button>
              </div>
            </>
          )
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
              <Button
                variant="quiet"
                aria-label="QR"
                onPress={onScan}
                className="close-module size-12 shrink-0 rounded-full! bg-primary-soft! p-0!"
                isDisabled={busy || dirty || conflict || !lines.length}
              >
                <QrCode aria-hidden="true" className="size-6" />
              </Button>
              <Button
                variant="quiet"
                aria-label="Imprimir"
                className="close-module size-12 shrink-0 rounded-full! bg-primary-soft! p-0!"
                isDisabled={busy}
              >
                <Printer aria-hidden="true" className="size-6" />
              </Button>
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
          <Button
            fullWidth
            isDisabled={busy}
            onPress={() => changeSurface("order")}
          >
            Revisar pedido
          </Button>
        ) : (
          <>
            {invalid && <Text variant="small">{invalid}</Text>}
            <Button
              fullWidth
              isLoading={busy}
              isDisabled={!!invalid}
              onPress={() => void save()}
            >
              Guardar pedido
            </Button>
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
        message={updatedNotice ? "Pedido actualizado" : null}
        onDismiss={() => setUpdatedNotice(false)}
      />
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
              setUpdatedNotice(false);
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
        onOpenChange={setContextOpen}
        title="Cambiar mesa"
        isDismissable={!busy}
      >
        <TextField
          label="Nombre de mesa"
          value={contextTable}
          onChange={setContextTable}
          maxLength={60}
          isRequired
          isDisabled={busy || conflict}
          placeholder="Ej.: Mesa 4"
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
            isDisabled={busy || conflict || !contextTable.trim()}
            onPress={() => {
              setTable(contextTable.trim());
              setContextOpen(false);
            }}
          >
            Listo
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
          {dirty && (
            <Text variant="muted">Guarda los cambios antes de anular.</Text>
          )}
          <Button
            variant="danger"
            isDisabled={busy || dirty || conflict}
            onPress={() => {
              setActionsOpen(false);
              onVoid();
            }}
          >
            Anular
          </Button>
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
            {lines.map((line) => (
              <Text key={line.key}>
                {line.quantity} × {line.name} ·{" "}
                {formatMoney(line.unitPrice * line.quantity, currencyCode)}
              </Text>
            ))}
          </div>
          <div>
            <Heading level={3}>Versión actual · {order?.tableLabel}</Heading>
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
