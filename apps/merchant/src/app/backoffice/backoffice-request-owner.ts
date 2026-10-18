import {
  backofficeResources,
  type BackofficeResource,
  type BackofficeResourceTicket,
} from "./backoffice-context-state";

export type BackofficeRequestStamp = Readonly<{
  scopeKey: string | null;
  epoch: number;
  generations: Readonly<Record<BackofficeResource, number>>;
}>;
type Loader<T> = (
  signal: AbortSignal,
  ticket: BackofficeResourceTicket,
) => Promise<T>;
type Lease<T> = { promise: Promise<T>; release: () => void };
type Entry = {
  ticket: BackofficeResourceTicket;
  load: Loader<unknown>;
  controller: AbortController;
  promise: Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  subscribers: Set<symbol>;
  obsolete: boolean;
  started: boolean;
};
type Slot = { active?: Entry; pending?: Entry };

/** Local cancellation, deliberately different from HTTP backoffice_context_changed. */
export class BackofficeRequestInvalidatedError extends Error {
  constructor(
    readonly reason: "generation" | "scope" | "released" | "disposed",
  ) {
    super("La lectura del panel dejó de estar vigente.");
  }
}

function cloneStamp(stamp: BackofficeRequestStamp): BackofficeRequestStamp {
  return Object.freeze({
    scopeKey: stamp.scopeKey,
    epoch: stamp.epoch,
    generations: Object.freeze({ ...stamp.generations }),
  });
}

/**
 * One document's four fixed GET resources. No response cache, mutation, HTTP,
 * auth or React wiring. The first subscriber supplies that resource's loader;
 * consumers must agree on its response type and domain in the provider.
 */
export function createBackofficeRequestOwner(initial: BackofficeRequestStamp) {
  let stamp = cloneStamp(initial);
  let disposed = false;
  const slots = new Map<BackofficeResource, Slot>();

  function current(ticket: BackofficeResourceTicket) {
    return (
      !disposed &&
      stamp.scopeKey !== null &&
      backofficeResources.includes(ticket.resource) &&
      ticket.scopeKey === stamp.scopeKey &&
      ticket.epoch === stamp.epoch &&
      ticket.generation === stamp.generations[ticket.resource]
    );
  }

  function invalidate(
    entry: Entry,
    reason: BackofficeRequestInvalidatedError["reason"],
  ) {
    if (entry.obsolete) return;
    entry.obsolete = true;
    entry.reject(new BackofficeRequestInvalidatedError(reason));
    entry.controller.abort();
  }

  function finish(entry: Entry) {
    const slot = slots.get(entry.ticket.resource);
    // An old scope's finally cannot remove a new scope's active entry.
    if (!slot || slot.active !== entry) return;
    slot.active = undefined;
    const pending = slot.pending;
    slot.pending = undefined;
    if (
      pending &&
      !pending.obsolete &&
      pending.subscribers.size &&
      current(pending.ticket)
    ) {
      slot.active = pending;
      start(pending);
    } else {
      if (pending) invalidate(pending, "generation");
      slots.delete(entry.ticket.resource);
    }
  }

  function start(entry: Entry) {
    if (entry.started) return;
    entry.started = true;
    try {
      const work = entry.load(entry.controller.signal, entry.ticket);
      void Promise.resolve(work).then(
        (value) => {
          if (!entry.obsolete && current(entry.ticket)) entry.resolve(value);
          finish(entry);
        },
        (error: unknown) => {
          if (!entry.obsolete) entry.reject(error);
          finish(entry);
        },
      );
    } catch (error) {
      entry.reject(error);
      finish(entry);
    }
  }

  function createEntry(
    ticket: BackofficeResourceTicket,
    load: Loader<unknown>,
  ): Entry {
    let resolve!: Entry["resolve"];
    let reject!: Entry["reject"];
    const promise = new Promise<unknown>((done, fail) => {
      resolve = done;
      reject = fail;
    });
    // Observe even if all consumers release/dispose before attaching handlers.
    void promise.catch(() => {});
    return {
      ticket,
      load,
      promise,
      resolve,
      reject,
      controller: new AbortController(),
      subscribers: new Set(),
      obsolete: false,
      started: false,
    };
  }

  function acquire<T>(
    input: BackofficeResourceTicket,
    load: Loader<T>,
  ): Lease<T> {
    const ticket = Object.freeze({
      resource: input.resource,
      scopeKey: input.scopeKey,
      epoch: input.epoch,
      generation: input.generation,
    });
    if (!current(ticket)) {
      const reason = disposed
        ? "disposed"
        : stamp.scopeKey === null ||
            ticket.scopeKey !== stamp.scopeKey ||
            ticket.epoch !== stamp.epoch
          ? "scope"
          : "generation";
      const promise = Promise.reject<T>(
        new BackofficeRequestInvalidatedError(reason),
      );
      void promise.catch(() => {});
      return { promise, release: () => {} };
    }
    let slot = slots.get(ticket.resource);
    if (!slot) {
      slot = {};
      slots.set(ticket.resource, slot);
    }
    const matching = (entry?: Entry) =>
      entry &&
      !entry.obsolete &&
      entry.ticket.scopeKey === ticket.scopeKey &&
      entry.ticket.epoch === ticket.epoch &&
      entry.ticket.generation === ticket.generation;
    let entry = matching(slot.active)
      ? slot.active
      : matching(slot.pending)
        ? slot.pending
        : undefined;
    if (!entry) {
      entry = createEntry(ticket, load);
      if (slot.active) {
        if (slot.pending) invalidate(slot.pending, "generation");
        slot.pending = entry;
      } else slot.active = entry;
    }
    const subscribed = entry;
    const subscriber = Symbol();
    subscribed.subscribers.add(subscriber);
    if (slot.active === subscribed && subscribed.subscribers.size === 1)
      start(subscribed);
    return {
      promise: subscribed.promise as Promise<T>,
      release() {
        if (!subscribed.subscribers.delete(subscriber)) return;
        if (subscribed.subscribers.size) return;
        queueMicrotask(() => {
          if (subscribed.subscribers.size || subscribed.obsolete) return;
          invalidate(subscribed, "released");
          const activeSlot = slots.get(ticket.resource);
          if (activeSlot?.pending === subscribed)
            activeSlot.pending = undefined;
        });
      },
    };
  }

  function reconcile(input: BackofficeRequestStamp) {
    if (disposed) return;
    const next = cloneStamp(input);
    const changedScope =
      next.scopeKey !== stamp.scopeKey || next.epoch !== stamp.epoch;
    stamp = next;
    for (const slot of slots.values()) {
      for (const entry of [slot.active, slot.pending])
        if (entry && !current(entry.ticket))
          invalidate(entry, changedScope ? "scope" : "generation");
      if (slot.pending?.obsolete) slot.pending = undefined;
    }
    if (changedScope) slots.clear();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const slot of slots.values())
      for (const entry of [slot.active, slot.pending])
        if (entry) invalidate(entry, "disposed");
    slots.clear();
  }

  return { acquire, reconcile, dispose };
}
