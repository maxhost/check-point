# printing — imprimir el ticket del POS

Spec 0184 / ADR 0133. Modulo de **navegador**: imprime a termicas Bluetooth desde Chrome Android
(Web Bluetooth para BLE, Web Serial para Bluetooth clasico). Las pantallas importan **solo**
`printing/index.ts`.

## Capas

```
orden + TicketSettings + { qr? }
        │  ticket/build.ts        QUE se imprime   → TicketDoc (datos puros)
        ▼
     TicketDoc  ──────────────►  vista HTML de window.print() (pantallas)
        │  escpos/layout.ts       renglones dentro del ancho (32 / 48 columnas), sin acentos
        │  escpos/encode.ts       COMO se codifica → Uint8Array ESC/POS
        ▼
     bytes
        │  transport/ble.ts       POR DONDE sale: Web Bluetooth
        │  transport/serial.ts                    Web Serial (SPP)
        ▼
     impresora
```

`device.ts` guarda en `localStorage` la impresora de ESTE dispositivo (transporte + nombre) y el
papel (58 / 80 mm). El ajuste del COMERCIO (que bloques opcionales lleva el ticket) vive en la base:
`core.ticket_settings`.

## Contrato para las pantallas

```ts
import {
  buildTicket,
  printTicket,
  choosePrinter,
  forgetDevicePrinter,
  printerSupport,
  getDevicePrinter,
  getDevicePaper,
  setDevicePaper,
} from "../../printing"; // ruta relativa: el repo no tiene alias `@/`

// 1. Al abrir el POS (NO en el toque):
const settings = await fetch("/api/pos/ticket").then((r) => r.json()); // TicketSettings

// 2. Boton imprimir, directo en el onPress:
const doc = buildTicket(order, settings); // order: PosOrder sirve tal cual
const result = await printTicket(doc);
if (!result.ok) {
  // "no_printer"  → choosePrinter("ble" | "serial") y volver a imprimir
  // "not_found"   → ofrecer «Elegir otra»: forgetDevicePrinter() + choosePrinter(...)
  // "unsupported" → window.print() dibujando `doc`
  // "cancelled" / "write_failed" → mostrar result.message
}

// 3. Ajuste «Impresora» del dispositivo:
printerSupport(); // { ble, serial }: que botones de «Elegir impresora» mostrar
getDevicePrinter(); // { transport, name } | null
choosePrinter("ble"); // abre la lista de Chrome (en un onPress)
setDevicePaper(80); // 58 | 80; getDevicePaper() devuelve 58 si nunca se eligio
forgetDevicePrinter();
```

Ajuste del comercio (solo el owner): `GET` / `PUT /api/merchant/business/ticket` con
`{ showBusinessName: boolean, showTable: boolean }`. Ninguno es obligatorio.

**Reglas que no se ven en los tipos:**

- `choosePrinter` y `printTicket` van **directo** en el `onPress`, sin `await` antes: Chrome solo
  abre su lista dentro del gesto del usuario.
- BLE: tras recargar la pagina, `printTicket` abre la lista de Chrome **filtrada** a la impresora
  guardada (un toque). Dentro de la misma carga no vuelve a preguntar.
- Ninguna funcion lanza: todo vuelve como `PrintResult` con `message` en español.

## Como extender

**Agregar un bloque opcional (p. ej. logo, direccion):**

1. Columna con default en `packages/db/src/schema/ticket-settings.ts` + migracion (`db:generate`).
2. Campo en `TicketSettings` y `DEFAULT_TICKET_SETTINGS` + `parseTicketSettings`
   (`server/ticket-settings/settings.ts`), y en `ticket/types.ts` (`build.test.ts` no compila si los
   dos tipos se separan).
3. Campo en `TicketDoc` y su linea en `ticket/build.ts`.
4. Su renglon en `escpos/layout.ts` (un logo es una imagen: `encoder.image(...)` en `encode.ts`).

**Cambiar el contenido del QR:** quien llama pasa `buildTicket(order, settings, { qr: "<url>" })`.
Sin `qr` el ticket sale sin QR. El contenido lo decide la spec B (PARQUEADO #85), no este modulo.

**Cambiar el orden o el formato del papel:** solo `escpos/layout.ts`.

**Otra familia de impresoras (StarPRNT, etc.):** un `escpos/encode-<familia>.ts` con la misma
firma `(doc, paper) → Uint8Array`.

**Otro transporte (puente ESP32, cola en la nube):** un `transport/<nombre>.ts` con `choose…` y
`print…`, su `kind` en `TransportKind` y su rama en `index.ts`.

## Pruebas

`pnpm exec vitest run src/printing` (sin impresora: navegadores falsos y bytes) y
`tools/neon-test.sh src/server/ticket-settings/ticket-settings.neon.integration.test.ts` (rutas).
Medido en campo: BLE con la WD-58P1 (servicio `18f0`). Sin medir: Web Serial contra una impresora
real y el QR en papel.
