import type { ModuleDTO } from "../../../backoffice-context-contract";
import type {
  BackofficeResource,
  BackofficeResourceTicket,
} from "../backoffice-context-state";
import { isBackofficeContextChanged } from "../backoffice-scope-request";
import { moduleRequest } from "./module-request";

type ModuleToggleContext = {
  captureTicket: (
    resource: BackofficeResource,
  ) => BackofficeResourceTicket | null;
  invalidate: (resources: readonly BackofficeResource[]) => void;
  applyConfirmedModule: (
    ticket: BackofficeResourceTicket,
    module: ModuleDTO,
  ) => boolean;
  revalidateModules: () => void;
  retire: () => void;
};
/** One explicit click. No store or read transport: the provider owns confirmation/recovery. */
export function captureModuleToggleIntent(
  module: Pick<ModuleDTO, "id" | "enabled">,
  context: ModuleToggleContext,
) {
  const before = context.captureTicket("modules");
  if (!before) return null;
  const { scopeKey, epoch } = before,
    moduleId = module.id,
    enabled = !module.enabled;
  context.invalidate(["modules", "inbox", "checklist"]);
  const next = context.captureTicket("modules");
  if (!next || next.scopeKey !== scopeKey || next.epoch !== epoch) return null;
  const ticket = { ...next };
  let used = false;
  const sameIdentity = () => {
    const current = context.captureTicket("modules");
    return current?.scopeKey === scopeKey && current.epoch === epoch;
  };
  const currentGeneration = () =>
    context.captureTicket("modules")?.generation === ticket.generation;
  return {
    async execute(): Promise<boolean> {
      if (used || !sameIdentity()) return false;
      used = true;
      if (!currentGeneration()) {
        context.revalidateModules();
        return false;
      }
      let result: { module: ModuleDTO };
      try {
        result = await moduleRequest<{ module: ModuleDTO }>(
          `/api/modules/${encodeURIComponent(moduleId)}`,
          { enabled },
          { scopeKey },
        );
      } catch (error) {
        if (!sameIdentity()) return false;
        if (isBackofficeContextChanged(error)) {
          context.retire();
          return false;
        }
        if (!currentGeneration()) {
          context.revalidateModules();
          return false;
        }
        throw error;
      }
      if (!sameIdentity()) return false;
      if (!currentGeneration()) {
        context.revalidateModules();
        return false;
      }
      if (
        result?.module?.id !== moduleId ||
        result.module.enabled !== enabled ||
        !context.applyConfirmedModule(ticket, result.module)
      ) {
        context.revalidateModules();
        throw new Error("No pudimos confirmar el cambio. Intenta otra vez.");
      }
      return true;
    },
  };
}
