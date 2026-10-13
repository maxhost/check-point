import type { BusinessModule } from "./module-navigation";

export class ModuleRequestError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly missing: string[] = [],
    readonly dependents: string[] = [],
  ) {
    super(message);
  }
}

export async function moduleRequest<T>(
  url: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method: body === undefined ? "GET" : "PUT",
    cache: "no-store",
    ...(body === undefined
      ? {}
      : {
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok)
    throw new ModuleRequestError(
      payload?.error ?? "No pudimos completar la acción. Intenta otra vez.",
      payload?.code,
      Array.isArray(payload?.missing) ? payload.missing : [],
      Array.isArray(payload?.dependents) ? payload.dependents : [],
    );
  if (!payload)
    throw new Error("No pudimos leer la respuesta. Intenta otra vez.");
  return payload as T;
}

export async function readModules(): Promise<BusinessModule[]> {
  const data = await moduleRequest<{ modules: BusinessModule[] }>(
    "/api/modules",
  );
  if (
    !Array.isArray(data.modules) ||
    data.modules.some(
      (module) =>
        typeof module.id !== "string" ||
        typeof module.name !== "string" ||
        typeof module.description !== "string" ||
        typeof module.enabled !== "boolean" ||
        !Array.isArray(module.requires) ||
        !Array.isArray(module.navigation) ||
        !Array.isArray(module.permissions),
    )
  )
    throw new Error("No pudimos leer los módulos. Intenta otra vez.");
  return data.modules;
}

export function moduleNames(
  ids: readonly string[],
  modules: readonly BusinessModule[],
) {
  return ids
    .map((id) => modules.find((module) => module.id === id)?.name ?? id)
    .join(", ");
}

export function moduleDependency(
  module: BusinessModule,
  modules: readonly BusinessModule[],
) {
  if (!module.enabled) {
    const missing = module.requires.filter(
      (id) => !modules.some((item) => item.id === id && item.enabled),
    );
    return missing.length
      ? `Activa ${moduleNames(missing, modules)} para usar ${module.name}.`
      : null;
  }
  const dependents = modules
    .filter((item) => item.enabled && item.requires.includes(module.id))
    .map((item) => item.id);
  return dependents.length
    ? `Desactiva ${moduleNames(dependents, modules)} antes de desactivar ${module.name}.`
    : null;
}
