/** Contrato 0210: estado público de los módulos del negocio de la sesión. */
import type { ModuleDTO } from "../../../modules/activation";

export type BusinessModule = ModuleDTO;

export const MODULES_CHANGED_EVENT = "business-modules-changed";

/** Raw signals request invalidation only; event payloads never establish module state. */
export function publishModules() {
  window.dispatchEvent(new Event(MODULES_CHANGED_EVENT));
}

/** Solo se usa con entradas aportadas por módulos. */
export function moduleLinkVisible(moduleId: string, modules: BusinessModule[]) {
  return modules.some((module) => module.id === moduleId && module.enabled);
}
