/** Contrato 0210: estado público de los módulos del negocio de la sesión. */
export type BusinessModule = {
  id: string;
  name: string;
  description: string;
  requires: string[];
  enabled: boolean;
  suggested: boolean;
};

export const MODULES_CHANGED_EVENT = "business-modules-changed";

/** Solo se publica tras leer o guardar un estado confirmado por la API. */
export function publishModules(modules: BusinessModule[]) {
  window.dispatchEvent(
    new CustomEvent(MODULES_CHANGED_EVENT, { detail: modules }),
  );
}

export function moduleLinkVisible(segment: string, modules: BusinessModule[]) {
  if (segment !== "stock" && segment !== "recipes") return true;
  return modules.some(
    (module) => module.id === segment && module.enabled === true,
  );
}
