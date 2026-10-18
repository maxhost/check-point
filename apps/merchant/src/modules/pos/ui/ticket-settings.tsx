"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Button, Card, Heading, Switch, Text } from "../../../ui";
import type { TicketSettings as Settings } from "./ticket-settings-types";
import { ConfirmationToast } from "../../../app/components/confirmation-toast";
import { DiscardedPosIntent, usePosContext } from "./pos-context";

function validate(settings: Settings) {
  if (
    typeof settings?.printingEnabled !== "boolean" ||
    typeof settings?.showBusinessName !== "boolean" ||
    typeof settings?.showTable !== "boolean"
  )
    throw new Error("No pudimos leer las opciones del ticket.");
  return settings;
}

export function TicketSettings() {
  const scope = usePosContext();
  const posRequest = scope.client.request;
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const mounted = useRef(false);
  const lock = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    setError(null);
    setSettings(null);
    setNotice(null);
    if (scope.present && (!scope.identity || scope.loading)) return;
    void posRequest<Settings>("/api/modules/pos/ticket-settings")
      .then(validate)
      .then((data) => {
        if (active) setSettings(data);
      })
      .catch((cause: unknown) => {
        if (active && !(cause instanceof DiscardedPosIntent))
          setError(
            cause instanceof Error
              ? cause.message
              : "No pudimos cargar las opciones del ticket.",
          );
      });
    return () => {
      active = false;
    };
  }, [attempt, scope.identity, scope.loading, scope.present, posRequest]);

  async function save(key: keyof Settings, value: boolean) {
    if (!settings || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const saved = validate(
        await posRequest<Settings>("/api/modules/pos/ticket-settings", "PUT", {
          printingEnabled: settings.printingEnabled,
          showBusinessName: settings.showBusinessName,
          showTable: settings.showTable,
          [key]: value,
        }),
      );
      if (mounted.current) {
        setSettings(saved);
        setNotice("Opciones del ticket guardadas");
      }
    } catch (cause) {
      if (mounted.current && !(cause instanceof DiscardedPosIntent))
        setError(
          cause instanceof Error
            ? cause.message
            : "No pudimos guardar las opciones del ticket.",
        );
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <Card className="grid gap-4">
      <Heading level={2}>Imprimir tickets</Heading>
      <Text>Activa la impresión para mostrar el botón Imprimir en el POS.</Text>
      <Switch
        isSelected={settings?.printingEnabled ?? false}
        onChange={(value) => void save("printingEnabled", value)}
        isDisabled={busy || !settings}
      >
        Imprimir tickets
      </Switch>
      {error && <Alert kind="error" title={error} />}
      {!settings &&
        (error ? (
          <div>
            <Button
              variant="secondary"
              onPress={() => setAttempt((current) => current + 1)}
            >
              Reintentar opciones del ticket
            </Button>
          </div>
        ) : (
          <Text>Cargando opciones del ticket…</Text>
        ))}
      {settings?.printingEnabled && (
        <div className="grid gap-4 border-t border-border pt-4">
          <Switch
            isSelected={settings.showBusinessName}
            isDisabled={busy}
            onChange={(value) => void save("showBusinessName", value)}
          >
            Mostrar nombre del comercio
          </Switch>
          <Switch
            isSelected={settings.showTable}
            isDisabled={busy}
            onChange={(value) => void save("showTable", value)}
          >
            Mostrar mesa
          </Switch>
          <Text variant="small">
            Los cambios se guardan automáticamente. El ticket siempre incluye
            productos, total, fecha y hora.
          </Text>
        </div>
      )}
      {busy && (
        <div role="status">
          <Text>Guardando opciones…</Text>
        </div>
      )}
      <ConfirmationToast message={notice} onDismiss={() => setNotice(null)} />
    </Card>
  );
}
