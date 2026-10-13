"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Heading, Switch, Text } from "../../../ui";
import { PosError, posRequest } from "../pos/pos-types";
import {
  publishModules,
  type BusinessModule as Module,
} from "./module-navigation";

const cards = [
  {
    id: "stock",
    name: "Stock",
    description:
      "Registra tus insumos, compras y ajustes para consultar el stock estimado y el último costo de compra.",
  },
  {
    id: "recipes",
    name: "Recetas",
    description:
      "Define los insumos y cantidades de cada producto para calcular su costo y margen con los últimos costos de compra.",
  },
];

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
    void posRequest<{ modules: Module[] }>("/api/modules")
      .then((data) => {
        if (
          cards.some(
            (card) =>
              !data.modules?.some(
                (m) => m.id === card.id && typeof m.enabled === "boolean",
              ),
          )
        )
          throw new Error("No pudimos leer los módulos. Intenta otra vez.");
        if (active) {
          setModules(data.modules);
          publishModules(data.modules);
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
      const result = await posRequest<{ module: Module }>(
        `/api/modules/${module.id}`,
        "PUT",
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
        cause instanceof PosError &&
        (cause.code === "module_requires" ||
          cause.code === "module_required_by")
      ) {
        setModules(null);
        setLoading(true);
        setAttempt((value) => value + 1);
        setError(
          cause.code === "module_requires"
            ? "Activa Stock para usar Recetas."
            : "Desactiva Recetas antes de desactivar Stock.",
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

  const stock = modules?.find((module) => module.id === "stock");
  const recipes = modules?.find((module) => module.id === "recipes");

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
      {cards.map((card) => {
        const module = modules?.find((item) => item.id === card.id);
        const dependency =
          card.id === "recipes" && !module?.enabled && stock && !stock.enabled
            ? "Activa Stock para usar Recetas."
            : card.id === "stock" && module?.enabled && recipes?.enabled
              ? "Desactiva Recetas antes de desactivar Stock."
              : null;
        return (
          <div
            key={card.id}
            className="flex flex-col gap-3 border-t border-border pt-5 md:flex-row md:items-start md:gap-6"
          >
            <div className="min-w-0 flex-1 space-y-2">
              <Heading level={2}>{card.name}</Heading>
              <Text>{card.description}</Text>
              {dependency && <Text>{dependency}</Text>}
            </div>
            <div className="flex shrink-0 items-center justify-end gap-3">
              <Text variant="label">
                {loading
                  ? "Cargando configuración…"
                  : !module
                    ? "Estado no disponible"
                    : busy === card.id
                      ? "Guardando…"
                      : module.enabled
                        ? "Activado"
                        : "Desactivado"}
              </Text>
              <Switch
                aria-label={card.name}
                aria-busy={busy === card.id || undefined}
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
