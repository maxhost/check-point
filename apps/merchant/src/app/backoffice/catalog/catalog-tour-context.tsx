"use client";
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  initialCatalogPhase,
  transitionCatalogTour,
  type CatalogHelpTour,
  type CatalogTourEvent,
  type CatalogTourSession,
} from "./catalog-tour-state";

type CatalogTourContextValue = {
  session: CatalogTourSession | null;
  start: (task: CatalogHelpTour, multipleLocations: boolean) => void;
  stop: () => void;
  notify: (event: CatalogTourEvent) => void;
  ticket: () => (event: CatalogTourEvent) => void;
};
const Context = createContext<CatalogTourContextValue | null>(null);
export function CatalogTourProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<CatalogTourSession | null>(null);
  const current = useRef<CatalogTourSession | null>(null);
  const sequence = useRef(0);
  const notify = useCallback(
    (event: CatalogTourEvent, instance = current.current?.instance) => {
      const active = current.current;
      if (!active || active.instance !== instance) return;
      const next = transitionCatalogTour(active, event);
      current.current = next;
      setSession(next);
    },
    [],
  );
  const stop = useCallback(() => {
    current.current = null;
    setSession(null);
  }, []);
  const start = useCallback(
    (task: CatalogHelpTour, multipleLocations: boolean) => {
      const next = {
        instance: ++sequence.current,
        task,
        phase: initialCatalogPhase(task),
        multipleLocations,
      };
      current.current = next;
      setSession(next);
    },
    [],
  );
  const ticket = useCallback(() => {
    const instance = current.current?.instance;
    return (event: CatalogTourEvent) => {
      if (instance !== undefined) notify(event, instance);
    };
  }, [notify]);
  return (
    <Context.Provider value={{ session, start, stop, notify, ticket }}>
      {children}
    </Context.Provider>
  );
}
export function useCatalogTour() {
  return useContext(Context);
}
