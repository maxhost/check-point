"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Heading, Text } from "../../../ui";
import type { PosHistoryV2, PosLocationV2, PosOrderV2 } from "../contracts";
import { DiscardedPosRead, detailKey, historyKey, PosCache } from "./pos-cache";
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
import type { MeasuredEditorContext } from "./measured-editor-model";

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
  const cache = useMemo(() => {
    const value = new PosCache(undefined, client.request);
    value.bind(context.identity);
    return value;
  }, [client, context.identity]);
  const editors = useRef(new Set<MeasuredEditorSession>());
  const payments = useRef(new Map<string, MeasuredPaymentSession>());
  const active = useRef(true);
  const navigation = useRef(0);
  const [editor, setEditor] = useState<MeasuredEditorSession | null>(null);
  const [payment, setPayment] = useState<MeasuredPaymentSession | null>(null);
  const [order, setOrder] = useState<PosOrderV2 | null>(null);
  const [view, setView] = useState<"list" | "edit" | "detail" | "result">(
    "list",
  );
  const [history, setHistory] = useState<PosHistoryV2 | null>(null);
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
        cache.clear();
      });
    };
  }, [cache]);
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
          setDenied(false);
        }
      } catch (cause) {
        handleError(cause);
      } finally {
        if (active.current) setLoading(false);
      }
    },
    [cache, client, handleError],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const blocked =
    !accessEnabled ||
    denied ||
    loading ||
    !!editor?.blocked ||
    [...payments.current.values()].some((s) => !s.canLeave);
  function syncHistory() {
    setHistory(cache.peek<PosHistoryV2>(historyKey, true));
  }
  function selectEditor(value: PosOrderV2 | null, locationId?: string) {
    const next = new MeasuredEditorSession(
      { ...context, lastLocationId: locationId },
      cache,
      client,
      value,
    );
    editors.current.add(next);
    setEditor(next);
    setOrder(value);
    setView("edit");
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
    setPayment(current);
    setOrder(value);
    setView("detail");
    void current.prepare();
  }
  const paymentState = payment?.getSnapshot();
  return (
    <>
      <div className="mx-auto max-w-6xl px-4 pt-4 md:px-6">
        <Text variant="small">
          Vista previa local · Impresión y anulación estarán disponibles en un
          próximo incremento.
        </Text>
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
            onNew={(locationId) => {
              if (!blocked) selectEditor(null, locationId);
            }}
            onRefresh={() => void load(true)}
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
          className="mx-auto grid max-w-6xl gap-6 p-4 md:p-6"
        >
          <Heading level={1}>
            {view === "result" ? "Venta completada" : order.orderLabel}
          </Heading>
          <Text>
            {order.orderLabel} ·{" "}
            {order.status === "open"
              ? "Abierta"
              : order.status === "closed"
                ? "Cerrada"
                : "Anulada"}
          </Text>
          <Text variant="label">
            Total: {order.business.currencyCode}{" "}
            {order.settlement?.collected ?? order.sale?.total ?? order.total}
          </Text>
          {order.sale && (
            <Text>
              {order.sale.consumer} · {order.sale.unitsGranted}{" "}
              {order.sale.kind === "points" ? "puntos" : "sellos"} acreditados ·
              Saldo: {order.sale.balanceAfter}
            </Text>
          )}
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
        </section>
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
