import type {
  BackofficeInitialContext,
  BackofficeModulesSeed,
  ModuleDTO,
} from "../../backoffice-context-contract";
import {
  createBackofficeRequestOwner,
  BackofficeRequestInvalidatedError,
} from "./backoffice-request-owner";
import {
  applyBackofficeModulesSeed,
  captureBackofficeTicket,
  createBackofficeContextState,
  invalidateBackofficeResources,
  isBackofficeTicketCurrent,
  observeBackofficeCoreSeed,
  retireBackofficeContext,
  type BackofficeContextState,
  type BackofficeResource,
  type BackofficeResourceTicket,
} from "./backoffice-context-state";
import { isBackofficeContextChanged } from "./backoffice-scope-request";
import { parseBackofficeSessionContext } from "./backoffice-session-context";
import {
  createInboxContextResource,
  emptyInboxContext,
  type InboxAdapters,
  type InboxContextState,
} from "./analytics/inbox-context-resource";

import {
  createChecklistContextResource,
  emptyChecklistContext,
  type ChecklistAdapters,
  type ChecklistContextState,
} from "./onboarding/checklist-context-resource";

export type BackofficeContextSnapshot = BackofficeContextState & {
  readonly sessionState: "ready" | "pending" | "unavailable";
  readonly inbox: InboxContextState;
  readonly checklist: ChecklistContextState;
};
type Adapters = InboxAdapters &
  ChecklistAdapters & {
    readSession: (signal: AbortSignal) => Promise<unknown>;
    readModules: (
      signal: AbortSignal,
      ticket: BackofficeResourceTicket,
    ) => Promise<ModuleDTO[]>;
    navigate: (href: "/" | "/backoffice") => void;
  };
const stampOf = (state: BackofficeContextState) => ({
  scopeKey: state.core?.scopeKey ?? null,
  epoch: state.epoch,
  generations: state.generations,
});

function isConfirmedModule(value: ModuleDTO): boolean {
  return (
    !!value &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.description === "string" &&
    typeof value.enabled === "boolean" &&
    typeof value.suggested === "boolean" &&
    Array.isArray(value.requires) &&
    value.requires.every((id) => typeof id === "string") &&
    Array.isArray(value.navigation) &&
    value.navigation.every(
      (entry) =>
        entry &&
        typeof entry.path === "string" &&
        typeof entry.label === "string" &&
        typeof entry.icon === "string" &&
        typeof entry.permission === "string",
    ) &&
    Array.isArray(value.permissions) &&
    value.permissions.every(
      (permission) =>
        permission &&
        typeof permission.id === "string" &&
        typeof permission.label === "string" &&
        typeof permission.description === "string",
    )
  );
}

