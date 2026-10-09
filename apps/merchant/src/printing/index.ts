/**
 * Spec 0184 / ADR 0133 — LA API PUBLICA DE IMPRESION. Lo UNICO que importan las pantallas.
 * Mapa, contrato y recetas para extender: `README.md` de esta carpeta.
 *
 * Gesto del usuario: `choosePrinter` y `printTicket` se llaman DIRECTO desde el `onPress`, con el
 * `TicketDoc` ya armado (el ajuste del comercio se carga antes, al abrir el POS). Ninguna de las
 * dos lanza: devuelven `PrintResult` con un `message` en español listo para mostrar.
 */
import { encodeTicket } from "./escpos/encode";
import {
  type DevicePrinter,
  getDevicePaper,
  getDevicePrinter,
  saveDevicePrinter,
  setDevicePaper,
} from "./device";
import { bluetoothApi, chooseBle, forgetBle, printBle } from "./transport/ble";
import { chooseSerial, printSerial, serialApi } from "./transport/serial";
import {
  PrintError,
  type PrintResult,
  type TransportKind,
  printErrorFrom,
} from "./transport/types";
import type { TicketDoc } from "./ticket/types";

export { buildTicket } from "./ticket/build";
export type {
  TicketDoc,
  TicketLine,
  TicketOrder,
  TicketSettings,
} from "./ticket/types";
export type { Paper } from "./escpos/layout";
export type { PrintFailure, PrintResult, TransportKind } from "./transport/types";
export type { DevicePrinter } from "./device";
export { getDevicePaper, getDevicePrinter, setDevicePaper };

const UNSUPPORTED: PrintResult = {
  ok: false,
  reason: "unsupported",
  message: "Este navegador no puede imprimir por Bluetooth.",
};

/** Que transportes tiene este navegador. Ninguno → imprimir con `window.print()`. */
export function printerSupport(): { ble: boolean; serial: boolean } {
  return { ble: bluetoothApi() !== null, serial: serialApi() !== null };
}

/** Abre la lista de Chrome del transporte y guarda la impresora elegida en este dispositivo. */
export async function choosePrinter(
  transport: TransportKind,
): Promise<PrintResult> {
  try {
    let name: string;
    if (transport === "ble") {
      const bluetooth = bluetoothApi();
      if (!bluetooth) return UNSUPPORTED;
      name = await chooseBle(bluetooth);
    } else {
      const serial = serialApi();
      if (!serial) return UNSUPPORTED;
      name = await chooseSerial(serial);
    }
    saveDevicePrinter({ transport, name } satisfies DevicePrinter);
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/** Olvida la impresora de este dispositivo (la proxima vez se elige de la lista completa). */
export function forgetDevicePrinter(): void {
  forgetBle();
  saveDevicePrinter(null);
}

/** Imprime el ticket en la impresora de este dispositivo, con su papel. */
export async function printTicket(doc: TicketDoc): Promise<PrintResult> {
  try {
    const printer = getDevicePrinter();
    if (!printer) {
      const { ble, serial } = printerSupport();
      if (!ble && !serial) return UNSUPPORTED;
      throw new PrintError("no_printer", "Elige la impresora antes de imprimir.");
    }
    // Sincronico: nada se espera antes de la lista de Chrome (gesto del usuario).
    const bytes = encodeTicket(doc, getDevicePaper());
    if (printer.transport === "ble") {
      const bluetooth = bluetoothApi();
      if (!bluetooth) return UNSUPPORTED;
      await printBle(bluetooth, printer.name, bytes);
    } else {
      const serial = serialApi();
      if (!serial) return UNSUPPORTED;
      await printSerial(serial, bytes);
    }
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

function failure(error: unknown): PrintResult {
  const { reason, message } = printErrorFrom(error);
  return { ok: false, reason, message };
}
