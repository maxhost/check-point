"use client";
import { useEffect, type RefObject } from "react";
import type { PaymentState } from "./pos-payment-state";
/** Preserve the existing navigation protection while a durable close is uncertain. */
export function usePosCloseNavigation(
  blocked: boolean,
  current: RefObject<PaymentState>,
  setState: (state: PaymentState) => void,
) {
  useEffect(() => {
    if (!blocked) return;
    const restoreUrl = window.location.href;
    const restoreState = window.history.state;
    const warn = () => {
      current.current = {
        ...current.current,
        error:
          "Resuelve el cobro pendiente con Reintentar cobro antes de salir.",
      };
      setState(current.current);
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!["closing", "closeUncertain"].includes(current.current.phase))
        return;
      event.preventDefault();
      event.returnValue = "";
    };
    const links = (event: MouseEvent) => {
      if (!["closing", "closeUncertain"].includes(current.current.phase))
        return;
      const anchor =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank")
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      warn();
    };
    const history = (event: PopStateEvent) => {
      if (!["closing", "closeUncertain"].includes(current.current.phase))
        return;
      event.stopImmediatePropagation();
      window.history.pushState(restoreState, "", restoreUrl);
      warn();
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("popstate", history, true);
    document.addEventListener("click", links, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("popstate", history, true);
      document.removeEventListener("click", links, true);
    };
  }, [blocked, current, setState]);
}
