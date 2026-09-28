"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const catalogHref = "/backoffice/marketing";

export function useTemplateExit(editing: boolean) {
  const router = useRouter();
  const [target, setTarget] = useState<string | null>(null);
  const leaving = useRef(false);

  useEffect(() => {
    if (!editing) return;
    const editorPath = window.location.pathname;
    const guardKey = "__marketingEditorExit";
    const guardState = () => ({ ...window.history.state, [guardKey]: true });
    if (!window.history.state?.[guardKey])
      window.history.pushState(guardState(), "", window.location.href);
    const interceptBack = () => {
      if (leaving.current || window.location.pathname !== editorPath) return;
      if (window.history.state?.[guardKey]) return;
      window.history.pushState(guardState(), "", window.location.href);
      setTarget(catalogHref);
    };
    const warnOnUnload = (event: BeforeUnloadEvent) => {
      if (leaving.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const interceptLink = (event: MouseEvent) => {
      if (
        leaving.current ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        !(event.target instanceof Element)
      )
        return;
      const link = event.target.closest<HTMLAnchorElement>("a[href]");
      if (
        !link ||
        link.hasAttribute("download") ||
        (link.target && link.target !== "_self")
      )
        return;
      const destination = new URL(link.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      const href = `${destination.pathname}${destination.search}${destination.hash}`;
      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (href === current) return;
      event.preventDefault();
      event.stopPropagation();
      setTarget(href);
    };
    window.addEventListener("beforeunload", warnOnUnload);
    window.addEventListener("popstate", interceptBack);
    document.addEventListener("click", interceptLink, true);
    return () => {
      window.removeEventListener("beforeunload", warnOnUnload);
      window.removeEventListener("popstate", interceptBack);
      document.removeEventListener("click", interceptLink, true);
    };
  }, [editing]);

  return {
    target,
    ask: (href = catalogHref) => setTarget(href),
    stay: () => setTarget(null),
    leave: () => {
      if (!target) return;
      leaving.current = true;
      router.replace(target);
    },
    activated: () => {
      leaving.current = true;
      router.replace(catalogHref);
    },
  };
}
