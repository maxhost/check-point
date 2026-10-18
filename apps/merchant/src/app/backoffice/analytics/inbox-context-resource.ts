import type {
  AnalyticsInboxMutation,
  AnalyticsInboxResponse,
  InboxCard,
  InboxDecision,
} from "@mi-pasaporte/domain/analytics/types";
import type { BackofficeResourceTicket } from "../backoffice-context-state";
import type { createBackofficeRequestOwner } from "../backoffice-request-owner";
import { BackofficeRequestInvalidatedError } from "../backoffice-request-owner";
import { isBackofficeContextChanged } from "../backoffice-scope-request";
import { PanelRequestError } from "../panel-request";

export type InboxContextState = {
  data: AnalyticsInboxResponse | null;
  error: string;
  pending: string | null;
};
export const emptyInboxContext = (): InboxContextState => ({
  data: null,
  error: "",
  pending: null,
});
export type InboxIntent = Readonly<{
  card: Pick<InboxCard, "id" | "version">;
  decision: InboxDecision;
  remindAt?: string;
}>;
export type InboxCommand = Readonly<{
  cardId: string;
  decision: InboxDecision;
  body: Readonly<{
    expectedVersion: string;
    operationId: string;
    remindAt?: string;
  }>;
}>;
export type InboxAdapters = {
  readInbox: (
    signal: AbortSignal,
    ticket: BackofficeResourceTicket,
  ) => Promise<AnalyticsInboxResponse>;
  decideInbox: (
    command: InboxCommand,
    ticket: BackofficeResourceTicket,
  ) => Promise<AnalyticsInboxMutation>;
};
type Host = {
  owner: ReturnType<typeof createBackofficeRequestOwner>;
  capture: () => BackofficeResourceTicket | null;
  current: (ticket: BackofficeResourceTicket) => boolean;
  invalidate: () => void;
  get: () => InboxContextState;
  patch: (state: InboxContextState) => void;
  retire: (href?: "/" | "/backoffice") => void;
};
const validCards = (cards: InboxCard[]) =>
  cards.filter((card) => Date.parse(card.expiresAt) >= Date.now());

