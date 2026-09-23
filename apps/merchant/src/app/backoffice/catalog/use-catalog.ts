"use client";

import { useCallback, useEffect, useState } from "react";
import type { Catalog, Category } from "./types";

export const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

/**
 * El acceso de la pantalla a `/api/catalog`: la carga, las mutaciones y sus avisos.
 *
 * Nace en la spec 0092 por el limite de tamaño (`catalog-page.tsx` ya estaba encima): es la
 * misma division por concern que ya tiene el importador en `use-catalog-import.ts`. **No hay
 * cambio de comportamiento acá**; lo unico nuevo de la spec en este archivo es que el
 * `Catalog` que devuelve el `GET` ahora trae `importInProgress`, que viaja tal cual.
 */
export function useCatalog() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/catalog");
      const payload = (await res.json().catch(() => null)) as
        | Catalog
        | { error?: string }
        | null;
      if (!res.ok || !payload || !("products" in payload)) {
        throw new Error(
          (payload as { error?: string } | null)?.error ??
            "No pudimos cargar el catálogo.",
        );
      }
      setCatalog(payload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Error de carga.");
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const mutate = useCallback(
    async (
      input: RequestInfo,
      init: RequestInit,
      okMessage: string,
      fallback: string,
    ): Promise<boolean> => {
      try {
        const res = await fetch(input, init);
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        if (!res.ok) throw new Error(payload?.error ?? fallback);
        await reload();
        setNotice(okMessage);
        return true;
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : fallback);
        return false;
      }
    },
    [reload],
  );

  const createCategory = useCallback(
    async (name: string): Promise<Category | null> => {
      if (!name) return null;
      try {
        const res = await fetch(
          "/api/catalog/category",
          jsonInit("POST", { name }),
        );
        const cat = (await res.json().catch(() => null)) as
          | Category
          | { error?: string }
          | null;
        if (!res.ok || !cat || !("id" in cat)) {
          throw new Error(
            (cat as { error?: string } | null)?.error ??
              "No pudimos crear la categoría.",
          );
        }
        await reload();
        setNotice("Categoría creada.");
        return cat;
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Error.");
        return null;
      }
    },
    [reload],
  );

  return {
    catalog,
    notice,
    error,
    setNotice,
    setError,
    reload,
    mutate,
    createCategory,
  };
}
