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
  const [order, setOrder] = useState<PosOrder | null>(null);
  const [view, setView] = useState<"list" | "edit" | "detail" | "checkout">(
    "list",
  );
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmVoid, setConfirmVoid] = useState(false);
  const locked = useRef(false);
  const handleError = useCallback((cause: unknown) => {
    setError(
      cause instanceof Error
        ? cause.message
        : "No pudimos completar la acción.",
    );
    if (cause instanceof PosError) {
      if (["missing_permission", "pos_disabled"].includes(cause.code ?? ""))
        setUnavailable(true);
      if (cause.code === "version_conflict" && cause.order) {
        setOrder(cause.order);
        setView("detail");
        setError(
          "Otra persona modificó esta orden. Cargamos la versión actual; revísala antes de continuar.",
        );
      }
    }
  }, []);
  const load = useCallback(async () => {
    try {
      const context = await posRequest<PosSession>("/api/merchant/session");
      setSession(context);
      if (
        !context.business?.posEnabled ||
        !context.membership?.permissions.includes("pos")
      ) {
        setUnavailable(true);
        return;
      }
      setUnavailable(false);
      setHistory(await posRequest<PosHistory>("/api/pos/orders"));
    } catch (cause) {
      handleError(cause);
    }
  }, [handleError]);
  useEffect(() => {
    void load();
  }, [load]);
  async function run(action: () => Promise<PosOrder>) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await action();
      setOrder(result);
      setView("detail");
      setConfirmVoid(false);
    } catch (cause) {
      handleError(cause);
      if (
        cause instanceof PosError &&
        cause.code === "pos_order_not_open" &&
        order
      ) {
        try {
          setOrder(await posRequest<PosOrder>(orderUrl(order.id)));
          setView("detail");
        } catch (reason) {
          handleError(reason);
        }
      }
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  function back() {
    setOrder(null);
    setView("list");
    setError(null);
    void load();
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
                isDisabled={busy || view === "checkout"}
                onPress={back}
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
                    onPress={() => {
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
                              isDisabled={busy}
                              onPress={() =>
                                void run(() =>
                                  posRequest<PosOrder>(orderUrl(item.id)),
                                )
                              }
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
                  locations={locations}
                  currencyCode={session.business?.currencyCode ?? "USD"}
                  busy={busy}
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
                      isDisabled={busy}
                      onPress={() => window.print()}
                    >
                      Imprimir
                    </Button>
                    {order.status === "open" && view === "detail" && (
                      <>
                        <Button
                          variant="secondary"
                          isDisabled={busy}
                          onPress={() => {
                            setError(null);
                            setView("edit");
                          }}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="danger"
                          isDisabled={busy}
                          onPress={() => setConfirmVoid(true)}
                        >
                          Anular
                        </Button>
                        <Button
                          isDisabled={busy || !order.items.length}
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
                      <Button variant="quiet" isDisabled={busy} onPress={back}>
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
                      setOrder(result);
                      setView("detail");
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