/** Inbox orchestration only. Payload lives in the document snapshot; GETs use its owner. */
export function createInboxContextResource(host: Host, io: InboxAdapters) {
  let subscribers = 0;
  let scheduled = false;
  let queued = false;
  let mutation = false;
  let disposed = false;
  let active: { ticket: BackofficeResourceTicket; release: () => void } | null =
    null;
  let operation: { signature: string; id: string } | null = null;
  let reminder: string | null = null;
  let observed: BackofficeResourceTicket | null = null;
  let ownInvalidation = false;

  function schedule() {
    if (disposed || !subscribers || !host.capture()) return;
    queued = true;
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      if (!queued || mutation || active || !subscribers || disposed) return;
      queued = false;
      void read();
    });
  }
  async function read() {
    const ticket = host.capture();
    if (!ticket) return;
    const lease = host.owner.acquire(ticket, io.readInbox);
    const request = { ticket, release: lease.release };
    active = request;
    try {
      const data = await lease.promise;
      if (active !== request || !host.current(ticket)) return;
      if (data.contractVersion !== 2) throw new Error("inbox-contract");
      const state = host.get();
      host.patch({
        ...state,
        data: { ...data, cards: validCards(data.cards) },
        error:
          !state.data || state.error.startsWith("No pudimos leer")
            ? ""
            : state.error,
      });
    } catch (error) {
      if (
        active !== request ||
        !host.current(ticket) ||
        error instanceof BackofficeRequestInvalidatedError
      )
        return;
      if (isBackofficeContextChanged(error)) host.retire();
      else if (error instanceof PanelRequestError && error.status === 401)
        host.retire("/");
      else if (
        error instanceof PanelRequestError &&
        [402, 403].includes(error.status)
      )
        host.patch({ ...host.get(), data: null, error: error.message });
      else
        host.patch({
          ...host.get(),
          error: "No pudimos leer tus avisos. Intenta otra vez.",
        });
    } finally {
      lease.release();
      if (active === request) {
        active = null;
        if (queued) schedule();
      }
    }
  }
  function refresh(reason?: string) {
    if (disposed || !subscribers || !host.capture()) return;
    if (reason?.startsWith("reminder:")) {
      if (reminder === reason) return;
      reminder = reason;
    }
    const state = host.get();
    if (
      state.data &&
      state.data.cards.some((card) => Date.parse(card.expiresAt) < Date.now())
    )
      host.patch({
        ...state,
        data: { ...state.data, cards: validCards(state.data.cards) },
      });
    schedule();
  }
  function reconcile() {
    const next = host.capture();
    if (!next) {
      queued = false;
      operation = null;
      observed = null;
      active?.release();
      return;
    }
    const changed =
      observed &&
      (observed.generation !== next.generation ||
        observed.epoch !== next.epoch ||
        observed.scopeKey !== next.scopeKey);
    observed = next;
    if (changed && (!ownInvalidation || active)) schedule();
  }
  function acquire() {
    if (disposed || !host.capture()) return () => {};
    observed = host.capture();
    subscribers += 1;
    if (subscribers === 1 && (!active || !host.current(active.ticket)))
      schedule();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      subscribers -= 1;
      queueMicrotask(() => {
        if (subscribers || disposed) return;
        queued = false;
        // A POST keeps its causal ticket through a local remount; it is never replayed.
        if (!mutation && active) {
          const request = active;
          active = null;
          request.release();
        }
      });
    };
  }
  async function decide(input: InboxIntent) {
    if (mutation || disposed || !host.capture()) return { saved: false };
    // Primitive copies bind the command and idempotency key before any await.
    const { id: cardId, version: expectedVersion } = input.card;
    const { decision, remindAt } = input;
    mutation = true;
    ownInvalidation = true;
    host.invalidate(); // Closes prior GET/initial modules tickets BEFORE capturing this operation.
    ownInvalidation = false;
    const captured = host.capture();
    const ticket = captured && Object.freeze({ ...captured });
    if (!ticket) {
      mutation = false;
      return { saved: false };
    }
    const signature = JSON.stringify([
      ticket.scopeKey,
      ticket.epoch,
      cardId,
      expectedVersion,
      decision,
      remindAt,
    ]);
    if (operation?.signature !== signature)
      operation = { signature, id: crypto.randomUUID() };
    const command: InboxCommand = Object.freeze({
      cardId,
      decision,
      body: Object.freeze({
        expectedVersion,
        operationId: operation.id,
        ...(remindAt ? { remindAt } : {}),
      }),
    });
    host.patch({ ...host.get(), pending: cardId, error: "" });
    try {
      const result = await io.decideInbox(command, ticket);
      if (!host.current(ticket)) return { saved: false };
      const state = host.get();
      host.patch({
        ...state,
        data: state.data
          ? { ...state.data, ...result, cards: validCards(result.cards) }
          : null,
      });
      operation = null;
      return { saved: true };
    } catch (error) {
      if (!host.current(ticket)) return { saved: false };
      if (isBackofficeContextChanged(error)) {
        host.retire();
        return { saved: false };
      }
      if (error instanceof PanelRequestError && error.status === 401) {
        host.retire("/");
        return { saved: false };
      }
      if (
        error instanceof PanelRequestError &&
        [402, 403].includes(error.status)
      ) {
        queued = false;
        host.patch({ ...host.get(), data: null, error: error.message });
        return { saved: false };
      }
      const message =
        error instanceof PanelRequestError
          ? error.message
          : "No pudimos guardar la acción. Intenta otra vez.";
      if (
        error instanceof PanelRequestError &&
        [404, 409].includes(error.status)
      ) {
        operation = null;
        queued = true;
      }
      if (
        decision === "snooze" &&
        error instanceof PanelRequestError &&
        error.status === 422
      )
        return { saved: false, reminderError: message };
      host.patch({ ...host.get(), error: message });
      return {
        saved: false,
        conflict:
          error instanceof PanelRequestError &&
          [404, 409].includes(error.status),
      };
    } finally {
      mutation = false;
      const live = host.capture();
      if (live?.scopeKey === ticket.scopeKey && live.epoch === ticket.epoch)
        host.patch({ ...host.get(), pending: null });
      if (queued) schedule();
    }
  }
  return {
    acquire,
    refresh,
    decide,
    reconcile,
    dispose() {
      disposed = true;
      queued = false;
      operation = null;
      active?.release();
    },
  };
}
