"use client";
import { emptySummaryContext } from "./analytics/summary-context-resource";

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
import { useRouter } from "next/navigation";
import { panelRequest } from "./panel-request";
import { emptyInboxContext } from "./analytics/inbox-context-resource";
import { readModules } from "./settings/module-request";
import { emptyChecklistContext } from "./onboarding/checklist-context-resource";
import { getOnboardingChecklist } from "./onboarding/onboarding-api";
import { ONBOARDING_TOUR_ENDED_EVENT } from "./onboarding/onboarding-tour";
import { MODULES_CHANGED_EVENT } from "./settings/module-navigation";

type BackofficeContextValue = {
  state: BackofficeContextSnapshot;
  captureTicket: (
    resource: BackofficeResource,
  ) => BackofficeResourceTicket | null;
  applyModulesSeed: (seed: BackofficeModulesSeed) => void;
  invalidate: (resources: readonly BackofficeResource[]) => void;
  retire: () => void;
  acquireSummary: BackofficeContextController["acquireSummary"];
  refreshSummary: BackofficeContextController["refreshSummary"];
  acquireInbox: BackofficeContextController["acquireInbox"];
  refreshInbox: BackofficeContextController["refreshInbox"];
  decideInbox: BackofficeContextController["decideInbox"];
  applyConfirmedModule: BackofficeContextController["applyConfirmedModule"];
  revalidateModules: BackofficeContextController["revalidateModules"];
  acquireChecklist: BackofficeContextController["acquireChecklist"];
  refreshChecklist: BackofficeContextController["refreshChecklist"];
  verifyChecklistEmail: BackofficeContextController["verifyChecklistEmail"];
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
  const router = useRouter();
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
        readSummary: (signal, ticket) =>
          panelRequest("/api/analytics/summary", "GET", undefined, {
            signal,
            scopeKey: ticket.scopeKey,
          }),
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
        readChecklist: (signal, ticket) =>
          getOnboardingChecklist(signal, { scopeKey: ticket.scopeKey }),
        verifyEmail: async () => {
          const response = await fetch("/api/merchant/auth/verify-email", {
            method: "POST",
            credentials: "same-origin",
          });
          if (!response.ok) throw new Error("verify-email-failed");
          return response.json();
        },
        requestRefresh: () => router.refresh(),
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
      summary: observed.core ? stored.summary : emptySummaryContext(),
      inbox: observed.core ? stored.inbox : emptyInboxContext(),
      checklist: observed.core ? stored.checklist : emptyChecklistContext(),
    }),
    [
      observed,
      stored.sessionState,
      stored.summary,
      stored.inbox,
      stored.checklist,
    ],
  );
  // Hide a different scope during render, but reconcile/cancel only after commit:
  // an abandoned concurrent render must never mutate the live request owner.
  useLayoutEffect(() => {
    controller.observeCoreSeed(initialContext);
  }, [controller, initialContext]);
  useEffect(() => {
    const release = controller.attach();
    const changed = () => controller.revalidateVisible();
    const focused = () => {
      if (document.visibilityState === "visible")
        controller.revalidateVisible();
    };
    window.addEventListener("focus", focused);
    window.addEventListener("online", focused);
    window.addEventListener(
      ONBOARDING_TOUR_ENDED_EVENT,
      controller.refreshChecklist,
    );
    window.addEventListener(MODULES_CHANGED_EVENT, changed);
    window.addEventListener("checkpass:modules-changed", changed);
    return () => {
      window.removeEventListener(
        ONBOARDING_TOUR_ENDED_EVENT,
        controller.refreshChecklist,
      );
      window.removeEventListener(MODULES_CHANGED_EVENT, changed);
      window.removeEventListener("checkpass:modules-changed", changed);
      window.removeEventListener("focus", focused);
      window.removeEventListener("online", focused);
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
      acquireSummary: controller.acquireSummary,
      refreshSummary: controller.refreshSummary,
      acquireInbox: controller.acquireInbox,
      refreshInbox: controller.refreshInbox,
      decideInbox: controller.decideInbox,
      applyConfirmedModule: controller.applyConfirmedModule,
      revalidateModules: controller.revalidateModules,
      acquireChecklist: controller.acquireChecklist,
      refreshChecklist: controller.refreshChecklist,
      verifyChecklistEmail: controller.verifyChecklistEmail,
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

/** Live presentation in the otherwise server-rendered blocked billing shell. */
export function BackofficeBusinessName() {
  return useBackofficeContext().state.core?.business.name ?? null;
}
