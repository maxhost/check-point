import type {
  DeepReadonly,
  PosCreateV2,
  PosOrderV2,
  PosUpdateV2,
} from "../contracts";
import { MeasuredOrderCache } from "./measured-order-cache";
import { type PosCache } from "./pos-cache";
import {
  DiscardedPosIntent,
  type PosClient,
  type PosRequest,
} from "./pos-context";
import { orderUrl, PosError } from "./pos-types";

type CreateDraft = Omit<PosCreateV2, "createRequestId">;
export type MeasuredOrderIntent = Readonly<{
  method: "POST" | "PUT";
  url: string;
  body: DeepReadonly<PosCreateV2 | PosUpdateV2>;
}>;
export type MeasuredOrderCommandState =
  | Readonly<{ status: "idle" | "retired" }>
  | Readonly<{ status: "pending"; intent: MeasuredOrderIntent }>
  | Readonly<{
      status: "uncertain" | "conflict" | "rejected";
      intent: MeasuredOrderIntent;
      error: unknown;
    }>
  | Readonly<{
      status: "confirmed";
      intent: MeasuredOrderIntent;
      order: PosOrderV2;
    }>;

function frozenCopy<T>(value: T): T {
  const copy = structuredClone(value);
  function freeze(part: unknown): void {
    if (part && typeof part === "object") {
      Object.values(part).forEach(freeze);
      Object.freeze(part);
    }
  }
  freeze(copy);
  return copy;
}

/** One mounted editor's commands. Caller supplies a contractVersion:2 PosClient.
 * historyStatus must match the supplied PosCache constructor/list filter.
 * No automatic retries. retire() permanently withdraws this instance on teardown.
 * Pending/uncertain calls keep the original intent (also when passed another draft).
 * Subscribe/getSnapshot can be consumed directly by useSyncExternalStore.
 */
export class MeasuredOrderCommands {
  private state: MeasuredOrderCommandState = Object.freeze({ status: "idle" });
  private listeners = new Set<() => void>();
  private attempt?: {
    intent: MeasuredOrderIntent;
    request: PosRequest;
    epoch: number;
    uncertainCreate: boolean;
  };
  private pending?: Promise<MeasuredOrderCommandState>;
  private readonly canonical: MeasuredOrderCache;

  constructor(
    private readonly client: PosClient,
    private readonly cache: PosCache,
    private readonly options: {
      historyStatus: "active" | "voided";
      uuid?: () => string;
    },
  ) {
    this.canonical = new MeasuredOrderCache(cache, options.historyStatus);
  }

  getSnapshot = (): MeasuredOrderCommandState => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(state: MeasuredOrderCommandState) {
    this.state = Object.freeze(state);
    this.listeners.forEach((listener) => listener());
  }
  retire() {
    this.attempt = undefined;
    this.publish({ status: "retired" });
  }
  create(draft: CreateDraft): Promise<MeasuredOrderCommandState> {
    if (this.blocked()) return this.pending ?? Promise.resolve(this.state);
    return this.start("POST", "/api/modules/pos/orders", {
      ...draft,
      createRequestId: (this.options.uuid ?? (() => crypto.randomUUID()))(),
    });
  }
  update(id: string, draft: PosUpdateV2): Promise<MeasuredOrderCommandState> {
    if (this.blocked()) return this.pending ?? Promise.resolve(this.state);
    return this.start("PUT", orderUrl(id), draft, id);
  }
  private blocked() {
    return (
      this.state.status === "pending" ||
      this.state.status === "uncertain" ||
      this.state.status === "retired"
    );
  }
  private start(
    method: "POST" | "PUT",
    url: string,
    body: PosCreateV2 | PosUpdateV2,
    id?: string,
  ) {
    const intent = frozenCopy({ method, url, body });
    const request = this.client.capture();
    this.cache.beginWrite(id);
    this.attempt = {
      intent,
      request,
      epoch: this.cache.epoch,
      uncertainCreate: false,
    };
    return this.send(this.attempt);
  }
  retry(): Promise<MeasuredOrderCommandState> {
    if (this.state.status === "pending") return this.pending!;
    if (this.state.status !== "uncertain" || !this.attempt)
      return Promise.resolve(this.state);
    return this.send(this.attempt);
  }
  private send(
    attempt: NonNullable<MeasuredOrderCommands["attempt"]>,
  ): Promise<MeasuredOrderCommandState> {
    // Install pending before notifying subscribers, including synchronous double clicks.
    let finish!: (state: MeasuredOrderCommandState) => void;
    const promise = new Promise<MeasuredOrderCommandState>((resolve) => {
      finish = resolve;
    });
    this.pending = promise;
    this.publish({ status: "pending", intent: attempt.intent });
    const current = () =>
      this.attempt === attempt && this.cache.epoch === attempt.epoch;
    void (async () => {
      try {
        if (!current()) {
          if (this.attempt === attempt) this.retire();
          return;
        }
        const order = await attempt.request<PosOrderV2>(
          attempt.intent.url,
          attempt.intent.method,
          attempt.intent.body,
        );
        if (!current()) {
          if (this.attempt === attempt) this.retire();
          return;
        }
        // A successful but unreadable response remains ambiguous, never a new create.
        if (
          !order ||
          order.contractVersion !== 2 ||
          typeof order.id !== "string" ||
          !order.id ||
          !["open", "closed", "voided"].includes(order.status) ||
          typeof order.createdAt !== "string" ||
          typeof order.orderLabel !== "string" ||
          typeof order.total !== "string" ||
          !order.business ||
          typeof order.business.currencyCode !== "string" ||
          !Number.isInteger(order.version) ||
          !Array.isArray(order.items) ||
          order.items.some(
            (line) =>
              !line ||
              typeof line.lineId !== "string" ||
              typeof line.quantity !== "string" ||
              typeof line.lineTotal !== "string" ||
              !line.measure,
          )
        )
          throw new Error("invalid_pos_order_response");
        // The resource is known even if the cache subsequently requires review.
        attempt.uncertainCreate = false;
        const canonical = this.canonical.accept(order);
        this.publish({
          status: "confirmed",
          intent: attempt.intent,
          order: canonical,
        });
      } catch (error) {
        if (!current()) {
          if (this.attempt === attempt) this.retire();
          return;
        }
        if (
          error instanceof DiscardedPosIntent ||
          (error instanceof PosError &&
            (error.status === 401 ||
              error.code === "backoffice_context_changed"))
        ) {
          this.retire();
        } else {
          // Known 4xx (except timeout) reject definitively; unknown transport,
          // parse errors, HTTP 408 and 5xx may have committed on the server.
          const definitive =
            error instanceof PosError &&
            error.status !== undefined &&
            error.status >= 400 &&
            error.status < 500 &&
            error.status !== 408;
          // A rejected recovery says nothing about the earlier POST's commit.
          // Only a usable canonical DTO or identity withdrawal resolves that risk.
          if (attempt.intent.method === "POST" && !definitive)
            attempt.uncertainCreate = true;
          this.publish({
            status:
              definitive && !attempt.uncertainCreate
                ? error.status === 409
                  ? "conflict"
                  : "rejected"
                : "uncertain",
            intent: attempt.intent,
            error,
          });
        }
      } finally {
        if (this.pending === promise) this.pending = undefined;
        finish(this.state);
      }
    })();
    return promise;
  }
}
