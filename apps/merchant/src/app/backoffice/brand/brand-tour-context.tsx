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
  brandTaskPhases,
  transitionBrandTour,
  type BrandTask,
  type BrandTourSession,
  type BrandTourEvent,
} from "./brand-tour-state";

function useBrandTourState() {
  const [session, setSession] = useState<BrandTourSession | null>(null);
  const current = useRef<BrandTourSession | null>(null);
  const sequence = useRef(0);
  const start = useCallback((task: BrandTask) => {
    current.current = {
      instance: ++sequence.current,
      task,
      phase: brandTaskPhases[task][0],
    };
    setSession(current.current);
  }, []);
  const stop = useCallback(() => {
    current.current = null;
    setSession(null);
  }, []);
  const notify = useCallback(
    (event: BrandTourEvent, instance = current.current?.instance) => {
      if (!current.current || instance !== current.current.instance) return;
      current.current = transitionBrandTour(current.current, event);
      setSession(current.current);
    },
    [],
  );
  const ticket = useCallback(() => {
    const instance = current.current?.instance;
    return (event: BrandTourEvent) => {
      if (instance !== undefined) notify(event, instance);
    };
  }, [notify]);
  return { session, start, stop, notify, ticket };
}
const Context = createContext<ReturnType<typeof useBrandTourState> | null>(
  null,
);
export function BrandTourProvider({ children }: { children: ReactNode }) {
  return (
    <Context.Provider value={useBrandTourState()}>{children}</Context.Provider>
  );
}
export function useBrandTour() {
  const context = useContext(Context);
  if (!context) throw new Error("BrandTourProvider missing");
  return context;
}
