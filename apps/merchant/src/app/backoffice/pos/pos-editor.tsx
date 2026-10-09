"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Xmark } from "iconoir-react";
import {
  Alert,
  Button,
  ConfirmDialog,
  Dialog,
  Heading,
  SelectField,
  SegmentedControl,
  Text,
  TextField,
} from "../../../ui";
import { catalogKey, DiscardedPosRead, PosCache } from "./pos-cache";
import { DetailedSale } from "../counter/sale-forms";
import { formatMoney } from "../counter/types";
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
  onVoid,
  lastLocationId,
  onLocationChange,
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
  onVoid: () => void;
  lastLocationId: string;
  onLocationChange: (id: string) => void;
}) {
  const router = useRouter();
  const initialLocation =
    order?.location?.id ??
    (locations.length === 1
      ? locations[0].id
      : locations.some((l) => l.id === lastLocationId)
        ? lastLocationId
        : "");
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
  const [catalogStarted, setCatalogStarted] = useState(false);
  const [removedLines, setRemovedLines] = useState<
    { line: DraftLine; index: number }[]
  >([]);
  const [exitTarget, setExitTarget] = useState<string | null>(null);
  const [contextOpen, setContextOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<string | null>(null);
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
      : locations.length > 1 && !locationId
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
    if (!catalogStarted || (locations.length > 1 && !locationId)) return;
    void cache
      .catalog(locationId)
      .then((data) => {
        if (active) setCatalog(data);
      })
      .catch((error) => {
        if (error instanceof DiscardedPosRead) return;
        if (active) setCatalogError(error.message);
        if (
          active ||
          (error instanceof PosError && [401, 403].includes(error.status ?? 0))
        )
          onError(error);
      });
    return () => {
      active = false;
    };
  }, [
    cache,
    catalogRevision,
    catalogStarted,
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
    if (!order && next !== "table" && contextInvalid) return;
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
    const result = await onSave({
      ...(order ? { version: baseline!.version } : {}),
      tableLabel: table.trim(),
      ...(locationId ? { locationId } : {}),
      items: linePayload(lines),
    });
    if (!result) return;
    apply(result);
    if (exitAfter) leave();
    else changeSurface("order");
  }
  function selectLocation(id: string) {
    if (id === locationId) return;
    if (lines.length) {
      setContextOpen(false);
      setPendingLocation(id);
    } else {
      setLocationId(id);
      onLocationChange(id);
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
    <div className={`grid gap-3 ${locations.length > 1 ? "grid-cols-2" : ""}`}>
      <TextField
        label="Nombre de mesa"
        value={table}
        onChange={setTable}
        maxLength={60}
        isRequired
        isDisabled={busy || conflict}
        placeholder="Ej.: Mesa 4"
      />
      {locations.length > 1 ? (
        <SelectField
          label="Local"
          selectedKey={locationId || null}
          options={locations.map((l) => ({ id: l.id, label: l.name }))}
          onSelectionChange={(key) => selectLocation(String(key ?? ""))}
          isDisabled={busy || conflict}
        />
      ) : null}
    </div>
  );
  return (
    <div
      className={`grid min-w-0 gap-4 ${order ? "pb-44" : surface === "products" ? "pb-24" : "pb-36"} md:pb-0 print:hidden`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="grid min-w-0 gap-1">
          <Heading level={1}>{order ? table : stepTitle}</Heading>
          <Text variant="muted">
            {order ? "Orden abierta" : `Paso ${step} de 3`}
            {!order && surface !== "table" ? ` · ${table}` : ""}
            {locationName ? ` · ${locationName}` : ""}
          </Text>
          {order && (
            <Text variant={dirty ? "label" : "small"}>
              {conflict
                ? "Conflicto: revisa la versión actual"
                : dirty
                  ? "Cambios sin guardar"
                  : "Guardada"}
            </Text>
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
          contextFields
        ) : (
          <Button
            variant="quiet"
            isDisabled={busy}
            onPress={() =>
              changeSurface(surface === "order" ? "products" : "table")
            }
          >
            {surface === "order" ? "Volver a tomar pedido" : "Volver a mesa"}
          </Button>
        )
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="quiet"
            isDisabled={busy || conflict}
            onPress={() => setContextOpen(true)}
          >
            Mesa y local
          </Button>
          <Button
            variant="quiet"
            isDisabled={busy}
            onPress={() => setActionsOpen(true)}
          >
            Más acciones
          </Button>
        </div>
      )}
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
        <SegmentedControl
          aria-label="Vista del pedido"
          selectedKey={surface}
          onSelectionChange={(key) => changeSurface(key as typeof surface)}
          isDisabled={busy}
          options={[
            { id: "products", label: "Productos" },
            { id: "order", label: `Pedido (${count})` },
          ]}
        />
      )}
      <div className={surface === "products" ? "min-w-0" : "hidden"}>
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
            showPrices={!!order}
            compactSearch={!order}
            allowPriceInput={false}
            onAdd={(p) => setLines((current) => addProduct(current, p))}
            onQty={(id, delta) =>
              setLines((current) => productQuantity(current, id, delta))
            }
            onLinePrice={() => {}}
            onRepeat={() => {}}
          />
        )}
      </div>
      <div className={surface === "order" ? "grid gap-4" : "hidden"}>
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
            onAdd={(p) => setLines((current) => addProduct(current, p))}
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
        {order && <Text variant="label">Total: {money}</Text>}
      </div>
      <div className="counter-detailed-footer grid gap-2 bg-surface md:static md:w-full md:translate-x-0">
        {order ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <Text variant="small">{count} artículos</Text>
              <Text variant="label">{money}</Text>
            </div>
            {invalid && <Text variant="small">{invalid}</Text>}
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="secondary"
                fullWidth
                isDisabled={busy}
                onPress={() =>
                  changeSurface(surface === "order" ? "products" : "order")
                }
              >
                {surface === "order" ? "Añadir productos" : "Ver pedido"}
              </Button>
              {!order || dirty ? (
                <Button
                  fullWidth
                  isLoading={busy}
                  isDisabled={!!invalid || conflict}
                  onPress={() => void save()}
                >
                  {order ? "Guardar cambios" : "Guardar orden"}
                </Button>
              ) : (
                <Button
                  fullWidth
                  isDisabled={busy || conflict || !lines.length}
                  onPress={onCheckout}
                >
                  Cobrar
                </Button>
              )}
            </div>
          </>
        ) : surface === "table" ? (
          <>
            {contextInvalid && <Text variant="small">{contextInvalid}</Text>}
            <Button
              fullWidth
              isDisabled={busy || !!contextInvalid}
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
              isDisabled={busy || !!contextInvalid}
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
        title="Mesa y local"
        isDismissable={!busy}
      >
        {contextFields}
        <div className="mt-4">
          <Button onPress={() => setContextOpen(false)}>Listo</Button>
        </div>
      </Dialog>
      <ConfirmDialog
        isOpen={pendingLocation !== null}
        title="¿Cambiar el local del pedido?"
        description="Los productos y precios que ya añadiste se conservan. Los próximos productos usarán el catálogo del nuevo local."
        confirmLabel="Cambiar local"
        isBusy={busy}
        onCancel={() => setPendingLocation(null)}
        onConfirm={() => {
          const id = pendingLocation!;
          setLocationId(id);
          onLocationChange(id);
          setPendingLocation(null);
        }}
      />
      <Dialog
        isOpen={actionsOpen}
        onOpenChange={setActionsOpen}
        title="Acciones de la orden"
      >
        <div className="grid gap-3">
          {dirty && (
            <Text variant="muted">
              Guarda los cambios antes de imprimir o anular.
            </Text>
          )}
          <Button
            variant="secondary"
            isDisabled={busy || dirty || conflict}
            onPress={() => {
              setActionsOpen(false);
              requestAnimationFrame(() => window.print());
            }}
          >
            Imprimir precuenta
          </Button>
          <Button
            variant="quiet"
            className="text-danger!"
            isDisabled={busy || dirty || conflict}
            onPress={() => {
              setActionsOpen(false);
              onVoid();
            }}
          >
            Anular
          </Button>
          {order && (
            <Text variant="small">
              {new Date(order.createdAt).toLocaleString("es-EC")} ·{" "}
              {order.createdBy}
            </Text>
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
