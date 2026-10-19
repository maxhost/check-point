"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Dialog, Heading, Text } from "../../../ui";
import type {
  PosHistoryV2,
  PosLocationV2,
  PosOrderV2,
  PosCatalogV2,
  SaleType,
} from "../contracts";
import {
  DiscardedPosRead,
  detailKey,
  historyKey,
  tablesKey,
  catalogKey,
} from "./pos-cache";
import type { PosTable } from "./pos-tables";
import {
  DiscardedPosIntent,
  usePosContext,
  type PosClient,
} from "./pos-context";
import { PosError, orderUrl } from "./pos-types";
import { MeasuredEditorSession } from "./measured-editor-model";
import { MeasuredPosEditor } from "./measured-pos-editor";
import { MeasuredPaymentSession } from "./measured-payment-session";
import { MeasuredCheckout } from "./measured-checkout";
import { MeasuredScan } from "./measured-scan";
import { MeasuredOrderCache } from "./measured-order-cache";
import { MeasuredOrderList } from "./measured-order-list";
import { MeasuredTicket } from "./measured-ticket";
import { useMeasuredPrinting } from "./measured-printing";
import {
  useMeasuredVoidAction,
  retireMeasuredVoidIdentity,
} from "./measured-void-action";
import type { MeasuredEditorContext } from "./measured-editor-model";
import { MeasuredNewOrderDialog } from "./measured-new-order-dialog";
import type { EditorCustomerSelection } from "./measured-customer-model";

export function MeasuredConsole({ locations }: { locations: PosLocationV2[] }) {
  const scope = usePosContext({ contractVersion: 2 });
  const session = scope.session;
  const retained = useRef<{
    identity: string;
    context: MeasuredEditorContext;
    timeZone: string;
  } | null>(null);
  const ready =
    scope.present &&
    !scope.loading &&
    session?.authenticated &&
    session.business?.status === "active" &&
    session.membership?.status === "active" &&
    session.business.enabledModules.includes("pos") &&
    session.membership.permissions.includes("pos");
  if (ready && scope.identity && session?.business)
    retained.current = {
      identity: scope.identity,
      timeZone: session.business.timezone,
      context: {
        identity: scope.identity,
        locations,
        currencyCode: session.business.currencyCode,
        saleTypes: ["counter", "table", "pickup", "delivery"],
        tablesEnabled: session.business.enabledModules.includes("tables"),
      },
    };
  const current = retained.current;
  useEffect(() => {
    if (current && current.identity !== scope.identity)
      retireMeasuredVoidIdentity(current.identity);
  }, [current, scope.identity]);
  if (!current || current.identity !== scope.identity)
    return (
      <Alert
        kind="warning"
        title={
          scope.loading
            ? "Cargando tu contexto…"
            : "No tienes acceso al punto de venta."
        }
      />
    );
  return (
    <MeasuredConsoleContent
      key={current.identity}
      client={scope.client}
      context={current.context}
      timeZone={current.timeZone}
      accessEnabled={!!ready}
    />
  );
}

