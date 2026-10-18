import {
  parseDashboardSummary,
  type DashboardSummary,
} from "@mi-pasaporte/domain/analytics/dashboard-summary";
import type { BackofficeResourceTicket } from "../backoffice-context-state";
import {
  BackofficeRequestInvalidatedError,
  type createBackofficeRequestOwner,
} from "../backoffice-request-owner";
import { isBackofficeContextChanged } from "../backoffice-scope-request";
import { PanelRequestError } from "../panel-request";

export type SummaryContextState = {
  data: DashboardSummary | null;
  status: "idle" | "loading" | "ready" | "restricted" | "unavailable";
};
export const emptySummaryContext = (): SummaryContextState => ({
  data: null,
  status: "idle",
});
export type SummaryAdapters = {
  readSummary: (
    signal: AbortSignal,
    ticket: BackofficeResourceTicket,
  ) => Promise<unknown>;
};
type Host = {
  owner: ReturnType<typeof createBackofficeRequestOwner>;
  capture: () => BackofficeResourceTicket | null;
  current: (ticket: BackofficeResourceTicket) => boolean;
  invalidate: () => void;
  get: () => SummaryContextState;
  patch: (state: SummaryContextState) => void;
  retire: (href?: "/" | "/backoffice") => void;
};
/** Only summary scheduling. The document snapshot owns data, and its existing owner owns GETs. */
export function createSummaryContextResource(host: Host, io: SummaryAdapters) {
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
    const lease = host.owner.acquire(ticket, io.readSummary);
    const request = { ticket, release: lease.release };
    active = request;
    host.patch({ ...host.get(), status: "loading" });
    try {
      const data = parseDashboardSummary(await lease.promise);
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
      else if (error instanceof PanelRequestError && error.status === 401)
        host.retire("/");
      else if (
        error instanceof PanelRequestError &&
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
    if (disposed || !subscribers || !host.capture()) return;
    // Retire a previous generation before an explicit fresh intention.
    host.invalidate();
    schedule();
  }
  return {
    acquire,
    refresh,
    refreshIfObserved: () => {
      if (subscribers) refresh();
    },
    reconcile,
    dispose() {
      disposed = true;
      queued = false;
      active?.release();
    },
  };
}
