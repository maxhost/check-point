import type { PosOrderV2, PosResolveV2, PosCouponStateV2 } from "../contracts";
import type { PosPaymentMethod } from "./pos-types";
import { PosError } from "./pos-types";
import { DiscardedPosIntent, type PosClient } from "./pos-context";
import type { PosCache } from "./pos-cache";
import {
  MeasuredPaymentClose,
  canonicalPaymentOrder,
} from "./measured-payment-close";
import { measuredPaymentPreview } from "./measured-payment-preview";

export type MeasuredPaymentState = {
  phase:
    | "idle"
    | "scanning"
    | "resolving"
    | "preparing"
    | "paymentOpen"
    | "closing"
    | "closeUncertain"
    | "review"
    | "closed"
    | "retired";
  order: PosOrderV2;
  resolved: PosResolveV2 | null;
  customerReview: boolean;
  target: string | null;
  excluded: boolean;
  methods: PosPaymentMethod[];
  methodId: string | null;
  received: string;
  validated: boolean;
  review: boolean;
  error: string | null;
};
/** Parent owns this instance across view unmounts. Only real identity withdrawal
 * calls retireIdentity; canLeave gates order changes and leaving the parent. */
export class MeasuredPaymentSession {
  private state: MeasuredPaymentState;
  private listeners = new Set<() => void>();
  private token = 0;
  private readonly close = new MeasuredPaymentClose(this);
  private readonly epoch: number;
  constructor(
    readonly client: PosClient,
    readonly cache: PosCache,
    readonly options: {
      order: PosOrderV2;
      historyStatus: "active" | "voided";
      uuid?: () => string;
      timeoutMs?: number;
      onClosed?: (order: PosOrderV2) => void;
      onReview?: (order: PosOrderV2) => void;
    },
  ) {
    if (options.order.contractVersion !== 2 || options.order.status !== "open")
      throw new Error("confirmed_open_order_required");
    this.epoch = cache.epoch;
    this.state = {
      phase: "idle",
      order: structuredClone(options.order),
      resolved: null,
      customerReview: false,
      target: null,
      excluded: false,
      methods: [],
      methodId: null,
      received: "",
      validated: false,
      review: false,
      error: null,
    };
  }
  async requestOrderReview() {
    if (this.blocked || this.state.phase !== "review") return;
    const token = ++this.token;
    try {
      const order = await this.client.capture()<PosOrderV2>(
        `/api/modules/pos/orders/${encodeURIComponent(this.state.order.id)}`,
      );
      if (this.live(token) && canonicalPaymentOrder(order, this.state.order.id))
        this.options.onReview?.(order);
    } catch (error) {
      this.failure(error, token, "review");
    }
  }
  confirm = () => this.close.confirm();
  retry = () => this.close.retry();
  acceptReviewedOrder(order: PosOrderV2) {
    if (
      this.blocked ||
      this.state.phase !== "review" ||
      !canonicalPaymentOrder(order, this.state.order.id)
    )
      return;
    this.token++;
    this.publish({
      order: structuredClone(order),
      phase: order.status === "open" ? "idle" : "review",
      validated: false,
      review: true,
      error:
        order.status === "open"
          ? null
          : "Esta orden ya no está abierta. Puedes salir para revisar su estado.",
    });
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  publish(patch: Partial<MeasuredPaymentState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  get blocked() {
    if (this.cache.epoch !== this.epoch && this.state.phase !== "retired")
      this.retireIdentity();
    return ["closing", "closeUncertain", "closed", "retired"].includes(
      this.state.phase,
    );
  }
  get canLeave() {
    return !["closing", "closeUncertain"].includes(this.state.phase);
  }
  get busy() {
    return (
      this.blocked || ["preparing", "resolving"].includes(this.state.phase)
    );
  }
  get preview() {
    const cash = this.state.methods.find(
      (method) => method.id === this.state.methodId,
    )?.isCash;
    return measuredPaymentPreview(
      this.state.order,
      this.state.resolved,
      this.state.target,
      this.state.excluded,
      cash && this.state.received !== "" ? this.state.received : null,
    );
  }
  retireIdentity() {
    this.token++;
    this.publish({
      phase: "retired",
      resolved: null,
      target: null,
      methods: [],
      received: "",
      validated: false,
    });
  }
  private live(token: number) {
    if (this.cache.epoch !== this.epoch) this.retireIdentity();
    return token === this.token && this.state.phase !== "retired";
  }
  private failure(
    error: unknown,
    token: number,
    phase: MeasuredPaymentState["phase"],
  ) {
    if (!this.live(token)) return;
    if (
      error instanceof DiscardedPosIntent ||
      (error instanceof PosError &&
        (error.status === 401 || error.code === "backoffice_context_changed"))
    )
      this.retireIdentity();
    else
      this.publish({
        phase,
        ...(phase === "scanning" ? { customerReview: true } : {}),
        validated: false,
        error:
          error instanceof PosError
            ? error.message
            : "No pudimos completar la revisión. Reintenta antes de confirmar.",
      });
  }
  startScan() {
    if (this.blocked) return;
    this.token++;
    this.publish({
      phase: "scanning",
      resolved: null,
      target: null,
      excluded: false,
      validated: false,
      review: false,
      error: null,
    });
  }
  cancelDialog() {
    if (!this.blocked) {
      this.token++;
      this.publish({ phase: "idle", validated: false });
    }
  }
  removeCustomer() {
    if (!this.blocked) {
      this.token++;
      this.publish({
        phase: "idle",
        customerReview: false,
        resolved: null,
        target: null,
        excluded: false,
        received: "",
        validated: false,
        review: false,
        error: null,
      });
    }
  }
  selectTarget(target: string | null) {
    if (!this.busy) this.publish({ target, validated: false, review: false });
  }
  excludeBenefit() {
    if (!this.busy)
      this.publish({ excluded: true, validated: false, review: false });
  }
  selectMethod(methodId: string | null) {
    if (!this.busy) this.publish({ methodId, received: "" });
  }
  setReceived(received: string) {
    if (!this.busy) this.publish({ received });
  }
  acknowledgeReview() {
    if (!this.busy && this.state.validated) this.publish({ review: false });
  }
  async resolve(qrToken: string) {
    if (this.blocked || this.state.phase !== "scanning") return;
    const token = ++this.token;
    const request = this.client.capture();
    this.publish({ phase: "resolving", error: null });
    try {
      const resolved = await request<PosResolveV2>(
        "/api/modules/pos/resolve",
        "POST",
        {
          qrToken,
          ...(this.state.order.location
            ? { locationId: this.state.order.location.id }
            : {}),
        },
      );
      if (this.live(token))
        this.publish({
          phase: "idle",
          customerReview: false,
          resolved,
          target: null,
          excluded: false,
          validated: false,
        });
    } catch (error) {
      this.failure(error, token, "scanning");
    }
  }
  async prepare() {
    if (this.busy || this.state.phase === "review" || this.state.customerReview)
      return;
    const token = ++this.token;
    const request = this.client.capture();
    const before = this.preview;
    const previousState = this.state.resolved?.couponState;
    this.publish({ phase: "preparing", validated: false, error: null });
    try {
      if (this.state.resolved) {
        const resolved = this.state.resolved;
        const response = await request<{ couponState: PosCouponStateV2 }>(
          `/api/modules/pos/coupon-state?membershipId=${encodeURIComponent(resolved.membership.id)}`,
        );
        if (!this.live(token)) return;
        const oldId =
          previousState?.status === "selected"
            ? previousState.coupon.couponId
            : null;
        const nextId =
          response.couponState.status === "selected"
            ? response.couponState.coupon.couponId
            : null;
        this.publish({
          resolved: { ...resolved, couponState: response.couponState },
          ...(oldId !== nextId ? { excluded: false, target: null } : {}),
        });
      }
      const after = this.preview;
      const review =
        this.state.review ||
        JSON.stringify(previousState) !==
          JSON.stringify(this.state.resolved?.couponState) ||
        before.amounts?.collected !== after.amounts?.collected ||
        before.targetSourceLineId !== after.targetSourceLineId;
      if (after.amounts && !/^0(?:\.00)?$/.test(after.amounts.collected)) {
        const result = await request<{
          methods: PosPaymentMethod[];
          defaultMethodId: string | null;
        }>("/api/modules/pos/payment-methods");
        if (!this.live(token)) return;
        result.methods = result.methods.filter(
          (method) => method.status === "active",
        );
        const methodId = result.methods.some(
          (method) => method.id === this.state.methodId,
        )
          ? this.state.methodId
          : result.defaultMethodId;
        this.publish({ methods: result.methods, methodId });
      } else this.publish({ methods: [], methodId: null });
      if (this.live(token))
        this.publish({ phase: "paymentOpen", validated: true, review });
    } catch (error) {
      this.failure(error, token, "paymentOpen");
    }
  }
}
