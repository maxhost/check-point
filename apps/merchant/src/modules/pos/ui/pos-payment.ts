"use client";
import { initial, type PaymentState } from "./pos-payment-state";
import { createPaymentActions } from "./pos-payment-actions";
import { usePosCloseNavigation } from "./use-pos-close-navigation";
import { useEffect, useRef, useState } from "react";
import { paymentPreview } from "./pos-payment-preview";
import { PosError, type PosOrder } from "./pos-types";

export function usePosPayment({
  order,
  context,
  onError,
  onClosed,
  onRecovered,
  onBeginClose,
}: {
  order: PosOrder | null;
  context: string | null;
  onError: (error: unknown) => void;
  onClosed: (order: PosOrder) => void;
  onRecovered: (order: PosOrder, message: string) => void;
  onBeginClose: () => void;
}) {
  const [state, setState] = useState<PaymentState>(initial);
  const current = useRef(state);
  current.current = state;
  const selected = useRef(order);
  selected.current = order;
  const identity = `${context ?? ""}:${order?.id ?? ""}`;
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const generation = useRef(0);
  const locked = useRef(false);
  const recoveryRequired = useRef<string | null>(null);
  const attempt = useRef<{
    orderId: string;
    body: Readonly<Record<string, unknown>>;
  } | null>(null);
  const update = (patch: Partial<PaymentState>) => {
    current.current = { ...current.current, ...patch };
    setState(current.current);
  };
  const blocked = state.phase === "closing" || state.phase === "closeUncertain";
  const active =
    state.phase === "preparingPayment" || state.phase === "resolving";
  useEffect(() => {
    generation.current += 1;
    locked.current = false;
    attempt.current = null;
    recoveryRequired.current = null;
    const next = initial();
    current.current = next;
    setState(next);
    return () => {
      generation.current += 1;
    };
  }, [identity]);
  usePosCloseNavigation(blocked, current, setState);
  const selectedMethod =
    state.methods.find((method) => method.id === state.methodId) ?? null;
  const snapshot = order
    ? JSON.stringify([order.version, order.total, order.items])
    : "";
  const fingerprint = useRef("");
  const preview = order
    ? paymentPreview(
        order,
        state.resolved,
        state.productId,
        state.excludedId,
        selectedMethod?.isCash ? state.received : null,
      )
    : null;
  const amountKey = `${snapshot}:${preview?.netCents}`;
  useEffect(() => {
    if (
      fingerprint.current &&
      fingerprint.current !== amountKey &&
      !attempt.current
    ) {
      current.current = {
        ...current.current,
        received: null,
        receivedError: null,
      };
      setState(current.current);
    }
    fingerprint.current = amountKey;
  }, [amountKey]);
  function ticket() {
    return { generation: ++generation.current, identity: identityRef.current };
  }
  function live(value: ReturnType<typeof ticket>) {
    return (
      value.generation === generation.current &&
      value.identity === identityRef.current
    );
  }
  function denyNavigation() {
    return ["closing", "closeUncertain"].includes(current.current.phase);
  }
  function cancelScan() {
    if (denyNavigation()) return;
    generation.current += 1;
    locked.current = false;
    update({ phase: current.current.resolved ? "ready" : "idle", error: null });
  }
  function cancelPayment() {
    if (denyNavigation()) return;
    generation.current += 1;
    locked.current = false;
    update({
      phase: current.current.resolved ? "ready" : "idle",
      error: null,
      validated: false,
    });
  }
  function classify(error: unknown, operation: "resolve" | "coupon" | "close") {
    const message =
      error instanceof Error
        ? error.message
        : "No pudimos completar la acción.";
    if (!(error instanceof PosError)) {
      update({ error: message });
      return;
    }
    if (
      error.code === "foreign_membership" ||
      (operation === "coupon" && error.code === "not_found")
    ) {
      update({
        resolved: null,
        productId: null,
        excludedId: null,
        received: null,
        receivedError: null,
        clientError:
          "Vuelve a identificar al cliente o quítalo explícitamente para cobrar sin pase.",
        error: message,
        validated: false,
      });
      return;
    }
    if (error.code === "no_program") {
      update({
        clientError:
          "El programa no está disponible. Vuelve a escanear o quita el cliente.",
        error: message,
        validated: false,
      });
      return;
    }
    if (error.status === 401 || error.status === 403) {
      generation.current += 1;
      attempt.current = null;
      locked.current = false;
      update(initial());
      onError(error);
      return;
    }
    if (error.code === "unknown_pos_order") {
      generation.current += 1;
      update(initial());
      onError(error);
      return;
    }
    update({ error: message });
  }
  const { resolve, prepare, confirm } = createPaymentActions({
    current,
    selected,
    locked,
    recoveryRequired,
    attempt,
    update,
    ticket,
    live,
    denyNavigation,
    classify,
    onRecovered,
    onClosed,
    onBeginClose,
  });
  return {
    ...state,
    selectedMethod,
    setMethodId: (methodId: string | null) => {
      if (!denyNavigation() && !locked.current)
        update({ methodId, received: null, receivedError: null });
    },
    preview,
    blocked,
    active,
    canNavigate: () => !denyNavigation(),
    scan: () => {
      if (!locked.current && !denyNavigation()) {
        ticket();
        update({ phase: "scanning", error: null, notice: null });
      }
    },
    retryScan: () => {
      if (!locked.current && current.current.phase === "scanning") {
        ticket();
        update({ error: null });
      }
    },
    cancelScan,
    dismissNotice: () => update({ notice: null }),
    cancelPayment,
    resolve,
    prepare,
    confirm,
    setReceivedRaw: (text: string) => {
      if (!denyNavigation())
        update({
          receivedError:
            text.trim() && !/^\d+(?:[.,]\d{1,2})?$/.test(text.trim())
              ? "Recibido debe ser un importe no negativo con hasta 2 decimales."
              : null,
        });
    },
    setReceived: (received: number | null) => {
      if (!denyNavigation()) update({ received });
    },
    setProduct: (productId: string | null) => {
      if (!denyNavigation() && !locked.current) {
        const reopen = current.current.phase === "paymentOpen";
        update({
          productId,
          received: null,
          ...(reopen ? { validated: false } : {}),
        });
        if (reopen) void prepare();
      }
    },
    removeCoupon: () => {
      if (
        !denyNavigation() &&
        current.current.resolved?.couponState.status === "selected"
      ) {
        const reopen = current.current.phase === "paymentOpen";
        update({
          excludedId: current.current.resolved.couponState.coupon.couponId,
          productId: null,
          received: null,
          receivedError: null,
          ...(reopen ? { validated: false } : {}),
        });
        if (reopen) void prepare();
      }
    },
    removeClient: () => {
      if (!denyNavigation()) {
        ticket();
        locked.current = false;
        const reopen = current.current.phase === "paymentOpen";
        update({
          ...initial(),
          methods: current.current.methods,
          methodId: current.current.methodId,
          phase: reopen ? "paymentOpen" : "idle",
          validated: false,
        });
        if (reopen) void prepare();
      }
    },
    acceptReview: () => {
      if (!denyNavigation()) update({ review: false });
    },
  };
}
export type PosPayment = ReturnType<typeof usePosPayment>;
