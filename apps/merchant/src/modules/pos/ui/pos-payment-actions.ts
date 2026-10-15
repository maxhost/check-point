import type {
  CounterCouponState,
  ResolveResponse,
} from "../../../app/backoffice/counter/types";
import { paymentPreview } from "./pos-payment-preview";
import {
  orderUrl,
  PosError,
  posRequest,
  type PosOrder,
  type PosPaymentMethod,
} from "./pos-types";
import { initial, type PaymentRuntime } from "./pos-payment-state";
export function createPaymentActions(runtime: PaymentRuntime) {
  const {
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
  } = runtime;
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
        "/api/modules/pos/resolve",
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
          notice: "Cliente identificado",
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
          `/api/modules/pos/coupon-state?membershipId=${encodeURIComponent(resolved.membership.id)}`,
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
          error: recoveryError,
        });
      }
      if (!live(value)) return;
      const currentPreview = paymentPreview(
        selected.current!,
        current.current.resolved,
        current.current.productId,
        current.current.excludedId,
      );
      if ((currentPreview.netCents ?? 0) > 0) {
        const result = await posRequest<{
          methods: PosPaymentMethod[];
          defaultMethodId: string | null;
        }>("/api/modules/pos/payment-methods");
        if (!live(value)) return;
        const methodId = result.methods.some(
          (method) => method.id === current.current.methodId,
        )
          ? current.current.methodId
          : result.defaultMethodId;
        update({ methods: result.methods, methodId });
      }
      if (live(value)) update({ phase: "paymentOpen", validated: true });
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
      currentState.methods.find((method) => method.id === currentState.methodId)
        ?.isCash
        ? currentState.received
        : null,
    );
    if (
      !retry &&
      (!computed.canConfirm ||
        ((computed.netCents ?? 0) > 0 && !currentState.methodId))
    )
      return;
    if (!attempt.current) {
      const body = {
        clientRequestId: crypto.randomUUID(),
        version: saved.version,
        payments:
          (computed.netCents ?? 0) === 0
            ? []
            : [
                {
                  methodId: currentState.methodId,
                  amount: computed.collectedAmount,
                },
              ],
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
  return { resolve, prepare, confirm };
}
