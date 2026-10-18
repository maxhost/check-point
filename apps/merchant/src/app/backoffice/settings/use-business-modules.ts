"use client";
import { useBackofficeContext } from "../backoffice-context";

/** Presentation only: the provider owns the initial leaf, reads and invalidations. */
export function useBusinessModules() {
  const { state, revalidateModules } = useBackofficeContext();
  const result = state.core ? state.modules : { state: "restricted" as const };
  return {
    modules: result.state === "ready" ? result.modules : [],
    state: result.state,
    loading: result.state === "loading",
    error:
      result.state === "unavailable"
        ? "No pudimos leer los módulos. Intenta otra vez."
        : result.state === "restricted"
          ? "Configuración no disponible"
          : null,
    reload: revalidateModules,
  };
}
