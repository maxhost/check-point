"use client";

import { useEffect, useRef, useState } from "react";
import { bluetoothApi, requestBlePrinter, writeBle } from "./printer-ble";
import { PrinterHelp } from "./printer-help";
import { logEvent } from "./printer-log";
import { PrinterSteps } from "./printer-steps";
import {
  explain,
  readCount,
  saveCount,
  ticket,
  type Result,
} from "./printer-ticket";

/** Tipos minimos de Web Serial: el `lib.dom` del repo no los trae. */
type SerialPortLike = {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readonly writable: WritableStream<Uint8Array> | null;
};
type SerialLike = {
  getPorts(): Promise<SerialPortLike[]>;
  requestPort(options?: {
    filters?: { bluetoothServiceClassId?: string }[];
    allowedBluetoothServiceClassIds?: string[];
  }): Promise<SerialPortLike>;
};

/** El perfil de puerto serie (SPP) de Bluetooth clasico, el que usan las termicas baratas. */
const SPP_UUID = "00001101-0000-1000-8000-00805f9b34fb";

function serialApi(): SerialLike | null {
  if (typeof navigator === "undefined") return null;
  return (navigator as Navigator & { serial?: SerialLike }).serial ?? null;
}

function chromeVersion(): string {
  if (typeof navigator === "undefined") return "-";
  const match = navigator.userAgent.match(/Chrome\/(\d+)/);
  return match ? match[1]! : "no es Chrome";
}

const button =
  "w-full rounded-xl px-4 py-5 text-xl font-bold shadow-sm disabled:opacity-50";

