"use client";

import { useEffect, useRef, useState } from "react";
import { useBackofficeContext } from "../backoffice-context";
import { useBusinessModules } from "./use-business-modules";
import { captureModuleToggleIntent } from "./module-toggle-intent";
import {
  Alert,
  Button,
  Card,
  Dialog,
  Heading,
  Switch,
  Text,
} from "../../../ui";
import {
  ModuleRequestError,
  moduleDependency,
  moduleNames,
} from "./module-request";
import type { BusinessModule as Module } from "./module-navigation";

import type { SettingsPanel } from "./module-configuration";

export function ModuleSettings({ panels = [] }: { panels?: SettingsPanel[] }) {
  const context = useBackofficeContext();
  const moduleState = useBusinessModules();
  const modules = moduleState.state === "ready" ? moduleState.modules : null;
  const { loading } = moduleState;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<{
    title: string;
    description: string;
  } | null>(null);
  const lock = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  function reload() {
    setError(null);
    moduleState.reload();
  }

  async function toggle(module: Module) {
    if (lock.current) return;
    lock.current = true;
    setBusy(module.id);
    setError(null);
    const moduleName = module.name;
    try {
      const intent = captureModuleToggleIntent(module, context);
      if (!intent || !(await intent.execute()) || !mounted.current) return;
    } catch (cause) {
      if (!mounted.current) return;
      if (
        cause instanceof ModuleRequestError &&
        (cause.code === "module_requires" ||
          cause.code === "module_required_by")
      ) {
        moduleState.reload();
        setError(
          cause.code === "module_requires"
            ? `Activa ${moduleNames(cause.missing, modules ?? []) || "los módulos requeridos"} para usar ${moduleName}.`
            : `Desactiva ${moduleNames(cause.dependents, modules ?? []) || "los módulos dependientes"} antes de desactivar ${moduleName}.`,
        );
      } else if (
        cause instanceof ModuleRequestError &&
        cause.status === 409 &&
        typeof cause.openCount === "number"
      ) {
        setBlocked({
          title: cause.message.split(" con órdenes")[0],
          description: `Hay ${cause.openCount} órdenes abiertas. Cierra o anula esas órdenes antes de desactivar el módulo.`,
        });
      } else
        setError(
          cause instanceof Error
            ? cause.message
            : "No pudimos cambiar el módulo. Intenta otra vez.",
        );
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(null);
    }
  }

  const displayError = error ?? moduleState.error;
  return (
    <>
      {displayError && (
        <Alert kind="error" title={displayError}>
          {!loading && !modules && moduleState.state !== "restricted" && (
            <Button variant="secondary" onPress={reload}>
              Reintentar módulos
            </Button>
          )}
        </Alert>
      )}
      {loading && <Text>Cargando configuración…</Text>}
      <Card className="grid gap-5">
        {modules?.map((module) => {
          const dependency = moduleDependency(module, modules);
          return (
            <div
              key={module.id}
              className="flex flex-col gap-3 border-t border-border pt-5 md:flex-row md:items-start md:gap-6"
            >
              <div className="min-w-0 flex-1 space-y-2">
                <Heading level={2}>{module.name}</Heading>
                <Text>{module.description}</Text>
                {module.suggested && (
                  <Text variant="label">Sugerido para tu negocio</Text>
                )}
                {dependency && <Text>{dependency}</Text>}
              </div>
              <div className="flex shrink-0 items-center justify-end gap-3">
                <Text variant="label">
                  {loading
                    ? "Cargando configuración…"
                    : !module
                      ? "Estado no disponible"
                      : busy === module.id
                        ? "Guardando…"
                        : module.enabled
                          ? "Activado"
                          : "Desactivado"}
                </Text>
                <Switch
                  aria-label={module.name}
                  aria-busy={busy === module.id || undefined}
                  isSelected={module?.enabled ?? false}
                  isDisabled={
                    loading || !module || busy !== null || !!dependency
                  }
                  onChange={() => {
                    if (module) void toggle(module);
                  }}
                />
              </div>
            </div>
          );
        })}
      </Card>
      {modules
        ?.filter((module) => module.enabled)
        .map((module) => {
          const panel = panels.find((entry) => entry.moduleId === module.id);
          return panel ? <div key={module.id}>{panel.content}</div> : null;
        })}
      <Dialog
        isOpen={blocked !== null}
        onOpenChange={(open) => {
          if (!open) setBlocked(null);
        }}
        title={blocked?.title ?? "No puedes desactivar el módulo"}
        description={blocked?.description}
        role="alertdialog"
      >
        <Button onPress={() => setBlocked(null)}>Entendido</Button>
      </Dialog>
    </>
  );
}
