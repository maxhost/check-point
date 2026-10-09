/**
 * Spec 0184 — POR DONDE SALE. Un transporte recibe bytes y los entrega a una impresora. Hoy:
 * `ble` (Web Bluetooth) y `serial` (Web Serial, Bluetooth clasico). Un puente futuro (ESP32,
 * cola en la nube) es otro archivo con estas mismas dos funciones; `index.ts` elige por `kind`.
 */
export type TransportKind = "ble" | "serial";

export type PrintFailure =
  | "unsupported"
  | "no_printer"
  | "cancelled"
  | "not_found"
  | "write_failed";

export type PrintResult =
  | { ok: true }
  | { ok: false; reason: PrintFailure; message: string };

/** Falla con causa: los transportes la lanzan, `index.ts` la convierte en `PrintResult`. */
export class PrintError extends Error {
  constructor(readonly reason: PrintFailure, message: string) {
    super(message);
  }
}

/** Traduce lo que lanza Chrome (`DOMException`) a una causa del modulo. */
export function printErrorFrom(error: unknown): PrintError {
  if (error instanceof PrintError) return error;
  const name = error instanceof DOMException ? error.name : "";
  const text = error instanceof Error ? error.message : "";
  // Chrome cierra la lista con `NotFoundError` tanto si el usuario la cancela («User cancelled
  // the requestDevice() chooser», «No port selected by the user») como si no hay ninguna.
  if (name === "NotFoundError" && /cancel|selected by the user/i.test(text))
    return new PrintError("cancelled", "No se eligio ninguna impresora.");
  if (name === "NotFoundError")
    return new PrintError(
      "not_found",
      "No encontramos la impresora. Revisa que este encendida y cerca, o elige otra.",
    );
  if (name === "AbortError" || name === "NotAllowedError")
    return new PrintError("cancelled", "No se eligio ninguna impresora.");
  if (name === "SecurityError")
    return new PrintError(
      "cancelled",
      "Chrome necesita que toques el boton para buscar la impresora.",
    );
  return new PrintError(
    "write_failed",
    "No pudimos enviar el ticket a la impresora. Revisa que este encendida y vuelve a intentar.",
  );
}
