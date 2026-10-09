# Encargo para GPT — 2026-10-09: imprimir el ticket del POS

Lo arma Claude a pedido del owner. La API y el modulo de impresion estan hechos, probados y commiteados en `dev`;
faltan los botones y las pantallas (zona GPT, ADR 0114).

## 0. Rama `dev`, sin push

Igual que el encargo del POS (`docs/encargo-gpt-2026-10-08-pos.md` §0). La migracion `0068` (ajuste del ticket) solo
existe en `dev` y en la base local tras levantar el entorno; en PROD todavia no.

## 1. Fuente de verdad

- **`apps/merchant/src/printing/README.md`**: contrato, ejemplo de uso y reglas (leelo entero).
- Spec `docs/specs/0184-imprimir-la-orden-abierta.md` §Diseño y ADR `docs/adr/0133-impresion-del-ticket-del-pos.md`.
- Importa **solo** `apps/merchant/src/printing/index.ts`. No toques las capas internas.

## 2. Que pidio el owner (2026-10-09)

1. **Imprimir la orden abierta** desde el POS. Los botones que hay hoy («Imprimir» con icono en
   `pos-editor.tsx`, sin accion; «Imprimir precuenta»; «Imprimir» de `pos-console.tsx`) los decides vos: el owner
   dijo que va a «quitar botones, cambiar UI».
2. **Ajuste «Impresora» por dispositivo**: elegir impresora (BLE o Bluetooth clasico segun `printerSupport()`),
   papel 58 / 80 mm, olvidar impresora.
3. **Pantalla del owner para el ticket del comercio**: prender y apagar «nombre del comercio» y «mesa». **Ninguna es
   obligatoria** (las dos apagadas es valido). `GET` / `PUT /api/merchant/business/ticket`, solo el owner.
4. Sin Bluetooth (`unsupported`): `window.print()` dibujando el `TicketDoc` (asi el ajuste del comercio vale tambien
   ahi). La base del ticket: items con cantidad y unitario, total, fecha, hora. **Sin leyenda de «precuenta».**

## 3. Reglas que rompen si se ignoran

- `printTicket` y `choosePrinter` van **directo** en el `onPress`, sin `await` antes (Chrome solo abre su lista
  dentro del gesto). El ajuste del comercio (`GET /api/pos/ticket`) se carga al abrir el POS, no en el toque.
- Los resultados nunca lanzan: muestra `result.message` tal cual (ya esta en español).
- El QR todavia no se imprime: lo agrega la spec B (venta reclamable, PARQUEADO #85).
