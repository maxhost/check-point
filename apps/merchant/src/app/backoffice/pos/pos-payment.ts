"use client";
import { useEffect, useRef, useState } from "react";
import type { CounterCouponState, ResolveResponse } from "../counter/types";
import { paymentPreview } from "./pos-payment-preview";
import { orderUrl, PosError, posRequest, type PosOrder } from "./pos-types";

type Phase =
  | "idle"
  | "scanning"
  | "resolving"
  | "ready"
  | "preparingPayment"
  | "paymentOpen"
  | "closing"
  | "closeUncertain";
type PaymentState = {
  phase: Phase;
  resolved: ResolveResponse | null;
  productId: string | null;
  excludedId: string | null;
  received: number | null;
  receivedError: string | null;
  error: string | null;
  clientError: string | null;
  review: boolean;
  validated: boolean;
};
const initial = (): PaymentState => ({
  phase: "idle",
  resolved: null,
  productId: null,
  excludedId: null,
  received: null,
  receivedError: null,
  error: null,
  clientError: null,
  review: false,
  validated: false,
});
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
  // Browser history and links must not discard a still-uncertain transaction.
  useEffect(() => {
    if (!blocked) return;
    const restoreUrl = window.location.href;
    const restoreState = window.history.state;
    const warn = () => {
      current.current = {
        ...current.current,
        error:
          "Resuelve el cobro pendiente con Reintentar cobro antes de salir.",
      };
      setState(current.current);
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!["closing", "closeUncertain"].includes(current.current.phase))
        return;
      event.preventDefault();
      event.returnValue = "";
    };
    const links = (event: MouseEvent) => {
      if (!["closing", "closeUncertain"].includes(current.current.phase))
        return;
      const anchor =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank")
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      warn();
    };
    const history = (event: PopStateEvent) => {
      if (!["closing", "closeUncertain"].includes(current.current.phase))
        return;
      event.stopImmediatePropagation();
      window.history.pushState(restoreState, "", restoreUrl);
      warn();
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("popstate", history, true);
    document.addEventListener("click", links, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("popstate", history, true);
      document.removeEventListener("click", links, true);
    };
  }, [blocked]);
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
        state.received,
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
  async function resolve(qrToken: string) {
    const saved = selected.current;
    if (
      !saved ||
      locked.current ||
      current.current.phase !== "scanning" ||
      current.current.error
    )
      return;
    locked.current = true;
    const value = ticket();
    update({ phase: "resolving", error: null });
    try {
      const data = await posRequest<ResolveResponse>(
        "/api/pos/resolve",
        "POST",
        {
          qrToken,
          ...(saved.location ? { locationId: saved.location.id } : {}),
        },
      );
      if (live(value))
        update({
          phase: "ready",
          resolved: data,
          productId: null,
          excludedId: null,
          received: null,
          receivedError: null,
          clientError: null,
          error: null,
          review: false,
          validated: false,
        });
    } catch (error) {
      if (live(value)) {
        update({ phase: "scanning" });
        classify(error, "resolve");
      }
    } finally {
      if (live(value)) locked.current = false;
    }
  }
  async function prepare(recoveryError: string | null = null) {
    if (!selected.current || locked.current || denyNavigation()) return;
    locked.current = true;
    const value = ticket();
    update({ phase: "preparingPayment", error: null, validated: false });
    const resolved = current.current.resolved;
    try {
      if (recoveryRequired.current) {
        await recover(selected.current!, recoveryRequired.current, value);
        return;
      }
      if (resolved) {
        const result = await posRequest<{ couponState: CounterCouponState }>(
          `/api/pos/coupon-state?membershipId=${encodeURIComponent(resolved.membership.id)}`,
        );
        if (!live(value)) return;
        const changed =
          JSON.stringify(resolved.couponState) !==
          JSON.stringify(result.couponState);
        const oldId =
          resolved.couponState.status === "selected"
            ? resolved.couponState.coupon.couponId
            : null;
        const nextId =
          result.couponState.status === "selected"
            ? result.couponState.coupon.couponId
            : null;
        update({
          resolved: { ...resolved, couponState: result.couponState },
          productId: oldId === nextId ? current.current.productId : null,
          review: changed || current.current.review,
          phase: "paymentOpen",
          validated: true,
          error: recoveryError,
        });
      } else if (live(value)) update({ phase: "paymentOpen", validated: true });
    } catch (error) {
      if (live(value)) {
        update({ phase: "paymentOpen", validated: false });
        classify(error, "coupon");
      }
    } finally {
      if (live(value)) locked.current = false;
    }
  }
  async function recover(
    saved: PosOrder,
    message: string,
    value: ReturnType<typeof ticket>,
  ) {
    try {
      const result = await posRequest<PosOrder>(orderUrl(saved.id));
      if (!live(value)) return;
      recoveryRequired.current = null;
      update({
        phase: current.current.resolved ? "ready" : "idle",
        validated: false,
        error: null,
        received: null,
        receivedError: null,
        review: true,
      });
      onRecovered(result, message);
    } catch (error) {
      if (live(value)) {
        update({
          phase: "paymentOpen",
          validated: false,
          error:
            "No pudimos recuperar la orden. Reintenta la revisión antes de confirmar.",
        });
        classify(error, "close");
      }
    }
  }
  async function confirm() {
    const saved = selected.current;
    const currentState = current.current;
    if (!saved || locked.current || recoveryRequired.current) return;
    const retry = currentState.phase === "closeUncertain";
    if (
      !retry &&
      (currentState.phase !== "paymentOpen" ||
        !currentState.validated ||
        currentState.review ||
        currentState.clientError ||
        currentState.receivedError)
    )
      return;
    const computed = paymentPreview(
      saved,
      currentState.resolved,
      currentState.productId,
      currentState.excludedId,
      currentState.received,
    );
    if (!retry && !computed.canConfirm) return;
    if (!attempt.current) {
      const body = {
        clientRequestId: crypto.randomUUID(),
        version: saved.version,
        ...(currentState.resolved
          ? { membershipId: currentState.resolved.membership.id }
          : {}),
        ...(computed.coupon
          ? {
              coupon: {
                couponId: computed.coupon.couponId,
                ...(!computed.coupon.productId && currentState.productId
                  ? { productId: currentState.productId }
                  : {}),
              },
            }
          : {}),
      };
      attempt.current = { orderId: saved.id, body: Object.freeze(body) };
    }
    locked.current = true;
    const value = ticket();
    update({ phase: "closing", error: null });
    onBeginClose();
    try {
      const request = posRequest<PosOrder>(
        `${orderUrl(attempt.current.orderId)}/close`,
        "POST",
        attempt.current.body,
      );
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const result = await Promise.race([
        request,
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error("El cierre no respondió a tiempo.")),
            15_000,
          );
        }),
      ]).finally(() => clearTimeout(timeout));
      if (live(value)) {
        attempt.current = null;
        update(initial());
        onClosed(result);
      }
    } catch (error) {
      if (!live(value)) return;
      if (!(error instanceof PosError) || (error.status ?? 500) >= 500) {
        update({
          phase: "closeUncertain",
          error:
            "No pudimos confirmar el cierre. Reintenta el mismo cobro antes de cambiar la orden o el cliente.",
        });
        return;
      }
      attempt.current = null;
      update({ phase: "paymentOpen", error: error.message });
      if (
        ["version_conflict", "pos_order_not_open", "request_reused"].includes(
          error.code ?? "",
        )
      ) {
        recoveryRequired.current =
          error.code === "pos_order_not_open"
            ? "La orden ya fue cerrada o anulada. Mostramos su estado guardado."
            : "Otra operación modificó la orden. Revisa la versión actual antes de confirmar un nuevo cobro.";
        await recover(saved, recoveryRequired.current, value);
      } else {
        classify(error, "close");
        if (error.code?.startsWith("coupon_") && live(value)) {
          update({ review: true, validated: false });
          locked.current = false;
          await prepare(error.message);
        } else if (live(value)) update({ validated: false });
      }
    } finally {
      if (live(value)) locked.current = false;
    }
  }
  return {
    ...state,
    preview,
    blocked,
    active,
    canNavigate: () => !denyNavigation(),
    scan: () => {
      if (!locked.current && !denyNavigation()) {
        ticket();
        update({ phase: "scanning", error: null });
      }
    },
    retryScan: () => {
      if (!locked.current && current.current.phase === "scanning") {
        ticket();
        update({ error: null });
      }
    },
    cancelScan,
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
      if (!denyNavigation()) update({ productId, received: null });
    },
    removeCoupon: () => {
      if (
        !denyNavigation() &&
        current.current.resolved?.couponState.status === "selected"
      )
        update({
          excludedId: current.current.resolved.couponState.coupon.couponId,
          productId: null,
          received: null,
          receivedError: null,
        });
    },
    removeClient: () => {
      if (!denyNavigation()) {
        ticket();
        locked.current = false;
        update({
          ...initial(),
          phase:
            current.current.phase === "paymentOpen" ? "paymentOpen" : "idle",
          validated: !recoveryRequired.current,
        });
      }
    },
    acceptReview: () => {
      if (!denyNavigation()) update({ review: false });
    },
  };
}
export type PosPayment = ReturnType<typeof usePosPayment>;
