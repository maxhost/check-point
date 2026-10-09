---
spec: 0184
fecha: 2026-10-09
estado: cerrada
resumen: Imprimir la orden abierta del POS a termicas Bluetooth (L2, API + DB + modulo de navegador; botones y pantallas de GPT; implementa ADR 0133). Migracion 0068 `core.ticket_settings` (nombre del comercio y mesa opcionales por comercio); `GET`/`PUT /api/merchant/business/ticket` (owner) y `GET /api/pos/ticket` (permiso `pos`); modulo `apps/merchant/src/printing/` en tres capas (ticket → ESC/POS 58/80 mm sin acentos → BLE / clasico) con impresora y papel por dispositivo. Bloque QR listo, vacio hasta la spec B. Borra `/prueba-impresora`.
disjunta: si (no toca archivos del POS de GPT; solo agrega)
archivos: packages/db/src/schema/ticket-settings.ts, packages/db/src/schema/index.ts, packages/db/drizzle/0068_ajuste_del_ticket.sql, packages/db/drizzle/meta/*, apps/merchant/src/server/ticket-settings/*, apps/merchant/src/app/api/merchant/business/ticket/route.ts, apps/merchant/src/app/api/pos/ticket/route.ts, apps/merchant/src/printing/**, apps/merchant/package.json, pnpm-lock.yaml, apps/merchant/src/app/prueba-impresora/** (borrar), apps/merchant/src/app/api/prueba-impresora/** (borrar)
---

# 0184 — Imprimir la orden abierta

> **Nivel L2** (ADR 0129): funcionalidad nueva con migracion a PROD (piso L2). Plantilla chica aunque lleva
> migracion, como la 0182: el ADR 0129 (posterior a la plantilla) asigna este template a L2. Decisiones del owner
> y diseño en el **ADR 0133**; no se repiten aca.

## Problema

- El POS imprime con `window.print()` a ancho de pagina: `pos-editor.tsx:947` («Imprimir precuenta») y
  `pos-console.tsx:629`; `pos-ticket.tsx` no tiene `@page` de 58/80 mm. El boton con icono de impresora del editor
  (`pos-editor.tsx:748`) no tiene `onPress`. Medido 2026-10-09.
- La impresion directa esta probada solo con la pagina publica de prueba (`app/prueba-impresora/`, ESC/POS escrito
  a mano, sin ajuste ni orden real). No hay modulo reutilizable ni ajuste de que lleva el ticket.

## Alcance

**Entra:** migracion 0068 + esquema; tres rutas del ajuste del ticket; el modulo `printing/` (armado, codificacion,
transportes BLE y clasico, ajuste del dispositivo) con su API publica documentada para GPT; borrar
`/prueba-impresora` y `/api/prueba-impresora/log` con sus referencias.

**No entra:** botones, pantalla de ajustes, dialogos, la vista HTML del `window.print()` (todo GPT, ADR 0114);
contenido del QR (spec B, PARQUEADO #85); logo; iOS; manifest PWA (PARQUEADO #86); imprimir una orden cerrada;
tickets de cocina.

## Diseño

### Modelo — `0068_ajuste_del_ticket.sql`

`core.ticket_settings`: `business_id uuid PK → core.business(id) ON DELETE cascade`, `show_business_name boolean
NOT NULL DEFAULT true`, `show_table boolean NOT NULL DEFAULT true`, `updated_at timestamptz NOT NULL DEFAULT now()`.
Sin fila = los defaults (no se crea fila al dar de alta un negocio). Sin grants nuevos: `checkpass_consumer` no lo lee.

### DTO `TicketSettings` (mismo en las tres rutas)

```ts
{ showBusinessName: boolean; showTable: boolean }
```

### Rutas — el negocio sale SIEMPRE de la sesion, nunca del cuerpo ni de la query

| Ruta | Guard | Respuesta | Errores propios |
|---|---|---|---|
| `GET /api/merchant/business/ticket` | `requireApiOwner` | `200 TicketSettings` | — |
| `PUT /api/merchant/business/ticket` | `requireApiOwner` | `200 TicketSettings` (lo guardado) | `422 invalid_input` si falta un campo o no es booleano, o el cuerpo no es JSON |
| `GET /api/pos/ticket` | `requirePosOperator` | `200 TicketSettings` | — |

Los demas errores son los del guard, sin cambios: owner → `apiOwnerFailureResponse` (401 `unauthorized`, 403
`not_owner` / `email_not_verified` / estado del negocio); POS → los de `requirePosOperator` (403
`missing_permission`, `pos_disabled`, …). `PUT` es upsert (`ON CONFLICT (business_id) DO UPDATE`, `updated_at = now()`).
Error inesperado → 500 con el formato `{ error, code }` del dominio, sin mensaje de la base.

### Modulo `apps/merchant/src/printing/` (solo navegador; `README.md` con el mapa y como extender)

```
printing/
  index.ts              API publica: lo UNICO que importa GPT
  README.md             capas, contrato, «como agrego un bloque», «como cambio el QR», «como agrego un transporte»
  ticket/types.ts       TicketSettings, TicketDoc, TicketOrder
  ticket/build.ts       buildTicket(order, settings, { qr?, now? }) → TicketDoc
  escpos/encode.ts      encodeTicket(doc, paper) → Uint8Array  (@point-of-sale/receipt-printer-encoder)
  escpos/plain.ts       sin acentos: NFD + quitar diacriticos, ñ→n, fuera todo lo no imprimible ASCII
  transport/types.ts    Transport = { kind; print(bytes): Promise<void> }
  transport/ble.ts      Web Bluetooth (servicios de la prueba de campo; trozos de 100 B; con/sin respuesta)
  transport/serial.ts   Web Serial (getPorts → el recordado; requestPort si no hay; 9600 baud)
  device.ts             DevicePrinter en localStorage (try/catch en cada acceso; sin storage = sin recordar)
```

**`TicketOrder`** es el subconjunto de `PosOrder` que el modulo lee — `business.{name,currencyCode}`, `tableLabel`,
`items[].{name,quantity,unitPrice,lineTotal}`, `total` — para no acoplarse al resto del tipo de la pantalla.

**`TicketDoc`** (datos puros; la vista HTML de GPT lo dibuja igual que el ESC/POS):

```ts
{ businessName: string | null;   // null si showBusinessName = false
  table: string | null;          // null si showTable = false o la orden no tiene mesa
  lines: { name; quantity; unitPrice; lineTotal }[];  // montos ya formateados con la moneda del negocio
  total: string; date: string; time: string;          // fecha y hora de la IMPRESION (`now`)
  qr: string | null }            // null → el bloque no se imprime (spec B lo llena)
```

Orden en el papel: nombre → mesa → linea → items (nombre; debajo `cant x unitario` a la izquierda y subtotal a la
derecha) → linea → TOTAL → fecha y hora → QR (nativo ESC/POS) → avance y corte. Columnas: 32 (58 mm) / 48 (80 mm).

**API publica (`index.ts`):**

```ts
buildTicket(order: TicketOrder, settings: TicketSettings, opts?: { qr?: string; now?: Date }): TicketDoc
printerSupport(): { ble: boolean; serial: boolean }
getDevicePrinter(): DevicePrinter | null      // { transport: "ble" | "serial"; name: string; paper: 58 | 80 }
setDevicePaper(paper: 58 | 80): void
forgetDevicePrinter(): void
choosePrinter(transport: "ble" | "serial"): Promise<PrintResult>   // abre la lista de Chrome; guarda el nombre
printTicket(doc: TicketDoc): Promise<PrintResult>
type PrintResult = { ok: true } | { ok: false; reason: PrintFailure; message: string }
type PrintFailure = "unsupported" | "no_printer" | "cancelled" | "not_found" | "write_failed"
```

- **Gesto:** `choosePrinter` y `printTicket` se llaman DIRECTO desde el `onPress`, con el `TicketDoc` ya armado; la
  lista de Chrome es lo primero que se espera (exigencia de Web Bluetooth/Serial). GPT carga `GET /api/pos/ticket`
  al abrir el POS, no en el toque.
- **BLE:** el dispositivo elegido queda en memoria del modulo: dentro de la misma carga, imprimir otra vez no abre
  la lista. Tras recargar, `printTicket` abre la lista filtrada por el nombre guardado (`filters: [{ name }]`), un
  toque. Si no esta (`NotFoundError`) → `not_found`; GPT ofrece «Elegir otra» (`forgetDevicePrinter` + `choosePrinter`).
- **Clasico:** `getPorts()` devuelve el puerto recordado sin lista; si no hay → `no_printer`.
- `printTicket` sin impresora guardada → `no_printer` (GPT llama `choosePrinter`). Sin las dos APIs → `unsupported`
  (GPT usa `window.print()` con su vista de `TicketDoc`). Lista cerrada → `cancelled`. Falla de escritura →
  `write_failed`. `message` en español, listo para mostrar. Nunca lanza.

### Contrato para GPT (resumen; el detalle vive en `printing/README.md`)

1. Al abrir el POS: `GET /api/pos/ticket` → guardar `TicketSettings`.
2. Boton imprimir: `const doc = buildTicket(order, settings)` → `printTicket(doc)` → si `no_printer`,
   `choosePrinter(...)` y reintentar; si `unsupported`, `window.print()` dibujando `doc`.
3. Ajuste del dispositivo («Impresora»): `printerSupport`, `getDevicePrinter`, `choosePrinter`, `setDevicePaper`,
   `forgetDevicePrinter`.
4. Ajuste del comercio (owner): `GET`/`PUT /api/merchant/business/ticket`.

## Archivos

| Archivo | Accion |
|---|---|
| `packages/db/src/schema/ticket-settings.ts`, `schema/index.ts` | crear / editar |
| `packages/db/drizzle/0068_ajuste_del_ticket.sql` + `meta/` | crear (drizzle-kit) |
| `apps/merchant/src/server/ticket-settings/{settings.ts,*.neon.integration.test.ts}` | crear |
| `apps/merchant/src/app/api/merchant/business/ticket/route.ts` | crear |
| `apps/merchant/src/app/api/pos/ticket/route.ts` | crear |
| `apps/merchant/src/printing/**` (+ `*.test.ts`) | crear |
| `apps/merchant/package.json`, `pnpm-lock.yaml` | `@point-of-sale/receipt-printer-encoder@4.0.1` |
| `apps/merchant/src/app/prueba-impresora/**`, `app/api/prueba-impresora/**` | borrar |

**Disjunta?** Si. No toca `backoffice/pos/*` (zona y arbol de GPT). Comparte solo `schema/index.ts` y el lock.

## Definition of Done

- [ ] `tools/neon-test.sh apps/merchant/src/server/ticket-settings/` en verde, con: sin fila → defaults; `PUT`
      guarda y `GET` (owner y POS) lo devuelve; `PUT` de A no cambia lo que lee B; staff con `pos` en `PUT` → 403
      `not_owner`; staff sin `pos` en `GET /api/pos/ticket` → 403 `missing_permission`; POS apagado → 403
      `pos_disabled`; `PUT` con `{ showTable: "si" }` o sin campo → 422 `invalid_input`.
- [ ] Unitarios de `printing/` en verde: `buildTicket` con las 4 combinaciones del ajuste y orden sin mesa; `qr`
      ausente → `null` y sin el comando QR (`GS ( k`) en los bytes, presente → con el comando; ningun byte > 0x7F
      con «Café Ñandú»; ninguna linea pasa de 32/48 columnas; BLE con un `navigator.bluetooth` falso: la lista se
      pide antes de cualquier otra espera, filtrada por nombre cuando hay uno guardado, trozos ≤ 100 B, segunda
      impresion sin lista; `localStorage` que lanza → no rompe; cada `PrintFailure` sale de su causa.
- [ ] Migracion 0068 aplicada en la base local y en la rama de Neon de la suite (`tools/neon-test.sh`). A PROD:
      con OK del owner, en el proximo pase a live (snapshot antes).
- [ ] `rg -n "prueba-impresora|PRUEBA-IMPRESORA" apps` → vacio.
- [ ] `rg -n "receipt-printer-encoder|printing/" apps/merchant/src/app/backoffice` → vacio (el modulo no se cablea
      en pantallas: es de GPT).
- [ ] typecheck + lint del merchant en 0 (Node 24).
- [ ] **En campo, cuando GPT cablee el boton** (fuera del cierre de esta spec, se anota en ESTADO): orden abierta
      real impresa en la WD-58P1; dos tickets seguidos sin lista; tras recargar, la lista muestra solo esa impresora.
- [ ] `rg -n MUTATION apps tools packages` → vacio.

## Mutaciones — presupuesto: 3. Clase: los plausibles

| # | Mutacion | Oraculo que tiene que ponerse ROJO |
|---|---|---|
| 1 | `settings.ts`: la lectura sin `where business_id` (toma la primera fila) | Neon «`PUT` de A no cambia lo que lee B» |
| 2 | `build.ts`: `table` ignora `showTable` | unitario de las 4 combinaciones |
| 3 | `plain.ts`: sin quitar diacriticos | unitario «ningun byte > 0x7F» |

**Protocolo:** el de la skill `protocolo-de-verificacion` (shasum, bitacora antes de medir, etiqueta, revertir con
diff, leer la asercion del rojo). **Corte:** dos vueltas «el fix abrio la siguiente» → al owner.

## Declarado AFUERA (sin oraculo, a proposito)

- Transporte clasico (Web Serial) contra una impresora real: no hay una SPP a mano; solo unitario con fake.
- QR impreso en papel (nativo vs imagen): se mide en campo con la spec B, que es la que le da contenido.
- Que la WD-58P1 respete el ancho de 32 columnas: se ve en la prueba de campo de la DoD.

## Handoff

L2: implementa Claude en la sesion, sin subagentes; revision propia contra la DoD con evidencia ejecutada. Al
cerrar: fila del INDEX a `implementada`, ESTADO, y aviso a GPT (`docs/estado/gpt.md` o encargo) con el contrato.

## Abierto

Nada que bloquee.
