/** Contrato 0210: estado público de los módulos del negocio de la sesión. */
import type { ModuleDTO } from "../../../modules/activation";

export type BusinessModule = ModuleDTO;

export const MODULES_CHANGED_EVENT = "business-modules-changed";

/** Solo se publica tras leer o guardar un estado confirmado por la API. */
export function publishModules(modules: BusinessModule[]) {
  window.dispatchEvent(
    new CustomEvent(MODULES_CHANGED_EVENT, { detail: modules }),
  );
}

/** Solo se usa con entradas aportadas por módulos. */
export function moduleLinkVisible(moduleId: string, modules: BusinessModule[]) {
  return modules.some((module) => module.id === moduleId && module.enabled);
}
