import {
  orderUrl,
  posRequest,
  type PosCatalog,
  type PosHistory,
  type PosOrder,
} from "./pos-types";

export class DiscardedPosRead extends Error {}
export const historyKey = "history";
export const catalogKey = (locationId: string) => `catalog:${locationId}`;
export const detailKey = (id: string) => `order:${id}`;

/** Private to one mounted console. No timers, persistence or shared module state. */
export class PosCache {
  context: string | null = null;
  epoch = 0;
  private entries = new Map<string, { value: unknown; valid: boolean }>();
  private generations = new Map<string, number>();
  private pending = new Map<string, Promise<unknown>>();

  clear() {
    this.epoch += 1;
    this.context = null;
    this.entries.clear();
    this.generations.clear();
    this.pending.clear();
  }
  bind(context: string) {
    if (this.context === context) return false;
    this.clear();
    this.context = context;
    return true;
  }
  peek<T>(key: string, includeInvalid = false): T | null {
    const entry = this.entries.get(key);
    return entry && (entry.valid || includeInvalid) ? (entry.value as T) : null;
  }
  put<T>(key: string, value: T, valid = true) {
    this.entries.set(key, { value, valid });
  }
  invalidate(key: string, invalidateValue = true) {
    this.generations.set(key, (this.generations.get(key) ?? 0) + 1);
    this.pending.delete(key);
    const entry = this.entries.get(key);
    if (entry && invalidateValue) entry.valid = false;
  }
  invalidateResources() {
    for (const key of new Set([...this.entries.keys(), ...this.pending.keys()]))
      if (key !== "session") this.invalidate(key);
  }
  read<T>(key: string, request: () => Promise<T>, force = false): Promise<T> {
    if (force) this.invalidate(key);
    const cached = this.peek<T>(key);
    if (cached !== null) return Promise.resolve(cached);
    const pending = this.pending.get(key);
    if (pending) return pending as Promise<T>;
    const epoch = this.epoch;
    const generation = this.generations.get(key) ?? 0;
    const current = () =>
      this.epoch === epoch && (this.generations.get(key) ?? 0) === generation;
    const promise = request()
      .then((value) => {
        if (!current()) throw new DiscardedPosRead();
        if (key.startsWith("order:")) {
          const previous = this.peek<PosOrder>(key, true);
          if (previous && previous.version > (value as PosOrder).version) {
            this.put(key, previous);
            return previous as T;
          }
        }
        this.put(key, value);
        return value;
      })
      .catch((error) => {
        if (!current()) throw new DiscardedPosRead();
        throw error;
      })
      .finally(() => {
        if (this.pending.get(key) === promise) this.pending.delete(key);
      });
    this.pending.set(key, promise);
    return promise;
  }
  history(force = false) {
    return this.read(
      historyKey,
      () => posRequest<PosHistory>("/api/pos/orders"),
      force,
    );
  }
  order(id: string, force = false) {
    return this.read(
      detailKey(id),
      () => posRequest<PosOrder>(orderUrl(id)),
      force,
    );
  }
  catalog(locationId: string) {
    return this.read(catalogKey(locationId), () =>
      posRequest<PosCatalog>(
        `/api/pos/catalog${locationId ? `?locationId=${encodeURIComponent(locationId)}` : ""}`,
      ),
    );
  }
  beginWrite(id?: string) {
    if (id) this.invalidate(detailKey(id));
    // Invalidate pending history reads, keeping the last confirmed list for patching.
    this.invalidate(historyKey, false);
  }
  accept(order: PosOrder) {
    this.invalidate(detailKey(order.id));
    const previous = this.peek<PosOrder>(detailKey(order.id), true);
    const result =
      previous && previous.version > order.version ? previous : order;
    this.put(detailKey(result.id), result);
    const history = this.peek<PosHistory>(historyKey, true);
    if (history) {
      const wasValid = this.peek(historyKey) !== null;
      this.invalidate(historyKey, false);
      this.put(
        historyKey,
        {
          open: [
            ...history.open.filter((item) => item.id !== result.id),
            ...(result.status === "open"
              ? [
                  {
                    ...result,
                    itemCount: result.items.reduce(
                      (sum, item) => sum + item.quantity,
                      0,
                    ),
                    saleTotal: result.sale?.total ?? null,
                  },
                ]
              : []),
          ].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
          closedToday: history.closedToday.filter(
            (item) => item.id !== result.id,
          ),
        } satisfies PosHistory,
        wasValid,
      );
    }
    return result;
  }
  remove(id: string) {
    this.invalidate(detailKey(id));
    this.entries.delete(detailKey(id));
    const history = this.peek<PosHistory>(historyKey, true);
    if (history) {
      this.invalidate(historyKey, false);
      this.put(
        historyKey,
        {
          open: history.open.filter((item) => item.id !== id),
          closedToday: history.closedToday.filter((item) => item.id !== id),
        },
        false,
      );
    }
  }
}
