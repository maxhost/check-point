"use client";

import { useEffect, useState } from "react";
import {
  MODULES_CHANGED_EVENT,
  type BusinessModule,
} from "./module-navigation";
import { readModules } from "./module-request";

/** Un GET anterior a un cambio confirmado no puede restablecer el estado viejo. */
export function useBusinessModules() {
  const [modules, setModules] = useState<BusinessModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    let changed = false;
    const onChange = (event: Event) => {
      changed = true;
      setModules((event as CustomEvent<BusinessModule[]>).detail);
      setError(null);
      setLoading(false);
    };
    window.addEventListener(MODULES_CHANGED_EVENT, onChange);
    void readModules()
      .then((data) => {
        if (active && !changed) setModules(data);
      })
      .catch((cause) => {
        if (active && !changed)
          setError(
            cause instanceof Error
              ? cause.message
              : "No pudimos leer los módulos.",
          );
      })
      .finally(() => {
        if (active && !changed) setLoading(false);
      });
    return () => {
      active = false;
      window.removeEventListener(MODULES_CHANGED_EVENT, onChange);
    };
  }, [attempt]);
  function reload() {
    setError(null);
    setLoading(true);
    setAttempt((value) => value + 1);
  }
  return { modules, loading, error, reload };
}
