"use client";
import { useEffect, useState, type ReactNode } from "react";
import { Alert, PageHeader, Text } from "../../../ui";
import { panelRequest, type PanelSession } from "../panel-request";
import { ModuleSettings } from "./module-settings";

export type SettingsPanel = { moduleId: string; content: ReactNode };
export function ModuleConfiguration({
  panels = [],
}: {
  panels?: SettingsPanel[];
}) {
  const [session, setSession] = useState<PanelSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void panelRequest<PanelSession>("/api/merchant/session")
      .then((data) => {
        if (active) setSession(data);
      })
      .catch((cause) => {
        if (active) setError(cause.message);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <main className="merchant-shell">
      <div className="backoffice-home grid gap-6">
        <PageHeader
          title="Configuración"
          description="Elige los módulos que usa tu negocio."
        />
        {error && <Alert kind="error" title={error} />}
        {!session ? (
          <Text>Cargando configuración…</Text>
        ) : session.membership?.role !== "owner" ? (
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
