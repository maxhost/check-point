"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Heading, Switch, Text } from "../../../ui";
import {
  ModuleRequestError,
  moduleRequest,
  readModules,
  moduleDependency,
  moduleNames,
} from "./module-request";
import {
  publishModules,
  type BusinessModule as Module,
} from "./module-navigation";

export function ModuleSettings() {
  const router = useRouter();
  const [modules, setModules] = useState<Module[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const lock = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void readModules()
      .then((data) => {
        if (active) {
          setModules(data);
          publishModules(data);
        }
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "No pudimos leer los módulos. Intenta otra vez.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  function reload() {
    setError(null);
    setModules(null);
    setLoading(true);
    setAttempt((value) => value + 1);
  }

  async function toggle(module: Module) {
    if (lock.current) return;
    lock.current = true;
    setBusy(module.id);
    setError(null);
    try {
      const result = await moduleRequest<{ module: Module }>(
        `/api/modules/${encodeURIComponent(module.id)}`,
        { enabled: !module.enabled },
      );
      if (
        result.module?.id !== module.id ||
        typeof result.module.enabled !== "boolean"
      )
        throw new Error("No pudimos confirmar el cambio. Intenta otra vez.");
      if (!mounted.current) return;
      const next =
        modules?.map((item) =>
          item.id === module.id ? result.module : item,
        ) ?? null;
      setModules(next);
      if (next) publishModules(next);
      router.refresh();
    } catch (cause) {
      if (!mounted.current) return;
      if (
        cause instanceof ModuleRequestError &&
        (cause.code === "module_requires" ||
          cause.code === "module_required_by")
      ) {
        setModules(null);
        setLoading(true);
        setAttempt((value) => value + 1);
        setError(
          cause.code === "module_requires"
            ? `Activa ${moduleNames(cause.missing, modules ?? []) || "los módulos requeridos"} para usar ${module.name}.`
            : `Desactiva ${moduleNames(cause.dependents, modules ?? []) || "los módulos dependientes"} antes de desactivar ${module.name}.`,
        );
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

  return (
    <>
      {error && (
        <Alert kind="error" title={error}>
          {!loading && !modules && (
            <Button variant="secondary" onPress={reload}>
              Reintentar módulos
            </Button>
          )}
        </Alert>
      )}
      {loading && <Text>Cargando configuración…</Text>}
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
                isDisabled={loading || !module || busy !== null || !!dependency}
                onChange={() => {
                  if (module) void toggle(module);
                }}
              />
            </div>
          </div>
        );
      })}
    </>
  );
}
