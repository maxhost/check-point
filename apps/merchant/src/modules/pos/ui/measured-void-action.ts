import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { PosOrderV2 } from "../contracts";
import { MeasuredOrderCache } from "./measured-order-cache";
import { canonicalPaymentOrder } from "./measured-payment-close";
import { PosCache } from "./pos-cache";
import {
  DiscardedPosIntent,
  type PosClient,
  type PosRequest,
} from "./pos-context";
import { orderUrl, PosError } from "./pos-types";

export type MeasuredVoidState = Readonly<{
  phase: "idle" | "pending" | "uncertain" | "review" | "confirmed" | "retired";
  order: PosOrderV2 | null;
  error: unknown;
}>;

/** Focal void owner. The original transport/body survive view and console remounts. */
export class MeasuredVoidAction {
  readonly cache: PosCache;
  private state: MeasuredVoidState = {
    phase: "idle",
    order: null,
    error: null,
  };
  private listeners = new Set<() => void>();
  private attempt?: {
    id: string;
    body: Readonly<{ version: number }>;
    request: PosRequest;
    epoch: number;
    ambiguous: boolean;
  };
  private pending?: Promise<void>;
  mounted = 0;
  constructor(
    readonly identity: string,
    private readonly client: PosClient,
    private readonly timeZone: string,
    private readonly timeoutMs = 15000,
  ) {
    this.cache = new PosCache(undefined, client.request);
    this.cache.bind(identity);
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  get canLeave() {
    return !["pending", "uncertain", "review"].includes(this.state.phase);
  }
  private publish(state: MeasuredVoidState) {
    this.state = Object.freeze(state);
    this.listeners.forEach((listener) => listener());
  }
  retire() {
    this.attempt = undefined;
    this.publish({ phase: "retired", order: null, error: null });
    this.cache.clear();
  }
  confirm(order: PosOrderV2): Promise<void> {
    if (this.pending) return this.pending;
    if (
      !this.canLeave ||
      this.state.phase === "retired" ||
      order.status !== "open"
    )
      return Promise.resolve();
    this.attempt = {
      id: order.id,
      body: Object.freeze({ version: order.version }),
      request: this.client.capture(),
      epoch: this.cache.epoch,
      ambiguous: false,
    };
    this.cache.beginWrite(order.id);
    this.state = { phase: "idle", order, error: null };
    return this.send(this.attempt);
  }
  retry(): Promise<void> {
    if (this.pending) return this.pending;
    return this.state.phase === "uncertain" && this.attempt
      ? this.send(this.attempt)
      : Promise.resolve();
  }
  private accept(order: PosOrderV2) {
    return new MeasuredOrderCache(this.cache, "active").accept(order, {
      historyWindow: { timeZone: this.timeZone, now: new Date() },
    });
  }
  /** Conflict recovery is an explicit read/review, never an automatic write retry. */
  async review() {
    if (this.state.phase !== "review" || !this.state.order) return;
    const id = this.state.order.id;
    const epoch = this.cache.epoch;
    try {
      const order = await this.client.capture()<PosOrderV2>(orderUrl(id));
      if (this.state.phase !== "review" || this.cache.epoch !== epoch) return;
      if (!canonicalPaymentOrder(order, id))
        throw new Error(
          "No pudimos leer la orden actual. Reintenta la revisión.",
        );
      this.accept(order);
      this.publish({ phase: "idle", order, error: null });
    } catch (error) {
      if (this.cache.epoch !== epoch) return;
      if (this.withdrawn(error)) this.retire();
      else this.publish({ ...this.state, error });
    }
  }
  private withdrawn(error: unknown) {
    return (
      error instanceof DiscardedPosIntent ||
      (error instanceof PosError &&
        (error.status === 401 || error.code === "backoffice_context_changed"))
    );
  }
  private send(
    attempt: NonNullable<MeasuredVoidAction["attempt"]>,
  ): Promise<void> {
    let finish!: () => void;
    const promise = new Promise<void>((resolve) => {
      finish = resolve;
    });
    this.pending = promise;
    const live = () =>
      this.attempt === attempt && this.cache.epoch === attempt.epoch;
    this.publish({ ...this.state, phase: "pending", error: null });
    void (async () => {
      try {
        if (!live()) return;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const order = await Promise.race([
          attempt.request<PosOrderV2>(
            `${orderUrl(attempt.id)}/void`,
            "POST",
            attempt.body,
          ),
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => reject(new Error("void_timeout")),
              this.timeoutMs,
            );
          }),
        ]).finally(() => clearTimeout(timer));
        if (!live()) return;
        if (
          !canonicalPaymentOrder(order, attempt.id) ||
          order.status !== "voided"
        )
          throw new Error("invalid_void_response");
        this.attempt = undefined;
        try {
          this.accept(order);
          this.publish({ phase: "confirmed", order, error: null });
        } catch (error) {
          // The server outcome is final even if a newer cached revision needs review.
          this.publish({ phase: "review", order, error });
        }
      } catch (error) {
        if (!live()) return;
        if (this.withdrawn(error)) {
          this.retire();
          return;
        }
        const definitive =
          error instanceof PosError &&
          error.status !== undefined &&
          error.status >= 400 &&
          error.status < 500 &&
          error.status !== 408;
        if (!definitive) attempt.ambiguous = true;
        if (attempt.ambiguous) {
          this.publish({ ...this.state, phase: "uncertain", error });
        } else {
          this.attempt = undefined;
          if (error instanceof PosError && error.status === 404) {
            this.cache.remove(attempt.id);
            this.publish({ phase: "idle", order: null, error });
          } else this.publish({ ...this.state, phase: "review", error });
        }
      } finally {
        if (this.pending === promise) this.pending = undefined;
        finish();
      }
    })();
    return promise;
  }
}

// Only unresolved owners survive teardown; another real identity retires them.
const retained = new Map<string, MeasuredVoidAction>();
export function measuredVoidOwner(
  identity: string,
  client: PosClient,
  timeZone: string,
) {
  for (const [key, owner] of retained) {
    if (key !== identity) {
      owner.retire();
      retained.delete(key);
    }
  }
  let owner = retained.get(identity);
  if (!owner) {
    owner = new MeasuredVoidAction(identity, client, timeZone);
    retained.set(identity, owner);
  }
  return owner;
}
export function retireMeasuredVoidIdentity(identity: string) {
  retained.get(identity)?.retire();
  retained.delete(identity);
}
export function mountMeasuredVoidOwner(owner: MeasuredVoidAction) {
  owner.mounted++;
  return () => {
    owner.mounted--;
    queueMicrotask(() => {
      if (!owner.mounted && owner.canLeave) {
        if (retained.get(owner.identity) === owner)
          retained.delete(owner.identity);
        owner.retire();
      }
    });
  };
}

export function useMeasuredVoidAction(
  identity: string,
  client: PosClient,
  timeZone: string,
) {
  const owner = useMemo(
    () => measuredVoidOwner(identity, client, timeZone),
    [identity, client, timeZone],
  );
  const state = useSyncExternalStore(
    owner.subscribe,
    owner.getSnapshot,
    owner.getSnapshot,
  );
  useEffect(() => mountMeasuredVoidOwner(owner), [owner]);
  return { owner, state };
}
