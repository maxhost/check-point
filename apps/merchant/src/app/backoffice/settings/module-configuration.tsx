"use client";
import type { ReactNode } from "react";
import { Alert, PageHeader, Text } from "../../../ui";
import { useBackofficeContext } from "../backoffice-context";
import { ModuleSettings } from "./module-settings";

export type SettingsPanel = { moduleId: string; content: ReactNode };
export function ModuleConfiguration({
  panels = [],
}: {
  panels?: SettingsPanel[];
}) {
  const {
    state: { core },
  } = useBackofficeContext();
  return (
    <main className="merchant-shell">
      <div className="backoffice-home grid gap-6">
        <PageHeader
          title="Configuración"
          description="Elige los módulos que usa tu negocio."
        />
        {!core ? (
          <Text>Cargando configuración…</Text>
        ) : core.membership.role !== "owner" ? (
          <Alert title="Configuración no disponible">
            Solo la persona propietaria puede cambiar los módulos.
          </Alert>
        ) : (
          <ModuleSettings panels={panels} />
        )}
      </div>
    </main>
  );
}