/** Sessions and the canonical cache outlive every child view. */
export function MeasuredConsoleContent({
  client: sourceClient,
  context,
  timeZone,
  accessEnabled = true,
}: {
  client: PosClient;
  context: MeasuredEditorContext;
  timeZone: string;
  accessEnabled?: boolean;
}) {
  const [denied, setDenied] = useState(false);
  const accessCurrent = useRef(accessEnabled && !denied);
  accessCurrent.current = accessEnabled && !denied;
  const client = useMemo<PosClient>(() => {
    const wrap =
      (request: PosClient["request"]): PosClient["request"] =>
      async (url, method, body) => {
        try {
          return await request(url, method, body);
        } catch (cause) {
          if (cause instanceof PosError && cause.status === 403)
            setDenied(true);
          throw cause;
        }
      };
    return {
      request: wrap(sourceClient.request),
      capture: () => wrap(sourceClient.capture()),
    };
  }, [sourceClient]);
  const { owner: voidAction, state: voidState } = useMeasuredVoidAction(
    context.identity,
    timeZone,
  );
  const cache = voidAction.cache;
  const [confirmVoid, setConfirmVoid] = useState(false);
  const [newOrderLocation, setNewOrderLocation] = useState<string | null>(null);
  const editors = useRef(new Set<MeasuredEditorSession>());
  const payments = useRef(new Map<string, MeasuredPaymentSession>());
  const customerSelections = useRef(new Map<string, EditorCustomerSelection>());
  const active = useRef(true);
  const navigation = useRef(0);
  const [editor, setEditor] = useState<MeasuredEditorSession | null>(null);
  const [payment, setPayment] = useState<MeasuredPaymentSession | null>(null);
  const [order, setOrder] = useState<PosOrderV2 | null>(() => voidState.order);
  const [view, setView] = useState<"list" | "edit" | "detail" | "result">(
    voidState.order ? "detail" : "list",
  );
  const [history, setHistory] = useState<PosHistoryV2 | null>(() =>
    cache.peek(historyKey, true),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, redraw] = useState(0);
  useEffect(() => {
    active.current = true;
    const ownedEditors = editors.current,
      ownedPayments = payments.current;
    return () => {
      active.current = false;
      navigation.current++;
      // React development probes clean up and immediately set up the same owner.
      // A real withdrawal remains inactive after the microtask boundary.
      queueMicrotask(() => {
        if (active.current) return;
        ownedEditors.forEach((s) => s.retireIdentity());
        ownedPayments.forEach((s) => s.retireIdentity());
        if (voidAction.canLeave) cache.clear();
      });
    };
  }, [cache, voidAction]);
  const handleError = useCallback((cause: unknown) => {
    if (
      !active.current ||
      cause instanceof DiscardedPosRead ||
      cause instanceof DiscardedPosIntent
    )
      return;
    setError(
      cause instanceof Error
        ? cause.message
        : "No pudimos completar la acción. Reintenta.",
    );
    if (cause instanceof PosError && [401, 403].includes(cause.status ?? 0))
      setDenied(true);
  }, []);
  const load = useCallback(
    async (force = false) => {
      setLoading(true);
      setError(null);
      try {
        const result = await cache.read<PosHistoryV2>(
          historyKey,
          () => client.request("/api/modules/pos/orders"),
          force,
        );
        if (active.current) {
          setHistory(result);
          setDenied(voidAction.getSnapshot().phase === "retired");
        }
      } catch (cause) {
        handleError(cause);
      } finally {
        if (active.current) setLoading(false);
      }
    },
    [cache, client, handleError, voidAction],
  );
  useEffect(() => {
    if (voidAction.canLeave) void load();
  }, [load, voidAction]);
  useEffect(() => {
    if (voidState.error) handleError(voidState.error);
    if (voidState.phase === "retired") setDenied(true);
    if (voidState.phase === "confirmed" || voidState.phase === "idle") {
      if (voidState.order || voidState.error) {
        setOrder(voidState.order);
        setView(voidState.order ? "detail" : "list");
      }
      setHistory(cache.peek(historyKey, true));
    }
  }, [voidState, cache, handleError]);
  const printing = useMeasuredPrinting({
    order: view === "detail" || view === "result" ? order : null,
    client,
    context: accessEnabled && !denied ? context.identity : null,
    prepare: !!history && accessEnabled && !denied,
    onError: handleError,
  });
  const blocked =
    !accessEnabled ||
    denied ||
    loading ||
    !voidAction.canLeave ||
    !!editor?.blocked ||
    [...payments.current.values()].some((s) => !s.canLeave);
  const tableLocations = JSON.stringify(context.locations.map((l) => l.id));
  useEffect(() => {
    if (view !== "list" || !accessEnabled || denied) return;
    let current = true;
    for (const locationId of JSON.parse(tableLocations) as string[]) {
      void cache
        .read<PosCatalogV2>(catalogKey(locationId), () =>
          client.request(
            `/api/modules/pos/catalog?locationId=${encodeURIComponent(locationId)}`,
          ),
        )
        .catch((cause) => {
          if (current) handleError(cause);
        });
      if (!context.tablesEnabled) continue;
      void cache
        .read<{ tables: PosTable[] }>(tablesKey(locationId), () =>
          client.request(
            `/api/modules/pos/tables?locationId=${encodeURIComponent(locationId)}`,
          ),
        )
        .catch((cause) => {
          if (current) handleError(cause);
        });
    }
    return () => {
      current = false;
    };
  }, [
    view,
    context.tablesEnabled,
    accessEnabled,
    denied,
    tableLocations,
    cache,
    client,
    handleError,
  ]);
  function syncHistory() {
    setHistory(cache.peek<PosHistoryV2>(historyKey, true));
  }
  function selectEditor(
    value: PosOrderV2 | null,
    locationId?: string,
    initialSaleType?: Exclude<SaleType, "legacy">,
    initialIdentification?: MeasuredEditorContext["initialIdentification"],
  ) {
    const next = new MeasuredEditorSession(
      {
        ...context,
        lastLocationId: locationId,
        initialSaleType,
        initialIdentification,
      },
      cache,
      client,
      value,
    );
    editors.current.add(next);
    if (value) {
      const pendingCustomer = customerSelections.current.get(value.id);
      const paymentCustomer = payments.current.get(value.id)?.getSnapshot();
      if (pendingCustomer) next.customer.adopt(pendingCustomer);
      else if (paymentCustomer)
        next.customer.adopt({
          resolved: paymentCustomer.resolved,
          excluded: paymentCustomer.excluded,
        });
    }
    setEditor(next);
    setOrder(value);
    setView("edit");
  }
  async function loadProducts(id: string): Promise<PosOrderV2["items"]> {
    try {
      if (blocked || !active.current) throw new DiscardedPosIntent();
      const captured = client.capture();
      const epoch = cache.epoch;
      const result = await cache.read<PosOrderV2>(detailKey(id), () =>
        captured(orderUrl(id)),
      );
      if (
        !active.current ||
        !accessCurrent.current ||
        cache.epoch !== epoch ||
        cache.context !== context.identity ||
        voidAction.getSnapshot().phase === "retired"
      )
        throw new DiscardedPosRead();
      return result.items;
    } catch (cause) {
      handleError(cause);
      throw cause;
    }
  }
  async function open(id: string) {
    if (blocked || (editor && !editor.requestExit())) return;
    const token = ++navigation.current;
    setLoading(true);
    setError(null);
    try {
      const result = await cache.read<PosOrderV2>(detailKey(id), () =>
        client.request(orderUrl(id)),
      );
      if (!active.current || token !== navigation.current) return;
      setOrder(result);
      setEditor(null);
      setPayment(payments.current.get(id) ?? null);
      setView("detail");
    } catch (cause) {
      handleError(cause);
    } finally {
      if (active.current && token === navigation.current) setLoading(false);
    }
  }
  function prepare(value: PosOrderV2) {
    if (
      !voidAction.canLeave ||
      !accessEnabled ||
      denied ||
      value.status !== "open" ||
      !value.items.length
    )
      return;
    let current = payments.current.get(value.id);
    if (current && current.getSnapshot().order.version !== value.version) {
      if (!current.canLeave) return;
      current.retireIdentity();
      payments.current.delete(value.id);
      current = undefined;
    }
    if (!current) {
      current = new MeasuredPaymentSession(client, cache, {
        order: value,
        historyStatus: "active",
        onClosed: (result) => {
          if (active.current) {
            new MeasuredOrderCache(cache, "active").accept(result, {
              historyWindow: { timeZone, now: new Date() },
            });
            setOrder(result);
            setView("result");
            syncHistory();
          }
        },
        onReview: (result) => {
          if (active.current) {
            current?.acceptReviewedOrder(result);
            setOrder(result);
            setView("detail");
          }
        },
      });
      payments.current.set(value.id, current);
      current.subscribe(() => {
        if (active.current) redraw((n) => n + 1);
      });
    }
    const selectedCustomer = customerSelections.current.get(value.id);
    if (selectedCustomer && current.acceptEditorCustomer(selectedCustomer))
      customerSelections.current.delete(value.id);
    setPayment(current);
    setOrder(value);
    setView("detail");
    void current.prepare();
  }
  const paymentState = payment?.getSnapshot();
  return (
    <>
      <div className="w-full px-3 pt-3 md:px-4">
        <Text variant="small">Vista previa local del punto de venta.</Text>
      </div>
      {error && <Alert kind="error" title={error} />}
      {(denied || !accessEnabled) && (
        <Alert
          kind="error"
          title="Tu acceso cambió. Revisa tu contexto antes de continuar."
        >
          <Button
            variant="secondary"
            isDisabled={loading || !accessEnabled}
            onPress={() => void load(true)}
          >
            Comprobar acceso
          </Button>
        </Alert>
      )}
      {loading && (
        <div role="status" className="p-4">
          <Text>Cargando pedidos…</Text>
        </div>
      )}
      {view === "list" &&
        (history ? (
          <MeasuredOrderList
            history={history}
            currencyCode={context.currencyCode}
            locations={context.locations}
            disabled={blocked}
            onOpen={(id) => void open(id)}
            onLoadProducts={loadProducts}
            onNew={(locationId) => {
              if (!blocked) selectEditor(null, locationId);
            }}
            onChooseNew={(locationId) => {
              if (!blocked) setNewOrderLocation(locationId);
            }}
            onRefresh={() => {
              if (context.tablesEnabled) {
                for (const location of context.locations) {
                  const key = tablesKey(location.id);
                  cache.invalidate(key);
                  void cache
                    .read<{ tables: PosTable[] }>(key, () =>
                      client.request(
                        `/api/modules/pos/tables?locationId=${encodeURIComponent(location.id)}`,
                      ),
                    )
                    .catch(handleError);
                }
              }
              void load(true);
            }}
          />
        ) : (
          !loading && (
            <Button isDisabled={denied} onPress={() => void load()}>
              Reintentar listado
            </Button>
          )
        ))}
      {view === "edit" && editor && (
        <MeasuredPosEditor
          session={editor}
          onAccessError={handleError}
          onSaved={(value) => {
            customerSelections.current.set(value.id, editor.customer.selection);
            setOrder(value);
            syncHistory();
          }}
          onPrepare={prepare}
          onExit={() => {
            if (!blocked && editor.requestExit(true)) {
              setEditor(null);
              setView("list");
              syncHistory();
            }
          }}
        />
      )}
      {(view === "detail" || view === "result") && order && (
        <section
          aria-label={
            view === "result" ? "Resultado de la venta" : "Detalle del pedido"
          }
          className="grid w-full min-w-0 max-w-none gap-5 p-3 md:p-4"
        >
          <Heading level={1}>
            {view === "result" ? "Venta completada" : order.orderLabel}
          </Heading>
          <Text variant="label">
            Total: {order.business.currencyCode}{" "}
            {order.settlement?.collected ?? order.sale?.total ?? order.total}
          </Text>
          {order.items.map((line) => (
            <Text key={line.lineId}>
              {line.name} · {line.quantity} {line.measure.quantityUnit} ·{" "}
              {line.lineTotal}
            </Text>
          ))}
          {order.note && <Text>{order.note}</Text>}
          <div className="flex flex-wrap gap-3">
            {order.status === "open" && (
              <>
                <Button
                  isDisabled={blocked || !order.items.length}
                  onPress={() => prepare(order)}
                >
                  Cobrar
                </Button>
                <Button
                  variant="danger"
                  isDisabled={blocked}
                  onPress={() => setConfirmVoid(true)}
                >
                  Anular pedido
                </Button>
                <Button
                  variant="secondary"
                  isDisabled={blocked}
                  onPress={() => selectEditor(order)}
                >
                  Editar pedido
                </Button>
              </>
            )}
            <Button
              variant="secondary"
              isDisabled={blocked}
              onPress={() => {
                if (!blocked) {
                  setEditor(null);
                  setView("list");
                  syncHistory();
                }
              }}
            >
              Volver al listado
            </Button>
          </div>
          {accessEnabled && !denied && (
            <MeasuredTicket order={order} printing={printing} />
          )}
        </section>
      )}
      <MeasuredNewOrderDialog
        key={newOrderLocation ?? "closed"}
        isOpen={newOrderLocation !== null && view === "list" && !blocked}
        initialLocationId={newOrderLocation ?? ""}
        context={context}
        client={client}
        cache={cache}
        disabled={blocked}
        onClose={() => setNewOrderLocation(null)}
        onError={handleError}
        onContinue={(details) => {
          if (blocked || newOrderLocation === null) return;
          setNewOrderLocation(null);
          selectEditor(null, details.locationId, details.saleType, {
            tableId: details.tableId,
            orderLabel: details.orderLabel,
          });
        }}
      />
      <Dialog
        title="Anular pedido"
        isOpen={confirmVoid}
        onOpenChange={setConfirmVoid}
        description={`¿Quieres anular ${order?.orderLabel}? Ya no podrás editar ni cobrar este pedido.`}
      >
        <div className="mt-4 flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onPress={() => setConfirmVoid(false)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            isDisabled={blocked}
            onPress={() => {
              if (blocked || !order) return;
              setConfirmVoid(false);
              void voidAction.confirm(order);
            }}
          >
            Confirmar anulación
          </Button>
        </div>
      </Dialog>
      {voidState.phase === "uncertain" && (
        <Alert
          kind="warning"
          title="No pudimos confirmar la anulación. Conservamos el mismo intento; recupéralo antes de salir o cambiar de pedido."
        >
          <Button
            isDisabled={denied || !accessEnabled}
            onPress={() => void voidAction.retry()}
          >
            Reintentar la misma anulación
          </Button>
        </Alert>
      )}
      {voidState.phase === "review" && (
        <Alert
          kind="warning"
          title="El pedido cambió. Revisa su estado actual antes de continuar."
        >
          <Button
            isDisabled={denied || !accessEnabled}
            onPress={() => void voidAction.review()}
          >
            Revisar orden actual
          </Button>
        </Alert>
      )}
      {payment && accessEnabled && !denied && (
        <>
          <MeasuredCheckout session={payment} />
          <MeasuredScan session={payment} />
        </>
      )}
      {paymentState?.phase === "closeUncertain" && denied && (
        <Alert
          kind="warning"
          title="Conservamos el intento de cobro pendiente. Recupera tu acceso antes de continuar."
        />
      )}
    </>
  );
}
