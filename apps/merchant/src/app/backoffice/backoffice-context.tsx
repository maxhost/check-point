"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  BackofficeInitialContext,
  BackofficeModulesSeed,
} from "../../backoffice-context-contract";
import {
  applyBackofficeModulesSeed,
  captureBackofficeTicket,
  createBackofficeContextState,
  invalidateBackofficeResources,
  observeBackofficeCoreSeed,
  retireBackofficeContext,
  type BackofficeContextState,
  type BackofficeResource,
  type BackofficeResourceTicket,
} from "./backoffice-context-state";

type BackofficeContextValue = {
  state: BackofficeContextState;
  captureTicket: (
    resource: BackofficeResource,
  ) => BackofficeResourceTicket | null;
  applyModulesSeed: (seed: BackofficeModulesSeed) => void;
  invalidate: (resources: readonly BackofficeResource[]) => void;
  retire: () => void;
};

const BackofficeContext = createContext<BackofficeContextValue | null>(null);

/** Presentation owner only. No network, browser events or server authority. */
export function BackofficeProvider({
  initialContext,
  children,
}: {
  initialContext: BackofficeInitialContext;
  children: ReactNode;
}) {
  const [stored, setState] = useState(() =>
    createBackofficeContextState(initialContext),
  );
  const state = observeBackofficeCoreSeed(stored, initialContext);
  // Reconcile before rendering descendants, so a different RSC scope cannot
  // expose the previous private presentation for one effect/paint.
  if (state !== stored) setState(state);

  const applyModulesSeed = useCallback((seed: BackofficeModulesSeed) => {
    setState((current) => applyBackofficeModulesSeed(current, seed));
  }, []);
  const invalidate = useCallback((resources: readonly BackofficeResource[]) => {
    setState((current) => invalidateBackofficeResources(current, resources));
  }, []);
  const retire = useCallback(() => {
    setState(retireBackofficeContext);
  }, []);
  const captureTicket = useCallback(
    (resource: BackofficeResource) => captureBackofficeTicket(state, resource),
    [state],
  );
  const value = useMemo(
    () => ({ state, captureTicket, applyModulesSeed, invalidate, retire }),
    [state, captureTicket, applyModulesSeed, invalidate, retire],
  );
  return (
    <BackofficeContext.Provider value={value}>
      {children}
    </BackofficeContext.Provider>
  );
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
