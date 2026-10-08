"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Heading,
  NumberField,
  Text,
  TextField,
} from "../../../ui";
import { QrScanner } from "../counter/qr-scanner";
import {
  formatMoney,
  previewNetTotal,
  type CounterCouponState,
  type ResolveResponse,
} from "../counter/types";
import { PosCoupon } from "./pos-coupon";
import { orderUrl, PosError, posRequest, type PosOrder } from "./pos-types";
export function PosCheckout({
  order,
  onClosed,
  onBack,
  onError,
}: {
  order: PosOrder;
  onClosed: (order: PosOrder) => void;
  onBack: () => void;
  onError: (error: unknown) => void;
}) {
  const [resolved, setResolved] = useState<ResolveResponse | null>(null);
  const [scanning, setScanning] = useState(false);
  const [token, setToken] = useState("");
  const [productId, setProductId] = useState<string | null>(null);
  const [received, setReceived] = useState(NaN);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(false);
  const [pollError, setPollError] = useState(false);
  const attempt = useRef<Record<string, unknown> | null>(null);
  const locked = useRef(false);
  const couponEpoch = useRef(0);
  const membershipId = resolved?.membership.id;
  const refreshCoupon = useCallback(async () => {
    if (!membershipId) return;
    const epoch = couponEpoch.current;
    const data = await posRequest<{ couponState: CounterCouponState }>(
      `/api/pos/coupon-state?membershipId=${encodeURIComponent(membershipId)}`,
    );
    if (epoch !== couponEpoch.current) return;
    setPollError(false);
    setResolved((current) => {
      if (current?.membership.id !== membershipId) return current;
      const oldId =
        current.couponState.status === "selected"
          ? current.couponState.coupon.couponId
          : null;
      const nextId =
        data.couponState.status === "selected"
          ? data.couponState.coupon.couponId
          : null;
      if (oldId !== nextId) setProductId(null);
      return { ...current, couponState: data.couponState };
    });
  }, [membershipId]);
  useEffect(() => {
    if (!membershipId || retry || busy) return;
    let active = true;
    const poll = () => {
      void refreshCoupon().catch((error) => {
        if (active) {
          setPollError(true);
          if (
            error instanceof PosError &&
            ["pos_disabled", "missing_permission"].includes(error.code ?? "")
          )
            onError(error);
        }
      });
    };
    poll();
    const timer = window.setInterval(poll, 4000);
    return () => {
      active = false;
      couponEpoch.current += 1;
      window.clearInterval(timer);
    };
  }, [membershipId, refreshCoupon, retry, busy, onError]);
  useEffect(
    () => () => {
      couponEpoch.current += 1;
    },
    [],
  );
  async function resolve(qrToken: string) {
    if (locked.current || retry) return;
    locked.current = true;
    setBusy(true);
    setScanning(false);
    try {
      const data = await posRequest<ResolveResponse>(
        "/api/pos/resolve",
        "POST",
        {
          qrToken,
          ...(order.location ? { locationId: order.location.id } : {}),
        },
      );
      couponEpoch.current += 1;
      setResolved(data);
      setProductId(null);
    } catch (error) {
      onError(error);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  const state = resolved?.couponState ?? { status: "none" };
  const validCoupon =
    state.status === "selected" && state.verdict.valid ? state.coupon : null;
  const needsProduct =
    validCoupon &&
    !validCoupon.productId &&
    (validCoupon.kind === "free_product" || validCoupon.kind === "two_for_one");
  const cart = order.items.map((item) => ({
    productId: item.productId ?? item.lineId,
    name: item.name,
    unitPrice: Number(item.unitPrice),
    hasStoredPrice: true,
    quantity: item.quantity,
  }));
  const net = previewNetTotal(Number(order.total), state, cart, productId);
  async function removeCoupon() {
    if (!resolved || state.status !== "selected" || locked.current || retry)
      return;
    locked.current = true;
    setBusy(true);
    couponEpoch.current += 1;
    try {
      await posRequest("/api/pos/coupon-remove", "POST", {
        membershipId: resolved.membership.id,
        couponId: state.coupon.couponId,
      });
      setResolved((current) =>
        current ? { ...current, couponState: { status: "none" } } : null,
      );
      setProductId(null);
    } catch (error) {
      onError(error);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function close() {
    if (locked.current) return;
    if (!attempt.current)
      attempt.current = {
        clientRequestId: crypto.randomUUID(),
        version: order.version,
        ...(resolved ? { membershipId: resolved.membership.id } : {}),
        ...(validCoupon
          ? {
              coupon: {
                couponId: validCoupon.couponId,
                ...(!validCoupon.productId && productId ? { productId } : {}),
              },
            }
          : {}),
      };
    locked.current = true;
    setBusy(true);
    couponEpoch.current += 1;
    try {
      const result = await posRequest<PosOrder>(
        `${orderUrl(order.id)}/close`,
        "POST",
        attempt.current,
      );
      onClosed(result);
    } catch (error) {
      if (error instanceof PosError && (error.status ?? 0) < 500) {
        attempt.current = null;
        setRetry(false);
        void refreshCoupon().catch(() => setPollError(true));
      } else setRetry(true);
      onError(error);
      if (error instanceof PosError && error.code === "pos_order_not_open") {
        try {
          onClosed(await posRequest<PosOrder>(orderUrl(order.id)));
        } catch (reason) {
          onError(reason);
        }
      }
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return (
    <Card className="grid gap-5 print:hidden">
      <Heading level={2}>Cobrar {order.tableLabel}</Heading>
      <Text variant="label">
        {validCoupon ? "Total estimado" : "Total"}:{" "}
        {formatMoney(net, order.business.currencyCode)}
      </Text>
      {validCoupon && (
        <Text variant="small">
          El total final del cupón lo confirma el servidor al cerrar la venta.
        </Text>
      )}
      <NumberField
        label="Recibido"
        value={received}
        minValue={0}
        formatOptions={{ maximumFractionDigits: 2 }}
        onChange={setReceived}
        isDisabled={busy}
      />
      {Number.isFinite(received) && (
        <Text variant="label">
          {received >= net
            ? `Cambio: ${formatMoney(Math.round((received - net) * 100) / 100, order.business.currencyCode)}`
            : `Faltan: ${formatMoney(net - received, order.business.currencyCode)}`}
        </Text>
      )}
      {resolved ? (
        <>
          <Heading level={3}>{resolved.consumer.displayName}</Heading>
          <PosCoupon
            state={state}
            order={order}
            productId={productId}
            onProduct={setProductId}
            onRemove={() => void removeCoupon()}
            busy={busy || retry}
          />
          <Button
            variant="quiet"
            isDisabled={busy || retry}
            onPress={() => {
              couponEpoch.current += 1;
              setResolved(null);
              setProductId(null);
            }}
          >
            Quitar pase
          </Button>
        </>
      ) : (
        <Text variant="muted">
          Puedes cerrar la venta sin pase. Si el cliente tiene CheckPass,
          escanéalo para acreditar la compra.
        </Text>
      )}
      {pollError && (
        <Alert kind="warning" title="No pudimos actualizar el cupón">
          Volveremos a consultar su estado. El servidor lo valida al cerrar.
        </Alert>
      )}
      <Button
        variant="secondary"
        isDisabled={busy || retry}
        onPress={() => setScanning(true)}
      >
        Escanear pase
      </Button>
      {scanning && (
        <div className="grid gap-3">
          <QrScanner onDecode={(qr) => void resolve(qr)} />
          <TextField
            label="Código del pase"
            value={token}
            onChange={setToken}
            description="También puedes pegar el código leído por tu lector QR."
          />
          <Button
            isDisabled={busy || !token.trim()}
            onPress={() => void resolve(token.trim())}
          >
            Leer pase
          </Button>
          <Button variant="quiet" onPress={() => setScanning(false)}>
            Cerrar escáner
          </Button>
        </div>
      )}
      {retry && (
        <Alert kind="warning" title="No pudimos confirmar el cierre">
          Reintenta para consultar el mismo cierre antes de cambiar la orden o
          el pase.
        </Alert>
      )}
      <div className="flex flex-wrap gap-3">
        <Button
          isLoading={busy}
          isDisabled={
            !order.items.length || (!retry && !!needsProduct && !productId)
          }
          onPress={() => void close()}
        >
          {retry ? "Reintentar cierre" : "Cerrar venta"}
        </Button>
        <Button variant="secondary" isDisabled={busy || retry} onPress={onBack}>
          Volver a la orden
        </Button>
      </div>
    </Card>
  );
}
