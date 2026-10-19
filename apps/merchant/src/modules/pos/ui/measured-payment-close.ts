import type { PosCloseV2, PosOrderV2 } from "../contracts";
import { MeasuredOrderCache } from "./measured-order-cache";
import { DiscardedPosIntent, type PosRequest } from "./pos-context";
import { orderUrl, PosError } from "./pos-types";
import type { MeasuredPaymentSession } from "./measured-payment-session";

// HTTP owns only method and amount; the server assigns payment identities.
export type MeasuredPaymentBody = Omit<PosCloseV2, "payments"> & {
  payments: { methodId: string; amount: string }[];
};
function frozen<T>(value: T): T {
  const copy = structuredClone(value);
  const visit = (part: unknown) => {
    if (part && typeof part === "object") {
      Object.values(part).forEach(visit);
      Object.freeze(part);
    }
  };
  visit(copy);
  return copy;
}
export function canonicalPaymentOrder(
  value: unknown,
  id: string,
): value is PosOrderV2 {
  const order = value as PosOrderV2 | null;
  return (
    !!order &&
    order.contractVersion === 2 &&
    order.id === id &&
    ["open", "closed", "voided"].includes(order.status) &&
    Number.isInteger(order.version) &&
    typeof order.createdAt === "string" &&
    typeof order.total === "string" &&
    typeof order.orderLabel === "string" &&
    !!order.business?.currencyCode &&
    Array.isArray(order.items) &&
    order.items.every(
      (line) =>
        typeof line.lineId === "string" &&
        typeof line.quantity === "string" &&
        typeof line.unitPrice === "string" &&
        typeof line.lineTotal === "string" &&
        !!line.measure,
    )
  );
}
/** Internal command owned by the parent-held session, never a component. */
export class MeasuredPaymentClose {
  private attempt?: {
    body: MeasuredPaymentBody;
    request: PosRequest;
    epoch: number;
    ambiguous: boolean;
  };
  private pending?: Promise<void>;
  private notified = false;
  constructor(private readonly session: MeasuredPaymentSession) {}
  confirm(): Promise<void> {
    const s = this.session;
    if (this.pending) return this.pending;
    if (s.blocked || s.busy) return Promise.resolve();
    const state = s.getSnapshot(),
      preview = s.preview;
    const zero =
      preview.amounts && /^0(?:\.00)?$/.test(preview.amounts.collected);
    const method = state.methods.find((item) => item.id === state.methodId);
    if (
      state.phase !== "paymentOpen" ||
      !state.validated ||
      state.review ||
      !preview.canConfirm ||
      !preview.amounts ||
      (!zero && !method)
    )
      return Promise.resolve();
    const uuid = s.options.uuid ?? (() => crypto.randomUUID());
    const coupon = preview.coupon;
    this.attempt = {
      body: frozen({
        clientRequestId: uuid(),
        version: state.order.version,
        ...(state.resolved
          ? { membershipId: state.resolved.membership.id }
          : {}),
        ...(coupon
          ? {
              coupon: {
                couponId: coupon.couponId,
                ...(coupon.productId
                  ? { productId: coupon.productId }
                  : preview.targetSourceLineId
                    ? {
                        productId: state.order.items.find(
                          (line) => line.lineId === preview.targetSourceLineId,
                        )!.productId,
                      }
                    : {}),
                ...(preview.targetSourceLineId
                  ? { targetSourceLineId: preview.targetSourceLineId }
                  : {}),
              },
            }
          : {}),
        payments: zero
          ? []
          : [
              {
                methodId: method!.id,
                amount: preview.amounts.collected,
              },
            ],
      }),
      request: s.client.capture(),
      epoch: s.cache.epoch,
      ambiguous: false,
    };
    s.cache.beginWrite(state.order.id);
    return this.send(this.attempt);
  }
  retry(): Promise<void> {
    if (this.pending) return this.pending;
    return this.session.getSnapshot().phase === "closeUncertain" && this.attempt
      ? this.send(this.attempt)
      : Promise.resolve();
  }
  private send(
    attempt: NonNullable<MeasuredPaymentClose["attempt"]>,
  ): Promise<void> {
    const s = this.session;
    const id = s.getSnapshot().order.id;
    const live = () => {
      if (s.cache.epoch !== attempt.epoch) s.retireIdentity();
      return s.getSnapshot().phase !== "retired" && this.attempt === attempt;
    };
    let finish!: () => void;
    const promise = new Promise<void>((resolve) => {
      finish = resolve;
    });
    this.pending = promise;
    s.publish({ phase: "closing", error: null });
    void (async () => {
      let closed: PosOrderV2 | undefined;
      let review: PosOrderV2 | undefined;
      try {
        if (!live()) return;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const result = await Promise.race([
          attempt.request<PosOrderV2>(
            `${orderUrl(id)}/close`,
            "POST",
            attempt.body,
          ),
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => reject(new Error("close_timeout")),
              s.options.timeoutMs ?? 15000,
            );
          }),
        ]).finally(() => clearTimeout(timer));
        if (!live()) return;
        if (!canonicalPaymentOrder(result, id))
          throw new Error("invalid_close_response");
        if (result.status === "closed") {
          // Canonical server success is final, including if cache/callback later fails.
          this.attempt = undefined;
          s.publish({
            phase: "closed",
            order: frozen(result),
            validated: false,
            error: null,
          });
          closed = result;
          try {
            new MeasuredOrderCache(s.cache, s.options.historyStatus).accept(
              result,
            );
          } catch {
            /* Server outcome stays closed; parent can review its cache. */
          }
        } else {
          this.attempt = undefined;
          s.publish({
            phase: "review",
            validated: false,
            review: true,
            error:
              "Revisa el estado guardado de esta orden antes de continuar.",
          });
          review = result;
        }
      } catch (error) {
        if (!live()) return;
        if (
          error instanceof DiscardedPosIntent ||
          (error instanceof PosError &&
            (error.status === 401 ||
              error.code === "backoffice_context_changed"))
        ) {
          this.attempt = undefined;
          s.retireIdentity();
          return;
        }
        const definitive =
          error instanceof PosError &&
          error.status !== undefined &&
          error.status >= 400 &&
          error.status < 500 &&
          error.status !== 408;
        if (!definitive) attempt.ambiguous = true;
        if (attempt.ambiguous)
          s.publish({
            phase: "closeUncertain",
            error:
              "No pudimos confirmar el cierre. Reintenta el mismo cobro antes de salir o cambiar la orden.",
            validated: false,
          });
        else {
          this.attempt = undefined;
          const candidate =
            error instanceof PosError
              ? (error.payload.order ?? error.order)
              : null;
          if (canonicalPaymentOrder(candidate, id)) review = candidate;
          s.publish({
            phase: "review",
            validated: false,
            review: true,
            error:
              error instanceof PosError
                ? error.message
                : "Revisa la orden antes de continuar.",
          });
        }
      } finally {
        if (this.pending === promise) this.pending = undefined;
        finish();
        // UI effects are outside command failure classification.
        if (
          closed &&
          !this.notified &&
          s.cache.epoch === attempt.epoch &&
          s.getSnapshot().phase === "closed"
        ) {
          this.notified = true;
          try {
            s.options.onClosed?.(closed);
          } catch {
            /* A UI effect cannot undo payment. */
          }
        }
        if (
          review &&
          s.cache.epoch === attempt.epoch &&
          s.getSnapshot().phase !== "retired"
        ) {
          try {
            s.options.onReview?.(review);
          } catch {
            /* Parent may present the stored review later. */
          }
        }
      }
    })();
    return promise;
  }
}
