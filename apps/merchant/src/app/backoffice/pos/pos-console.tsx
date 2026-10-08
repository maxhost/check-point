"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  ConfirmDialog,
  Heading,
  PageHeader,
  Text,
} from "../../../ui";
import { formatMoney } from "../counter/types";
import { DiscardedPosRead, historyKey, detailKey, PosCache } from "./pos-cache";
import { PosEditor } from "./pos-editor";
import { PosCheckout } from "./pos-checkout";
import { PosResult, PosTicket } from "./pos-ticket";
import {
  orderUrl,
  PosError,
  posRequest,
  type PosHistory,
  type PosLocation,
  type PosOrder,
  type PosSession,
} from "./pos-types";
export function PosConsole({ locations }: { locations: PosLocation[] }) {
  const [session, setSession] = useState<PosSession | null>(null);
  const [history, setHistory] = useState<PosHistory | null>(null);
  const [cache] = useState(() => new PosCache());
  const selected = useRef<PosOrder | null>(null);
  const [order, setOrderState] = useState<PosOrder | null>(null);
  const setOrder = useCallback((value: PosOrder | null) => {
    selected.current = value;
    setOrderState(value);
  }, []);
  const [view, setViewState] = useState<
    "list" | "edit" | "detail" | "checkout"
  >("list");
  const viewRef = useRef(view);
  const setView = useCallback((value: typeof view) => {
    viewRef.current = value;
    setViewState(value);
  }, []);
  const navigation = useRef(0);
  const loading = useRef(0);
  const [opening, setOpening] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [catalogRevision, setCatalogRevision] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [working, setBusy] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const busy = working || recovering;
  const [confirmVoid, setConfirmVoid] = useState(false);
  const locked = useRef(false);
  const handleError = useCallback(
    (cause: unknown, id?: string) => {
      if (cause instanceof DiscardedPosRead) return;
      setError(
        cause instanceof Error
          ? cause.message
          : "No pudimos completar la acción.",
      );
      if (!(cause instanceof PosError)) return;
      if (cause.status === 401 || cause.status === 403) {
        cache.clear();
        navigation.current += 1;
        setHistory(null);
        setOrder(null);
        setOpening(null);
        setConfirmVoid(false);
        setView("list");
        setUnavailable(true);
        return;
      }
      if (cause.status === 404 || cause.code === "unknown_pos_order") {
        const missing = id ?? selected.current?.id;
        if (missing) cache.remove(missing);
        setHistory(cache.peek<PosHistory>(historyKey, true));
        if (!id || selected.current?.id === id) {
          setOrder(null);
          setView("list");
        }
      }
      if (cause.code === "version_conflict") {
        cache.invalidate(historyKey);
        const showConflict = (current: PosOrder) => {
          setOrder(cache.accept(current));
          setHistory(cache.peek<PosHistory>(historyKey, true));
          setView("detail");
          setError(
            "Otra persona modificó esta orden. Cargamos la versión actual; revísala antes de continuar.",
          );
        };
        if (cause.order) showConflict(cause.order);
        else if (selected.current) {
          setRecovering(true);
          setView("detail");
          void cache
            .order(selected.current.id, true)
            .then(showConflict)
            .catch((reason) => {
              if (reason instanceof DiscardedPosRead) return;
              setOrder(null);
              setView("list");
              handleError(reason);
            })
            .finally(() => setRecovering(false));
        }
      }
    },
    [cache, setOrder, setView],
  );
  const readError = useCallback(
    (cause: unknown, id?: string) => {
      handleError(cause, id);
      if (
        !(cause instanceof DiscardedPosRead) &&
        !(
          cause instanceof PosError &&
          (cause.status === 401 || cause.status === 403 || cause.status === 404)
        )
      )
        setError(
          "No pudimos actualizar los datos. Puedes consultar la última versión disponible.",
        );
    },
    [handleError],
  );
  const refreshHistory = useCallback(
    async (force = false) => {
      try {
        setHistory(await cache.history(force));
      } catch (cause) {
        readError(cause);
      }
    },
    [cache, readError],
  );
  const load = useCallback(
    async (force = false) => {
      setRefreshing(true);
      const ticket = ++loading.current;
      const epoch = cache.epoch;
      try {
        const context = await cache.read(
          "session",
          () => posRequest<PosSession>("/api/merchant/session"),
          force,
        );
        if (cache.epoch !== epoch) return;
        if (
          !context.authenticated ||
          !context.user?.id ||
          !context.business?.id ||
          context.business.status !== "active" ||
          context.membership?.status !== "active" ||
          !context.business.posEnabled ||
          !context.membership.permissions.includes("pos")
        ) {
          cache.clear();
          navigation.current += 1;
          setHistory(null);
          setOrder(null);
          setOpening(null);
          setConfirmVoid(false);
          setView("list");
          setSession(context);
          setUnavailable(true);
          return;
        }
        const changed = cache.bind(`${context.user.id}:${context.business.id}`);
        cache.put("session", context);
        if (changed) {
          navigation.current += 1;
          setHistory(null);
          setOrder(null);
          setOpening(null);
          setView("list");
        }
        if (force) cache.invalidateResources();
        setCatalogRevision((current) => current + 1);
        setSession(context);
        setUnavailable(false);
        await refreshHistory();
      } catch (cause) {
        readError(cause);
      } finally {
        if (loading.current === ticket) setRefreshing(false);
      }
    },
    [cache, readError, refreshHistory, setOrder, setView],
  );
  useEffect(() => {
    void load();
    return () => {
      cache.clear();
      navigation.current += 1;
      loading.current += 1;
    };
  }, [cache, load]);
  function publish(result: PosOrder, reconcile = false) {
    if (!cache.context) return;
    setOrder(cache.accept(result));
    setHistory(cache.peek<PosHistory>(historyKey, true));
    setView("detail");
    setConfirmVoid(false);
    if (reconcile || result.status !== "open") void refreshHistory(true);
  }
  async function run(action: () => Promise<PosOrder>) {
    if (locked.current || !cache.context) return;
    locked.current = true;
    setBusy(true);
    setError(null);
    cache.beginWrite(order?.id);
    const epoch = cache.epoch;
    try {
      const result = await action();
      if (cache.epoch === epoch) publish(result);
    } catch (cause) {
      if (cache.epoch !== epoch) return;
      handleError(cause);
      if (
        cause instanceof PosError &&
        cause.code === "pos_order_not_open" &&
        order
      ) {
        try {
          publish(await cache.order(order.id, true), true);
        } catch (reason) {
          readError(reason, order.id);
        }
      }
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function openOrder(id: string) {
    const ticket = ++navigation.current;
    const cached = cache.peek<PosOrder>(detailKey(id), true);
    setError(null);
    setOrder(cached);
    setView(cached ? "detail" : "list");
    setOpening(id);
    try {
      const result = await cache.order(id);
      if (
        navigation.current === ticket &&
        !["edit", "checkout"].includes(viewRef.current)
      ) {
        setOrder(result);
        setView("detail");
      }
    } catch (cause) {
      if (
        navigation.current === ticket ||
        (cause instanceof PosError &&
          [401, 403, 404].includes(cause.status ?? 0))
      )
        readError(cause, id);
    } finally {
      if (navigation.current === ticket) setOpening(null);
    }
  }
  function back() {
    navigation.current += 1;
    setOpening(null);
    setOrder(null);
    setView("list");
    setError(null);
    if (!cache.peek(historyKey)) void refreshHistory();
  }
  function update() {
    setError(null);
    setConfirmVoid(false);
    if (view !== "edit") {
      navigation.current += 1;
      setOpening(null);
      setOrder(null);
      setView("list");
    }
    void load(true);
  }
  async function prepareVoid() {
    if (!order || locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(null);
    try {
      const current = await cache.order(order.id, true);
      publish(current);
      if (JSON.stringify(current) !== JSON.stringify(order)) {
        setError(
          "Otra persona modificó esta orden. Cargamos la versión actual; revísala antes de continuar.",
        );
      } else if (current.status === "open") setConfirmVoid(true);
    } catch (cause) {
      readError(cause, order.id);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return (
    <main
      className={
        view === "edit"
          ? "merchant-shell counter-shell counter-flow print:p-0"
          : "merchant-shell print:p-0"
      }
    >
      <div className="backoffice-home grid min-w-0 gap-6 print:m-0 print:p-0">
        <div className="print:hidden">
          <PageHeader
            title="POS"
            description="Atiende tus mesas y cierra cada venta cuando el cliente pague."
            actions={
              <Button
                variant="secondary"
                isDisabled={busy || refreshing || view === "checkout"}
                onPress={update}
              >
                Actualizar órdenes
              </Button>
            }
          />
        </div>
        {error && (
          <div className="print:hidden">
            <Alert kind="error" title={error} />
          </div>
        )}
        {opening && <Text variant="muted">Cargando orden…</Text>}
        {unavailable ? (
          <Alert title="POS no disponible">
            El módulo está apagado o no tienes permiso. La persona propietaria
            puede activarlo en Cuenta → Configuración.
          </Alert>
        ) : !session ? (
          <Text>Cargando POS…</Text>
        ) : (
          <>
            {view === "list" && (
              <div className="grid gap-6 print:hidden">
                <div>
                  <Button
                    isDisabled={busy || refreshing}
                    onPress={() => {
                      navigation.current += 1;
                      setOpening(null);
                      setOrder(null);
                      setView("edit");
                      setError(null);
                    }}
                  >
                    Nueva orden
                  </Button>
                </div>
                {!history ? (
                  <Text>Cargando órdenes…</Text>
                ) : (
                  [
                    { title: "Abiertas", items: history.open },
                    { title: "Cerradas hoy", items: history.closedToday },
                  ].map((group) => (
                    <section key={group.title} className="grid gap-4">
                      <Heading level={2}>{group.title}</Heading>
                      {!group.items.length && (
                        <Text variant="muted">
                          No hay órdenes {group.title.toLowerCase()}.
                        </Text>
                      )}
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {group.items.map((item) => (
                          <Card className="grid gap-3" key={item.id}>
                            <Heading level={3}>{item.tableLabel}</Heading>
                            <Text variant="muted">
                              {item.location?.name ?? "Sin local"} ·{" "}
                              {item.status === "open"
                                ? "Abierta"
                                : item.status === "voided"
                                  ? "Anulada"
                                  : "Cerrada"}
                            </Text>
                            <Text>
                              {item.itemCount} productos ·{" "}
                              {formatMoney(
                                Number(item.saleTotal ?? item.total),
                                session.business?.currencyCode ?? "USD",
                              )}
                            </Text>
                            <Text variant="small">
                              {new Date(
                                item.closedAt ?? item.createdAt,
                              ).toLocaleString("es-EC")}
                            </Text>
                            <Button
                              variant="secondary"
                              isDisabled={busy || refreshing}
                              isLoading={opening === item.id}
                              onPress={() => void openOrder(item.id)}
                            >
                              Abrir {item.tableLabel}
                            </Button>
                          </Card>
                        ))}
                      </div>
                    </section>
                  ))
                )}
              </div>
            )}
            {view === "edit" && (
              <div className="print:hidden">
                <PosEditor
                  key={order ? `${order.id}:${order.version}` : "new"}
                  order={order}
                  cache={cache}
                  catalogRevision={catalogRevision}
                  locations={locations}
                  currencyCode={session.business?.currencyCode ?? "USD"}
                  busy={busy || refreshing}
                  onError={handleError}
                  onCancel={() => (order ? setView("detail") : back())}
                  onSave={(body) =>
                    void run(() =>
                      posRequest<PosOrder>(
                        order ? orderUrl(order.id) : "/api/pos/orders",
                        order ? "PUT" : "POST",
                        body,
                      ),
                    )
                  }
                />
              </div>
            )}
            {order && (view === "detail" || view === "checkout") && (
              <>
                <Card className="grid gap-5 print:border-0 print:p-0 print:shadow-none">
                  <PosResult order={order} />
                  <PosTicket order={order} />
                  <div className="flex flex-wrap gap-3 print:hidden">
                    <Button
                      variant="secondary"
                      isDisabled={busy || refreshing}
                      onPress={() => window.print()}
                    >
                      Imprimir
                    </Button>
                    {order.status === "open" && view === "detail" && (
                      <>
                        <Button
                          variant="secondary"
                          isDisabled={busy || refreshing}
                          onPress={() => {
                            setError(null);
                            setView("edit");
                          }}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="danger"
                          isDisabled={busy || refreshing}
                          onPress={() => void prepareVoid()}
                        >
                          Anular
                        </Button>
                        <Button
                          isDisabled={busy || refreshing || !order.items.length}
                          onPress={() => {
                            setError(null);
                            setView("checkout");
                          }}
                        >
                          Cobrar
                        </Button>
                      </>
                    )}{" "}
                    {view === "detail" && (
                      <Button
                        variant="quiet"
                        isDisabled={busy || refreshing}
                        onPress={back}
                      >
                        Volver al historial
                      </Button>
                    )}
                  </div>
                </Card>
                {view === "checkout" && order.status === "open" && (
                  <PosCheckout
                    key={`${order.id}:${order.version}`}
                    order={order}
                    onClosed={(result) => {
                      publish(result, true);
                      setError(null);
                    }}
                    onBack={() => {
                      setView("detail");
                      setError(null);
                    }}
                    onError={handleError}
                  />
                )}
              </>
            )}
          </>
        )}
        <ConfirmDialog
          isOpen={confirmVoid}
          title="¿Anular esta orden?"
          description={`La orden ${order?.tableLabel ?? ""} quedará anulada. Esta acción no acredita compras.`}
          confirmLabel="Anular orden"
          intent="danger"
          isBusy={busy}
          onCancel={() => setConfirmVoid(false)}
          onConfirm={() => {
            if (order)
              void run(() =>
                posRequest<PosOrder>(`${orderUrl(order.id)}/void`, "POST", {}),
              );
          }}
        />
      </div>
    </main>
  );
}
