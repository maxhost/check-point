"use client";
import { createContext, useContext, useState, type ReactNode } from "react";

const NavigationWidth = createContext<((compact: boolean) => void) | null>(
  null,
);
const unchanged = () => {};

/** Presentation only; operation screens keep their own domain and permissions. */
export function BackofficeShell({ children }: { children: ReactNode }) {
  const [compact, setCompact] = useState(false);
  return (
    <NavigationWidth.Provider value={setCompact}>
      <div
        className={`backoffice-layout print:block ${compact ? "min-[960px]:grid-cols-(--backoffice-compact-columns)" : ""}`}
      >
        {children}
      </div>
    </NavigationWidth.Provider>
  );
}

export function useNavigationWidth() {
  return useContext(NavigationWidth) ?? unchanged;
}
