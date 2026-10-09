import type { Paper } from "./escpos/layout";
import type { TransportKind } from "./transport/types";

/**
 * Spec 0184 / ADR 0133 — LA IMPRESORA DE ESTE DISPOSITIVO (no del comercio): transporte y nombre,
 * y aparte el papel (se elige aunque todavia no haya impresora). En `localStorage`; cada acceso va
 * en try/catch: sin almacenamiento (ventana privada, datos borrados) el modulo funciona igual,
 * solo que no recuerda.
 */
export type DevicePrinter = { transport: TransportKind; name: string };

const PRINTER_KEY = "checkpass-printer";
const PAPER_KEY = "checkpass-printer-paper";
const DEFAULT_PAPER: Paper = 58;

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Sin almacenamiento: imprime igual en esta carga, no se recuerda.
  }
}

export function getDevicePrinter(): DevicePrinter | null {
  const v = read(PRINTER_KEY) as Record<string, unknown> | null;
  if (!v || typeof v !== "object") return null;
  if ((v.transport !== "ble" && v.transport !== "serial") || typeof v.name !== "string")
    return null;
  return { transport: v.transport, name: v.name };
}

export function saveDevicePrinter(printer: DevicePrinter | null): void {
  write(PRINTER_KEY, printer);
}

/** 58 mm si nunca se eligio. */
export function getDevicePaper(): Paper {
  const v = read(PAPER_KEY);
  return v === 58 || v === 80 ? v : DEFAULT_PAPER;
}

export function setDevicePaper(paper: Paper): void {
  write(PAPER_KEY, paper);
}
