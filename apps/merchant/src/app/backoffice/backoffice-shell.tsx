"use client";
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const NavigationWidth = createContext<((compact: boolean) => void) | null>(
  null,
);
const unchanged = () => {};
const MobileNavigation = createContext<{
  hidden: boolean;
  setHidden: (hidden: boolean) => void;
}>({ hidden: false, setHidden: unchanged });

/** Presentation only; operation screens keep their own domain and permissions. */
export function BackofficeShell({ children }: { children: ReactNode }) {
  const [compact, setCompact] = useState(false);
  const [mobileHidden, setMobileHidden] = useState(false);
  const mobileNavigation = useMemo(
    () => ({ hidden: mobileHidden, setHidden: setMobileHidden }),
    [mobileHidden],
  );
  return (
    <NavigationWidth.Provider value={setCompact}>
      <MobileNavigation.Provider value={mobileNavigation}>
        <div
          className={`backoffice-layout print:block ${compact ? "min-[960px]:grid-cols-(--backoffice-compact-columns)" : ""}`}
        >
          {children}
        </div>
      </MobileNavigation.Provider>
    </NavigationWidth.Provider>
  );
}

export function useNavigationWidth() {
  return useContext(NavigationWidth) ?? unchanged;
}

export function useMobileNavigation() {
  return useContext(MobileNavigation);
}