export function PrinterTest() {
  const [serialOk, setSerialOk] = useState<boolean | null>(null);
  const [bleOk, setBleOk] = useState<boolean | null>(null);
  const [remembered, setRemembered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [bleInfo, setBleInfo] = useState("-");
  const [count, setCount] = useState(0);
  const [version, setVersion] = useState("-");
  const port = useRef<SerialPortLike | null>(null);

  useEffect(() => {
    setVersion(chromeVersion());
    setCount(readCount());
    setBleOk(Boolean(bluetoothApi()));
    const serial = serialApi();
    setSerialOk(Boolean(serial));
    if (!serial) return;
    void serial.getPorts().then((ports) => {
      logEvent("carga", {
        detail: { recordadas: ports.length, ble: Boolean(bluetoothApi()) },
      });
      if (ports[0]) {
        port.current = ports[0];
        setRemembered(true);
      }
    });
  }, []);

  function nextTicketNumber() {
    const n = readCount() + 1;
    saveCount(n);
    setCount(n);
    return n;
  }

  async function printSerial() {
    const serial = serialApi();
    if (!serial || busy) return;
    setBusy(true);
    setResult(null);
    const wasRemembered = Boolean(port.current);
    logEvent("metodo1_toque", { detail: { recordada: wasRemembered } });
    try {
      // La lista de Chrome se pide ANTES de cualquier otra espera: si no, el toque ya no
      // cuenta como gesto del usuario y Chrome no la muestra.
      const target =
        port.current ??
        (await serial.requestPort({
          filters: [{ bluetoothServiceClassId: SPP_UUID }],
          allowedBluetoothServiceClassIds: [SPP_UUID],
        }));
      port.current = target;
      logEvent("metodo1_elegida");
      await target.open({ baudRate: 9600 });
      logEvent("metodo1_abierta");
      try {
        const writer = target.writable?.getWriter();
        if (!writer)
          throw new DOMException("Sin canal de escritura", "NetworkError");
        await writer.write(
          ticket(nextTicketNumber(), "clasico", wasRemembered),
        );
        writer.releaseLock();
      } finally {
        // Se cierra en cada impresion para no dejar la impresora tomada: el POS que ya
        // usa el comercio tiene que poder volver a conectarse.
        await target.close().catch(() => undefined);
      }
      setRemembered(true);
      logEvent("metodo1_ok", { detail: { recordada: wasRemembered } });
      setResult({
        ok: true,
        title: "Método 1: enviado a la impresora",
        detail: wasRemembered
          ? "Esta vez Chrome NO preguntó por la impresora: la recordó. Si salió el papel, la prueba está completa."
          : "Si salió el papel, ahora haz el paso 4 (cerrar Chrome y volver a abrir).",
      });
    } catch (error) {
      logEvent("metodo1_error", { error });
      setResult(explain(error, "clasico"));
    } finally {
      setBusy(false);
    }
  }

  async function printBle() {
    const bluetooth = bluetoothApi();
    if (!bluetooth || busy) return;
    setBusy(true);
    setResult(null);
    logEvent("metodo2_toque");
    let deviceName = "-";
    try {
      const device = await requestBlePrinter(bluetooth);
      deviceName = device.name ?? "sin nombre";
      logEvent("metodo2_elegido", { device: deviceName });
      setBleInfo(`elegido «${device.name ?? "sin nombre"}»`);
      const service = await writeBle(
        device,
        ticket(nextTicketNumber(), "ble", false),
        (found) =>
          logEvent("metodo2_servicios", { device: deviceName, detail: found }),
      );
      logEvent("metodo2_ok", { device: deviceName, service });
      setBleInfo(`OK · «${device.name ?? "sin nombre"}» · servicio ${service}`);
      setResult({
        ok: true,
        title: "Método 2: enviado a la impresora",
        detail:
          "Si salió el papel, tu impresora es de tipo BLE. Hazle una captura al recuadro gris y mándasela.",
      });
    } catch (error) {
      logEvent("metodo2_error", { device: deviceName, error });
      const failure = explain(error, "ble");
      setBleInfo((current) => `${current} · ERROR: ${failure.title}`);
      setResult(failure);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl space-y-6 bg-surface px-4 py-6 text-content">
      <PrinterSteps supported={serialOk !== false} />

      <button
        type="button"
        onClick={() => void printSerial()}
        disabled={busy || serialOk !== true}
        className={`${button} bg-primary text-on-primary`}
      >
        {busy ? "Imprimiendo…" : "Imprimir prueba"}
      </button>

      <section className="space-y-3 rounded-lg bg-warning-soft p-4">
        <h2 className="font-bold">
          ¿La lista salió vacía («No se encontraron dispositivos compatibles»)?
        </h2>
        <p>
          Toca «Cancelar». Abre <strong>Ajustes → Bluetooth</strong> y fíjate si
          la impresora está en «Dispositivos vinculados». Si no está, vincúlala
          ahí (la clave suele ser 0000 o 1234) y vuelve a tocar el botón verde.
        </p>
        <p>
          Si no se puede vincular, o la lista sigue vacía, toca el botón de
          abajo. Va a aparecer otra lista con los aparatos Bluetooth cercanos:
          busca tu impresora (puede salir con un nombre raro, como «Printer001»,
          «BlueTooth Printer», «MPT-II» o parecido al modelo).
        </p>
        <button
          type="button"
          onClick={() => void printBle()}
          disabled={busy || bleOk !== true}
          className={`${button} border border-border-strong bg-surface text-content`}
        >
          Probar método 2
        </button>
      </section>

      {result && (
        <section
          role="status"
          className={`space-y-1 rounded-lg p-4 ${result.ok ? "bg-success-soft" : "bg-danger-soft"}`}
        >
          <h2 className="font-bold">{result.title}</h2>
          <p>{result.detail}</p>
        </section>
      )}

      <section className="space-y-1 rounded-lg bg-surface-subtle p-4 font-mono text-sm">
        <p>Chrome: {version}</p>
        <p>
          Método 1 disponible:{" "}
          {serialOk === null ? "revisando…" : serialOk ? "SI" : "NO"}
        </p>
        <p>
          Método 2 disponible:{" "}
          {bleOk === null ? "revisando…" : bleOk ? "SI" : "NO"}
        </p>
        <p>Impresora recordada: {remembered ? "SI" : "NO"}</p>
        <p>Impresiones de prueba: {count}</p>
        <p>Método 2: {bleInfo}</p>
        <p>
          Último resultado:{" "}
          {result ? `${result.ok ? "OK" : "ERROR"} · ${result.title}` : "-"}
        </p>
      </section>

      <PrinterHelp />
    </main>
  );
}
