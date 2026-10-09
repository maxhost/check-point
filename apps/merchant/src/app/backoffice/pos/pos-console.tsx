"use client";
import { NavArrowDown, Xmark } from "iconoir-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  ConfirmDialog,
  Dialog,
  SelectField,
  Heading,
  Link,
  PageHeader,
  Text,
} from "../../../ui";
import { formatMoney } from "../counter/types";
import { DiscardedPosRead, historyKey, detailKey, PosCache } from "./pos-cache";
import { POS_NEW_ORDER_EVENT } from "./pos-navigation";
import { PosEditor } from "./pos-editor";
import { PosCheckout } from "./pos-checkout";
import { PosScan } from "./pos-scan";
import { usePosPayment } from "./pos-payment";
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
  const [view, setViewState] = useState<"list" | "edit" | "detail">("list");
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
  const [lastLocationId, setLastLocationId] = useState(locations[0]?.id ?? "");
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const activeLocation =
    locations.find((location) => location.id === lastLocationId) ??
    locations[0];
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
        setLastLocationId("");
        navigation.current += 1;
        setHistory(null);
        setOrder(null);
        setOpening(null);
        setConfirmVoid(false);
        setView("list");
        setUnavailable(true);
        return;
      }
      if (
        cause.code === "unknown_pos_order" ||
        (cause.status === 404 && !cause.code)
      ) {
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
  const payment = usePosPayment({
    order,
    context:
      !unavailable && session?.user?.id && session.business?.id
        ? `${session.user.id}:${session.business.id}`
        : null,
    onError: handleError,
    onClosed: (result) => {
      publish(result, true);
      setError(null);
    },
    onRecovered: (result, message) => {
      publish(result, result.status !== "open");
      setError(message);
    },
    onBeginClose: () => cache.beginWrite(order?.id),
  });
  const paymentBusy = payment.blocked || payment.active;
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
          setLastLocationId("");
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
          setLastLocationId("");
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
  const startNewOrder = useCallback(() => {
    if (
      busy ||
      !payment.canNavigate() ||
      refreshing ||
      unavailable ||
      !session ||
      !cache.context ||
      viewRef.current !== "list"
    )
      return;
    navigation.current += 1;
    setOpening(null);
    setOrder(null);
    setView("edit");
    setError(null);
  }, [busy, refreshing, unavailable, session, cache, setOrder, setView]);
  useEffect(() => {
    window.addEventListener(POS_NEW_ORDER_EVENT, startNewOrder);
    return () => window.removeEventListener(POS_NEW_ORDER_EVENT, startNewOrder);
  }, [startNewOrder]);
  function publish(result: PosOrder, reconcile = false) {
    if (!cache.context) return;
    setOrder(cache.accept(result));
    setHistory(cache.peek<PosHistory>(historyKey, true));
    setView("detail");
    setConfirmVoid(false);
    if (reconcile || result.status !== "open") void refreshHistory(true);
  }
  async function run(
    action: () => Promise<PosOrder>,
  ): Promise<PosOrder | null> {
    if (locked.current || !cache.context || !payment.canNavigate()) return null;
    locked.current = true;
    setBusy(true);
    setError(null);
    cache.beginWrite(order?.id);
    const epoch = cache.epoch;
    try {
      const result = await action();
      if (cache.epoch === epoch) {
        publish(result);
        return result;
      }
      return null;
    } catch (cause) {
      if (cache.epoch !== epoch) return null;
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
      return null;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function openOrder(id: string) {
    if (!payment.canNavigate()) return;
    const ticket = ++navigation.current;
    const cached = cache.peek<PosOrder>(detailKey(id), true);
    setError(null);
    setOrder(cached);
    setView(cached ? "detail" : "list");
    setOpening(id);
    try {
      const result = await cache.order(id);
      if (navigation.current === ticket && viewRef.current !== "edit") {
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
    if (!payment.canNavigate()) return;
    navigation.current += 1;
    setOpening(null);
    setOrder(null);
    setView("list");
    setError(null);
    if (!cache.peek(historyKey)) void refreshHistory();
  }
  async function prepareVoid() {
    if (!order || locked.current || !payment.canNavigate()) return;
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
  const openDetail = view === "detail" && order?.status === "open";
  const workspace = openDetail || view === "edit";
  return (
    <main
      className={`merchant-shell w-full px-6 pt-6 md:px-12 md:pt-12 print:p-0 ${workspace ? "counter-shell counter-flow" : ""}`}
    >
      <div className="backoffice-home grid w-full min-w-0 gap-6 print:m-0 print:p-0">
        {!workspace && (
          <div className="grid gap-2 print:hidden">
            <div className="flex items-center justify-between gap-3">
              <div
                className={
                  view === "list" ? "min-w-0 shrink-0" : "min-w-0 flex-1"
                }
              >
                {view === "list" ? (
                  <Heading level={1}>POS</Heading>
                ) : (
                  <PageHeader title={openDetail ? order!.tableLabel : "POS"} />
                )}
              </div>
              {view === "list" && (
                <div className="min-w-0">
                  {locations.length > 1 ? (
                    <Button
                      variant="quiet"
                      aria-label={`Seleccionar local: ${activeLocation?.name ?? "Sin local"}`}
                      aria-haspopup="dialog"
                      aria-expanded={locationPickerOpen}
                      className="max-w-full rounded-full! border! border-primary! bg-primary-soft! px-4! py-2!"
                      isDisabled={
                        busy ||
                        refreshing ||
                        !!opening ||
                        unavailable ||
                        !session
                      }
                      onPress={() => setLocationPickerOpen(true)}
                    >
                      <Text
                        variant="label"
                        className="min-w-0 truncate text-primary!"
                      >
                        {activeLocation?.name ?? "Sin local"}
                      </Text>
                      <NavArrowDown
                        aria-hidden="true"
                        className="size-5 shrink-0"
                      />
                    </Button>
                  ) : (
                    <div className="max-w-full rounded-full border border-primary bg-primary-soft px-4 py-2">
                      <Text variant="label" className="truncate text-primary!">
                        {activeLocation?.name ?? "Sin local"}
                      </Text>
                    </div>
                  )}
                </div>
              )}
              {view === "detail" ? (
                <Button
                  variant="quiet"
                  aria-label="Volver al listado de órdenes"
                  className="close-module size-11 shrink-0 rounded-full! bg-primary-soft! p-0!"
                  isDisabled={busy || refreshing}
                  onPress={back}
                >
                  <Xmark aria-hidden="true" className="size-6" />
                </Button>
              ) : (
                <Link
                  href="/backoffice"
                  aria-label="Cerrar POS"
                  className="close-module grid size-11 shrink-0 place-items-center rounded-full! bg-primary-soft! p-0! no-underline"
                >
                  <Xmark aria-hidden="true" className="size-6" />
                </Link>
              )}
            </div>
          </div>
        )}
        {locations.length > 1 && (
          <Dialog
            isOpen={locationPickerOpen}
            onOpenChange={setLocationPickerOpen}
            title="Seleccionar local"
            isDismissable={!busy}
          >
            <SelectField
              label="Local"
              selectedKey={activeLocation?.id ?? null}
              options={locations.map((location) => ({
                id: location.id,
                label: location.name,
              }))}
              isDisabled={busy || refreshing}
              onSelectionChange={(key) => {
                const id = String(key ?? "");
                if (!locations.some((location) => location.id === id)) return;
                setLastLocationId(id);
                setLocationPickerOpen(false);
              }}
            />
          </Dialog>
        )}
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
                <div className="hidden md:block">
                  <Button
                    isDisabled={busy || refreshing}
                    onPress={startNewOrder}
                  >
                    Nueva orden
                  </Button>
                </div>
                {!history ? (
                  <Text>Cargando órdenes…</Text>
                ) : (
                  [
                    {
                      title: "Abiertas",
                      items: history.open.filter(
                        (item) =>
                          locations.length <= 1 ||
                          item.location?.id === activeLocation?.id,
                      ),
                    },
                    {
                      title: "Cerradas hoy",
                      items: history.closedToday.filter(
                        (item) =>
                          locations.length <= 1 ||
                          item.location?.id === activeLocation?.id,
                      ),
                    },
                  ].map((group) => (
                    <section key={group.title} className="grid gap-4">
                      <Heading level={2}>{group.title}</Heading>
                      {!group.items.length && (
                        <Text variant="muted">
                          No hay órdenes {group.title.toLowerCase()}.
                        </Text>
                      )}
                      <div
                        className={
                          group.title === "Abiertas"
                            ? "grid gap-2"
                            : "grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
                        }
                      >
                        {group.items.map((item) =>
                          group.title === "Abiertas" ? (
                            <div
                              className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-surface px-4 py-2"
                              key={item.id}
                            >
                              <div className="min-w-0 flex-1 break-words">
                                <Heading level={3}>{item.tableLabel}</Heading>
                              </div>
                              <Text className="shrink-0 whitespace-nowrap">
                                {formatMoney(
                                  Number(item.total),
                                  session.business?.currencyCode ?? "USD",
                                )}
                              </Text>
                              <Button
                                variant="secondary"
                                className="shrink-0"
                                aria-label={`Abrir ${item.tableLabel}`}
                                isDisabled={busy || refreshing}
                                isLoading={opening === item.id}
                                onPress={() => void openOrder(item.id)}
                              >
                                Abrir
                              </Button>
                            </div>
                          ) : (
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
                          ),
                        )}
                      </div>
                    </section>
                  ))
                )}
              </div>
            )}
            {workspace && (
              <PosEditor
                key={order?.id ?? "new"}
                order={order}
                cache={cache}
                catalogRevision={catalogRevision}
                locations={locations}
                currencyCode={session.business?.currencyCode ?? "USD"}
                busy={busy || refreshing || paymentBusy}
                onError={handleError}
                onCancel={back}
                lastLocationId={activeLocation?.id ?? ""}
                payment={payment}
                onScan={payment.scan}
                onCheckout={() => void payment.prepare()}
                onVoid={() => void prepareVoid()}
                onSave={(body) =>
                  run(() =>
                    posRequest<PosOrder>(
                      order ? orderUrl(order.id) : "/api/pos/orders",
                      order ? "PUT" : "POST",
                      body,
                    ),
                  )
                }
              />
            )}
            {workspace && order && (
              <div className="hidden print:block">
                <PosTicket order={order} />
              </div>
            )}
            {order && !workspace && view === "detail" && (
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
              </>
            )}
          </>
        )}
        {workspace && order && (
          <>
            <PosScan payment={payment} />
            <PosCheckout order={order} payment={payment} />
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
