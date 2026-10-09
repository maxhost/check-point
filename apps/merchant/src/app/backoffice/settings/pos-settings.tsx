"use client";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Dialog,
  Heading,
  PageHeader,
  Text,
} from "../../../ui";
import { useRouter } from "next/navigation";
import { PosError, posRequest, type PosSession } from "../pos/pos-types";
import { TicketSettings } from "./ticket-settings";
export function PosSettings() {
  const router = useRouter();
  const [session, setSession] = useState<PosSession | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openCount, setOpenCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    void posRequest<PosSession>("/api/merchant/session")
      .then((data) => {
        if (active) {
          setSession(data);
          setEnabled(data.business?.posEnabled === true);
        }
      })
      .catch((cause) => {
        if (active) setError(cause.message);
      });
    return () => {
      active = false;
    };
  }, []);
  async function toggle() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await posRequest<{ enabled: boolean }>(
        "/api/merchant/business/pos",
        "PUT",
        { enabled: !enabled },
      );
      setEnabled(result.enabled);
      window.dispatchEvent(new CustomEvent("pos-module-changed"));
      router.refresh();
    } catch (cause) {
      if (cause instanceof PosError && cause.code === "pos_has_open_orders")
        setOpenCount(cause.openCount ?? 0);
      else
        setError(
          cause instanceof Error
            ? cause.message
            : "No pudimos cambiar el módulo.",
        );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
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
          <Card className="grid gap-4">
            <Heading level={2}>POS · Órdenes de mesa</Heading>
            <Text>
              Abre una orden por mesa, agrega productos y cobra cuando el
              cliente pague. Puedes escanear su pase para aplicar el cupón y
              acreditar la compra.
            </Text>
            <Text variant="label">{enabled ? "Activado" : "Desactivado"}</Text>
            <div>
              <Button
                variant={enabled ? "secondary" : "primary"}
                isLoading={busy}
                onPress={() => void toggle()}
              >
                {enabled ? "Desactivar POS" : "Activar POS"}
              </Button>
            </div>
          </Card>
        )}
        {session?.membership?.role === "owner" && <TicketSettings />}
        <Dialog
          isOpen={openCount !== null}
          onOpenChange={(open) => {
            if (!open) setOpenCount(null);
          }}
          title="No puedes desactivar el POS"
          description={`Hay ${openCount ?? 0} órdenes abiertas. Cierra o anula esas órdenes antes de desactivar el módulo.`}
          role="alertdialog"
        >
          <Button onPress={() => setOpenCount(null)}>Entendido</Button>
        </Dialog>
      </div>
    </main>
  );
}
