"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, SelectField } from "../../../ui";
import {
  asMarketingError,
  errorText,
  marketingRequest,
  type MarketingApiError,
} from "./marketing-api";
import {
  MarketingError,
  MarketingLoading,
  MarketingPanel,
  MarketingShell,
  MarketingToast,
} from "./marketing-ui";
import type { MarketingSettings } from "./marketing-types";

const hours = Array.from({ length: 25 }, (_, hour) => ({
  id: hour,
  label: `${String(hour).padStart(2, "0")}:00`,
}));

export function MarketingSettingsPage({ isOwner }: { isOwner: boolean }) {
  const [settings, setSettings] = useState<MarketingSettings | null>(null);
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(21);
  const [error, setError] = useState<MarketingApiError | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const writing = useRef(false);
  const accessBlocked = error?.status === 401 || error?.status === 403;
  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await marketingRequest<{ settings: MarketingSettings }>(
        "/api/marketing/settings",
      );
      setSettings(response.settings);
      setStartHour(response.settings.pushWindow.startHour);
      setEndHour(response.settings.pushWindow.endHour);
    } catch (reason) {
      setError(asMarketingError(reason));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function save() {
    if (writing.current || accessBlocked || error?.uncertain) return;
    if (startHour >= endHour) {
      setFieldError("El inicio debe ser anterior al fin.");
      return;
    }
    writing.current = true;
    setBusy(true);
    setError(null);
    setFieldError(null);
    try {
      const response = await marketingRequest<{ settings: MarketingSettings }>(
        "/api/marketing/settings",
        "PATCH",
        { pushWindow: { startHour, endHour } },
      );
      setSettings(response.settings);
      setNotice("Horario de push actualizado.");
    } catch (reason) {
      const failure = asMarketingError(reason);
      setError(failure);
      setFieldError(failure.fields.pushWindow ?? null);
    } finally {
      writing.current = false;
      setBusy(false);
    }
  }
  if (!settings && !error)
    return <MarketingLoading label="Cargando horario de push…" />;
  return (
    <MarketingShell
      title="Horario de push"
      description="Tus campañas envían avisos solo dentro del horario elegido."
      closeHref="/backoffice/marketing"
    >
      <MarketingToast message={notice} dismiss={() => setNotice(null)} />
      {error && (!settings || accessBlocked) && (
        <MarketingError
          error={error}
          isOwner={isOwner}
          retry={() => void load()}
        />
      )}
      {error && settings && !accessBlocked && (
        <Alert kind="error" title={errorText(error)} className="mt-5" />
      )}
      {settings && (
        <MarketingPanel
          title="Ventana de envío"
          description={`Se aplica en la zona horaria del negocio: ${settings.timeZone}. El fin no está incluido.`}
        >
          <div className="grid max-w-xl gap-5 sm:grid-cols-2">
            <SelectField
              label="Desde"
              options={hours.slice(0, 24)}
              selectedKey={startHour}
              onSelectionChange={(key) => {
                setStartHour(Number(key));
                setFieldError(null);
              }}
              errorMessage={fieldError ?? undefined}
            />
            <SelectField
              label="Hasta"
              options={hours.slice(1)}
              selectedKey={endHour}
              onSelectionChange={(key) => {
                setEndHour(Number(key));
                setFieldError(null);
              }}
              errorMessage={fieldError ?? undefined}
            />
          </div>
          <Alert className="mt-5" title="¿Qué pasa fuera de horario?">
            Los avisos esperan al próximo inicio. Este horario solo afecta los
            push de campaña.
          </Alert>
          <div className="mt-6">
            <Button
              isLoading={busy}
              isDisabled={accessBlocked || Boolean(error?.uncertain)}
              onPress={() => void save()}
            >
              Guardar horario
            </Button>
          </div>
        </MarketingPanel>
      )}
    </MarketingShell>
  );
}
