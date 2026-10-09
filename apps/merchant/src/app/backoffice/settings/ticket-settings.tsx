"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Button, Card, Heading, Switch, Text } from "../../../ui";
import type { TicketSettings as Settings } from "../../../printing/index";
import { ConfirmationToast } from "../../components/confirmation-toast";
import { posRequest } from "../pos/pos-types";

function validate(settings: Settings) {
  if (
    typeof settings?.showBusinessName !== "boolean" ||
    typeof settings?.showTable !== "boolean"
  )
    throw new Error("No pudimos leer las opciones del ticket.");
  return settings;
}

export function TicketSettings() {
  const [expanded, setExpanded] = useState(false);
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
    void posRequest<Settings>("/api/merchant/business/ticket")
      .then(validate)
      .then((data) => {
        if (active) setSettings(data);
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "No pudimos cargar las opciones del ticket.",
          );
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  async function save(key: keyof Settings, value: boolean) {
    if (!settings || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const saved = validate(
        await posRequest<Settings>("/api/merchant/business/ticket", "PUT", {
          ...settings,
          [key]: value,
        }),
      );
      if (mounted.current) {
        setSettings(saved);
        setNotice("Opciones del ticket guardadas");
      }
    } catch (cause) {
      if (mounted.current)
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
      <Text>
        La impresión siempre está disponible. Abre las opciones para elegir qué
        muestra el ticket.
      </Text>
      <Switch isSelected={expanded} onChange={setExpanded} isDisabled={busy}>
        Imprimir tickets
      </Switch>
      {expanded && (
        <div className="grid gap-4 border-t border-border pt-4">
          {error && <Alert kind="error" title={error} />}
          {!settings ? (
            error ? (
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
            )
          ) : (
            <>
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
                Los cambios se guardan automáticamente. El ticket siempre
                incluye productos, total, fecha y hora.
              </Text>
              {busy && (
                <div role="status">
                  <Text>Guardando opciones…</Text>
                </div>
              )}
            </>
          )}
        </div>
      )}
      <ConfirmationToast message={notice} onDismiss={() => setNotice(null)} />
    </Card>
  );
}
