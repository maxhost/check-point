"use client";

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type {
  BackofficeInitialContext,
  BackofficeModulesSeed,
} from "../../backoffice-context-contract";
import {
  createBackofficeContextController,
  type BackofficeContextController,
  type BackofficeContextSnapshot,
} from "./backoffice-context-controller";
import {
  observeBackofficeCoreSeed,
  type BackofficeResource,
  type BackofficeResourceTicket,
} from "./backoffice-context-state";
import { panelRequest } from "./panel-request";
import { emptyInboxContext } from "./analytics/inbox-context-resource";
import { readModules } from "./settings/module-request";
import { MODULES_CHANGED_EVENT } from "./settings/module-navigation";

type BackofficeContextValue = {
  state: BackofficeContextSnapshot;
  captureTicket: (
    resource: BackofficeResource,
  ) => BackofficeResourceTicket | null;
  applyModulesSeed: (seed: BackofficeModulesSeed) => void;
  invalidate: (resources: readonly BackofficeResource[]) => void;
  retire: () => void;
  acquireInbox: BackofficeContextController["acquireInbox"];
  refreshInbox: BackofficeContextController["refreshInbox"];
  decideInbox: BackofficeContextController["decideInbox"];
};

const BackofficeContext = createContext<BackofficeContextValue | null>(null);

/** One document's presentation and request owner. APIs remain the authority. */
export function BackofficeProvider({
  initialContext,
  children,
  controller: suppliedController,
}: {
  initialContext: BackofficeInitialContext;
  children: ReactNode;
  controller?: BackofficeContextController;
}) {
  const [controller] = useState(
    () =>
      suppliedController ??
      createBackofficeContextController(initialContext, {
        readSession: (signal) =>
          panelRequest<unknown>("/api/merchant/session", "GET", undefined, {
            signal,
          }),
        readModules: (signal, ticket) =>
          readModules({ signal, scopeKey: ticket.scopeKey }),
        readInbox: (signal, ticket) =>
          panelRequest("/api/analytics/inbox", "GET", undefined, {
            signal,
            scopeKey: ticket.scopeKey,
          }),
        decideInbox: (command, ticket) =>
          panelRequest(
            `/api/analytics/inbox/${command.cardId}/${command.decision}`,
            "POST",
            command.body,
            { scopeKey: ticket.scopeKey },
          ),
        navigate: (href) => window.location.assign(href),
      }),
  );
  const stored = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getServerSnapshot,
  );
  const observed = observeBackofficeCoreSeed(stored, initialContext);
  const state = useMemo(
    () => ({
      ...observed,
      sessionState: stored.sessionState,
      inbox: observed.core ? stored.inbox : emptyInboxContext(),
    }),
    [observed, stored.sessionState, stored.inbox],
  );
  // Hide a different scope during render, but reconcile/cancel only after commit:
  // an abandoned concurrent render must never mutate the live request owner.
  useLayoutEffect(() => {
    controller.observeCoreSeed(initialContext);
  }, [controller, initialContext]);
  useEffect(() => {
    const release = controller.attach();
    const changed = () => controller.revalidateSessionModules();
    window.addEventListener(MODULES_CHANGED_EVENT, changed);
    window.addEventListener("checkpass:modules-changed", changed);
    return () => {
      window.removeEventListener(MODULES_CHANGED_EVENT, changed);
      window.removeEventListener("checkpass:modules-changed", changed);
      release();
    };
  }, [controller]);
  const value = useMemo(
    () => ({
      state,
      captureTicket: controller.captureTicket,
      applyModulesSeed: controller.applyModulesSeed,
      invalidate: controller.invalidate,
      retire: controller.retire,
      acquireInbox: controller.acquireInbox,
      refreshInbox: controller.refreshInbox,
      decideInbox: controller.decideInbox,
    }),
    [state, controller],
  );
  return (
    <BackofficeContext.Provider value={value}>
      {state.core ? children : null}
    </BackofficeContext.Provider>
  );
}

/** The server leaf may arrive after invalidation; the state checks its ticket. */
export function BackofficeModulesSeedConsumer({
  seed,
}: {
  seed: BackofficeModulesSeed;
}) {
  const { applyModulesSeed } = useBackofficeContext();
  useEffect(() => {
    applyModulesSeed(seed);
  }, [applyModulesSeed, seed]);
  return null;
}

/** Null means absent provider, never a provider whose core has been withdrawn. */
export function useOptionalBackofficeContext() {
  return useContext(BackofficeContext);
}

export function useBackofficeContext() {
  const context = useOptionalBackofficeContext();
  if (!context) throw new Error("BackofficeProvider is required");
  // A present context with state.core === null must not use legacy props or
  // issue an unscoped operation. captureTicket also returns null in that state.
  return context;
}
