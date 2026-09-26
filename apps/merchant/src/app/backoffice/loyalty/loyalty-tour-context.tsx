import { createContext, useContext, useState, type ReactNode } from "react";
import type { LoyaltyEditorSignal } from "./loyalty-tour-state";
const Context = createContext<{
  editor: LoyaltyEditorSignal | null;
  report: (signal: LoyaltyEditorSignal) => void;
} | null>(null);
export function LoyaltyTourProvider({ children }: { children: ReactNode }) {
  const [editor, report] = useState<LoyaltyEditorSignal | null>(null);
  return (
    <Context.Provider value={{ editor, report }}>{children}</Context.Provider>
  );
}
export function useLoyaltyTour() {
  const context = useContext(Context);
  if (!context) throw new Error("LoyaltyTourProvider required");
  return context;
}
