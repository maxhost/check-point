"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCatalogTour } from "./catalog-tour-context";
import { CatalogWriteError } from "./catalog-product-draft";
import type { Catalog, Category, Product } from "./types";

export const catalogHeaders = { "X-Catalog-Contract": "2" };

export const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "content-type": "application/json", ...catalogHeaders },
  body: JSON.stringify(body),
});

/**
 * El acceso de la pantalla a `/api/catalog`: la carga, las mutaciones y sus avisos.
 *
 * Nace en la spec 0092 por el limite de tamaño (`catalog-page.tsx` ya estaba encima): es la
 * misma division que ya tiene el importador. Spec 0096 distingue el éxito de la escritura
 * de una recarga fallida: un reintento de lectura nunca repite la escritura confirmada.
 */
export function useCatalog() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [uncertainWrite, setUncertainWrite] = useState(false);
  const uncertainRef = useRef(false);
  const [writing, setWriting] = useState(false);
  const writingRef = useRef(false);
  const pendingRefresh = useRef<(() => void) | null>(null);
  const readAccessError = useRef<string | null>(null);
  const tour = useCatalogTour();
  const stop = tour?.stop;
  const ticket = tour?.ticket;

  const reload = useCallback(async () => {
    readAccessError.current = null;
    try {
      const res = await fetch("/api/catalog", {
        headers: catalogHeaders,
        cache: "no-store",
      });
      const payload = (await res.json().catch(() => null)) as
        Catalog | { error?: string } | null;
      if (res.status === 401 || res.status === 403) {
        readAccessError.current =
          res.status === 401
            ? "Tu sesión venció. Vuelve a iniciar sesión para continuar."
            : "Ya no tienes permiso para acceder al catálogo.";
        pendingRefresh.current = null;
        setCatalog(null);
        setNotice(null);
        stop?.();
        throw new Error(readAccessError.current);
      }
      if (!res.ok || !payload || !("products" in payload)) {
        throw new Error(
          (payload as { error?: string } | null)?.error ??
            "No pudimos cargar el catálogo.",
        );
      }
      uncertainRef.current = false;
      setUncertainWrite(false);
      setCatalog(payload);
      setRefreshFailed(false);
      setError(null);
      const completed = pendingRefresh.current;
      pendingRefresh.current = null;
      completed?.();
      return payload;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Error de carga.");
      return false;
    }
  }, [stop]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const mutate = useCallback(
    async (
      input: RequestInfo,
      init: RequestInit,
      okMessage: string,
      fallback: string,
      onRefreshed?: () => void,
      productWrite = false,
    ): Promise<boolean> => {
      if (writingRef.current || uncertainRef.current) return false;
      writingRef.current = true;
      setWriting(true);
      setNotice(null);
      setError(null);
      const notify = ticket?.();
      try {
        const res = await fetch(input, init);
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
          code?: string;
          product?: Product;
        } | null;
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            setCatalog(null);
            setNotice(null);
            stop?.();
          }
          if (payload?.code === "catalog_import_in_progress") await reload();
          if (productWrite)
            throw new CatalogWriteError(
              res.status >= 500
                ? "uncertain"
                : (payload?.code ??
                    (res.status === 404 ? "missing" : "rejected")),
              payload?.error ?? fallback,
              payload?.product,
            );
          throw new Error(payload?.error ?? fallback);
        }
        pendingRefresh.current = onRefreshed ?? null;
        if (!(await reload())) {
          setRefreshFailed(true);
          notify?.({ type: "refresh" });
          setError(
            readAccessError.current ??
              "Se guardó, pero no pudimos actualizar la lista. Reintenta la lectura del catálogo.",
          );
          return true;
        }
        setNotice(okMessage);
        return true;
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : fallback);
        if (productWrite) {
          const failure =
            reason instanceof CatalogWriteError
              ? reason
              : new CatalogWriteError(
                  "uncertain",
                  "No sabemos si se guardó. Revisa el catálogo antes de continuar.",
                );
          if (failure.code === "uncertain") {
            uncertainRef.current = true;
            setUncertainWrite(true);
          }
          throw failure;
        }
        return false;
      } finally {
        writingRef.current = false;
        setWriting(false);
      }
    },
    [reload, stop, ticket],
  );

  const createCategory = useCallback(
    async (
      name: string,
      onRefreshed?: (id: string) => void,
    ): Promise<Category | null> => {
      if (!name || uncertainRef.current || writingRef.current) return null;
      setWriting(true);
      setError(null);
      const notify = ticket?.();
      try {
        const res = await fetch(
          "/api/catalog/category",
          jsonInit("POST", { name }),
        );
        const cat = (await res.json().catch(() => null)) as
          Category | { error?: string; code?: string } | null;
        if (!res.ok || !cat || !("id" in cat)) {
          if (res.status === 401 || res.status === 403) {
            setCatalog(null);
            setNotice(null);
            stop?.();
          }
          if (cat && "code" in cat && cat.code === "catalog_import_in_progress")
            await reload();
          throw new Error(
            (cat as { error?: string } | null)?.error ??
              "No pudimos crear la categoría.",
          );
        }
        pendingRefresh.current = onRefreshed ? () => onRefreshed(cat.id) : null;
        if (!(await reload())) {
          setRefreshFailed(true);
          notify?.({ type: "refresh", task: "create-category" });
          setError(
            readAccessError.current ??
              "Se guardó, pero no pudimos actualizar la lista. Reintenta la lectura del catálogo.",
          );
          return cat;
        }
        setNotice("Categoría creada.");
        return cat;
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Error.");
        return null;
      } finally {
        setWriting(false);
      }
    },
    [reload, stop, ticket],
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
    refreshFailed,
    writing: writing || uncertainWrite,
    uncertainWrite,
  };
}