/** Document-local source of presentation and causal tickets. Constructor performs no I/O. */
export function createBackofficeContextController(
  initial: BackofficeInitialContext,
  adapters: Adapters,
) {
  const serverSnapshot: BackofficeContextSnapshot = {
    ...createBackofficeContextState(initial),
    sessionState: "ready",
    inbox: emptyInboxContext(),
    checklist: emptyChecklistContext(),
  };
  let snapshot = serverSnapshot;
  const owner = createBackofficeRequestOwner(stampOf(snapshot));
  const listeners = new Set<() => void>();
  const queued = new Set<"session" | "modules">();
  let queueScheduled = false,
    disposed = false,
    navigated = false,
    attachments = 0;
  const inbox = createInboxContextResource(
    {
      owner,
      capture: () => captureTicket("inbox"),
      current: (ticket) => current(ticket),
      invalidate: () => invalidate(["inbox"]),
      get: () => snapshot.inbox,
      patch: (value) => commit({ ...snapshot, inbox: value }),
      retire: (href) => retire(href),
    },
    adapters,
  );

  const checklist = createChecklistContextResource(
    {
      owner,
      capture: () => captureTicket("checklist"),
      current: (ticket) => current(ticket),
      invalidate: () => invalidate(["checklist"]),
      get: () => snapshot.checklist,
      patch: (value) => commit({ ...snapshot, checklist: value }),
      revalidateCore: revalidateSessionModules,
      retire: (href) => retire(href),
    },
    adapters,
  );

  function commit(
    next: BackofficeContextState & {
      inbox?: InboxContextState;
      checklist?: ChecklistContextState;
    },
    sessionState = snapshot.sessionState,
  ) {
    if (disposed) return;
    snapshot = {
      ...next,
      sessionState,
      inbox: next.core ? (next.inbox ?? snapshot.inbox) : emptyInboxContext(),
      checklist: next.core
        ? (next.checklist ?? snapshot.checklist)
        : emptyChecklistContext(),
    };
    owner.reconcile(stampOf(snapshot)); // Synchronous before subscriptions or a new captured intent.
    inbox.reconcile();
    checklist.reconcile();
    for (const notify of [...listeners]) notify();
  }
  const current = (ticket: BackofficeResourceTicket) =>
    !disposed && isBackofficeTicketCurrent(snapshot, ticket);
  const captureTicket = (resource: BackofficeResource) =>
    disposed ? null : captureBackofficeTicket(snapshot, resource);

  function retire(href: "/" | "/backoffice" = "/backoffice") {
    if (disposed) return;
    queued.clear();
    commit(retireBackofficeContext(snapshot), "ready");
    if (!navigated) {
      navigated = true;
      adapters.navigate(href);
    }
  }

  function enqueue(resources: readonly ("session" | "modules")[]) {
    if (disposed || !snapshot.core) return;
    for (const resource of resources) queued.add(resource);
    if (queueScheduled) return;
    queueScheduled = true;
    queueMicrotask(() => {
      queueScheduled = false;
      const resources = [...queued];
      queued.clear();
      if (disposed || !snapshot.core) return;
      for (const resource of resources) void read(resource);
    });
  }

  async function read(resource: "session" | "modules") {
    const ticket = captureTicket(resource);
    if (!ticket) return;
    const lease = owner.acquire(ticket, (signal, captured) =>
      resource === "session"
        ? adapters.readSession(signal)
        : adapters.readModules(signal, captured),
    );
    try {
      const value = await lease.promise;
      if (!current(ticket) || !snapshot.core) return;
      if (resource === "modules") {
        commit({
          ...snapshot,
          modules: { state: "ready", modules: value as ModuleDTO[] },
        });
      } else {
        const session = parseBackofficeSessionContext(value);
        if (!session.authenticated) {
          retire("/");
          return;
        }
        if (
          !session.business ||
          !session.membership ||
          session.membership.status !== "active" ||
          session.user.id !== snapshot.core.userId ||
          session.business.id !== snapshot.core.business.id
        ) {
          retire();
          return;
        }
        if (!session.billing) throw new Error("backoffice-session-billing");
        commit(
          {
            ...snapshot,
            core: {
              ...snapshot.core,
              emailVerified: session.user.emailVerified,
              business: session.business,
              membership: session.membership,
              billing: session.billing,
            },
          },
          "ready",
        );
      }
    } catch (error) {
      if (
        !current(ticket) ||
        error instanceof BackofficeRequestInvalidatedError
      )
        return;
      if (isBackofficeContextChanged(error)) {
        retire();
        return;
      }
      if (resource === "session") commit(snapshot, "unavailable");
      else {
        const status =
          error && typeof error === "object" && "status" in error
            ? error.status
            : null;
        if (status === 401) {
          retire("/");
          return;
        }
        commit({
          ...snapshot,
          modules: {
            state:
              status === 402 || status === 403 ? "restricted" : "unavailable",
          },
        });
      }
    } finally {
      lease.release();
    }
  }

  function invalidate(resources: readonly BackofficeResource[]) {
    if (disposed || !snapshot.core || !resources.length) return;
    const recoverInitial =
      snapshot.modules.state === "loading" &&
      snapshot.initialModulesTicket !== null;
    commit(
      invalidateBackofficeResources(
        snapshot,
        recoverInitial ? [...resources, "modules"] : resources,
      ),
    );
    if (recoverInitial) enqueue(["modules"]);
  }
  function revalidateSessionModules() {
    if (disposed || !snapshot.core) return;
    invalidate(["session", "modules"]);
    commit(snapshot, "pending");
    enqueue(["session", "modules"]);
  }
  function revalidateModules() {
    if (disposed || !snapshot.core) return;
    invalidate(["modules"]);
    enqueue(["modules"]);
  }
  function applyConfirmedModule(
    ticket: BackofficeResourceTicket,
    value: ModuleDTO,
  ): boolean {
    if (
      !ticket ||
      ticket.resource !== "modules" ||
      !current(ticket) ||
      !isConfirmedModule(value) ||
      snapshot.modules.state !== "ready" ||
      !snapshot.modules.modules.some((module) => module.id === value.id)
    )
      return false;
    const confirmed: ModuleDTO = {
      id: value.id,
      name: value.name,
      description: value.description,
      enabled: value.enabled,
      suggested: value.suggested,
      requires: [...value.requires],
      navigation: value.navigation.map(({ path, label, icon, permission }) => ({
        path,
        label,
        icon,
        permission,
      })),
      permissions: value.permissions.map(({ id, label, description }) => ({
        id,
        label,
        description,
      })),
    };
    invalidate(["modules", "inbox", "checklist"]);
    const live = captureTicket("modules");
    if (
      !live ||
      live.scopeKey !== ticket.scopeKey ||
      live.epoch !== ticket.epoch ||
      live.generation !== ticket.generation + 1 ||
      snapshot.modules.state !== "ready"
    )
      return false;
    commit({
      ...snapshot,
      modules: {
        state: "ready",
        modules: snapshot.modules.modules.map((module) =>
          module.id === confirmed.id ? confirmed : module,
        ),
      },
    });
    return true;
  }
  function applyModulesSeed(seed: BackofficeModulesSeed) {
    const next = applyBackofficeModulesSeed(snapshot, seed);
    if (next === snapshot || disposed) return;
    commit(next);
    if (seed.result.state === "unavailable") {
      invalidate(["modules"]);
      enqueue(["modules"]); // One attempt per accepted initial seed, not per unavailable render.
    }
  }
  function observeCoreSeed(incoming: BackofficeInitialContext) {
    const next = observeBackofficeCoreSeed(snapshot, incoming);
    if (next === snapshot || disposed) return;
    if (!next.core) {
      retire();
      return;
    }
    commit(next, "pending");
    enqueue(["session", "modules"]);
  }
  function dispose() {
    if (disposed) return;
    snapshot = {
      ...retireBackofficeContext(snapshot),
      sessionState: "ready",
      inbox: emptyInboxContext(),
      checklist: emptyChecklistContext(),
    };
    disposed = true;
    queued.clear();
    inbox.dispose();
    checklist.dispose();
    owner.dispose();
    listeners.clear();
  }
  function attach() {
    if (disposed) return () => {};
    attachments += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      attachments -= 1;
      queueMicrotask(() => {
        if (!attachments) dispose();
      });
    };
  }
  return {
    getSnapshot: () => snapshot,
    // A supplied controller may already be retired before SSR/hydration starts.
    // Never expose the initial private snapshot again after that transition.
    getServerSnapshot: () => (snapshot.core ? serverSnapshot : snapshot),
    subscribe(notify: () => void) {
      listeners.add(notify);
      return () => {
        listeners.delete(notify);
      };
    },
    captureTicket,
    invalidate,
    applyModulesSeed,
    observeCoreSeed,
    revalidateSessionModules,
    revalidateModules,
    applyConfirmedModule,
    acquireInbox: inbox.acquire,
    refreshInbox: inbox.refresh,
    decideInbox: inbox.decide,
    acquireChecklist: checklist.acquire,
    refreshChecklist: checklist.refresh,
    verifyChecklistEmail: checklist.verify,
    retire,
    attach,
    dispose,
  };
}
export type BackofficeContextController = ReturnType<
  typeof createBackofficeContextController
>;
