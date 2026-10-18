import type { BackofficeResourceTicket } from "../backoffice-context-state";
import {
  BackofficeRequestInvalidatedError,
  type createBackofficeRequestOwner,
} from "../backoffice-request-owner";
import { isBackofficeContextChanged } from "../backoffice-scope-request";
import {
  OnboardingRequestError,
  type OnboardingChecklist,
} from "./onboarding-api";

export type ChecklistContextState = {
  data: OnboardingChecklist | null;
  status: "idle" | "loading" | "ready" | "restricted" | "unavailable";
};
export const emptyChecklistContext = (): ChecklistContextState => ({
  data: null,
  status: "idle",
});
export type ChecklistAdapters = {
  readChecklist: (
    signal: AbortSignal,
    ticket: BackofficeResourceTicket,
  ) => Promise<OnboardingChecklist>;
  verifyEmail: () => Promise<unknown>;
};
type Host = {
  owner: ReturnType<typeof createBackofficeRequestOwner>;
  capture: () => BackofficeResourceTicket | null;
  current: (ticket: BackofficeResourceTicket) => boolean;
  invalidate: () => void;
  get: () => ChecklistContextState;
  patch: (state: ChecklistContextState) => void;
  revalidateCore: () => void;
  retire: (href?: "/" | "/backoffice") => void;
};
/** Only checklist scheduling. The document snapshot owns data, and its existing owner owns GETs. */
export function createChecklistContextResource(
  host: Host,
  io: ChecklistAdapters,
) {
  let subscribers = 0,
    scheduled = false,
    queued = false,
    disposed = false;
  let observed: BackofficeResourceTicket | null = null;
  let active: { ticket: BackofficeResourceTicket; release: () => void } | null =
    null;
  function schedule() {
    if (disposed || !subscribers || !host.capture()) return;
    queued = true;
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      if (!queued || active || !subscribers || disposed || !host.capture())
        return;
      queued = false;
      void read();
    });
  }
  async function read() {
    const ticket = host.capture();
    if (!ticket) return;
    const lease = host.owner.acquire(ticket, io.readChecklist);
    const request = { ticket, release: lease.release };
    active = request;
    host.patch({ ...host.get(), status: "loading" });
    try {
      const data = await lease.promise;
      if (active !== request || !host.current(ticket)) return;
      host.patch({ data, status: "ready" });
    } catch (error) {
      if (
        active !== request ||
        !host.current(ticket) ||
        error instanceof BackofficeRequestInvalidatedError
      )
        return;
      if (isBackofficeContextChanged(error)) host.retire();
      else if (error instanceof OnboardingRequestError && error.status === 401)
        host.retire("/");
      else if (
        error instanceof OnboardingRequestError &&
        [402, 403].includes(error.status)
      )
        host.patch({ data: null, status: "restricted" });
      else host.patch({ ...host.get(), status: "unavailable" });
    } finally {
      lease.release();
      if (active === request) {
        active = null;
        if (queued) schedule();
      }
    }
  }
  function reconcile() {
    const next = host.capture();
    if (!next) {
      queued = false;
      observed = null;
      active?.release();
      return;
    }
    const changed =
      observed &&
      (next.scopeKey !== observed.scopeKey ||
        next.epoch !== observed.epoch ||
        next.generation !== observed.generation);
    observed = next;
    if (changed) schedule();
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
        const request = active;
        active = null;
        request?.release();
      });
    };
  }
  function refresh() {
    if (disposed || !host.capture()) return;
    // END is a mutation signal. Invalidate now, even if an old GET is still draining.
    host.invalidate();
    schedule();
  }
  async function verify(): Promise<"sent" | "verified" | "error" | "obsolete"> {
    const captured = host.capture();
    if (disposed || !captured) return "obsolete";
    const ticket = Object.freeze({ ...captured });
    const sameIdentity = () => {
      const current = host.capture();
      return (
        !disposed &&
        current?.scopeKey === ticket.scopeKey &&
        current.epoch === ticket.epoch
      );
    };
    try {
      const result = await io.verifyEmail(); // Auth endpoint is deliberately exempt from scope headers.
      if (!sameIdentity()) return "obsolete";
      if (!result || typeof result !== "object") return "error";
      if ("verified" in result && result.verified === true) {
        refresh();
        host.revalidateCore();
        return "verified"; // Only a subsequent scoped GET may confirm checklist data.
      }
      return "sent" in result && result.sent === true ? "sent" : "error";
    } catch {
      return sameIdentity() ? "error" : "obsolete";
    }
  }
  return {
    acquire,
    refresh,
    verify,
    reconcile,
    dispose() {
      disposed = true;
      queued = false;
      active?.release();
    },
  };
}
