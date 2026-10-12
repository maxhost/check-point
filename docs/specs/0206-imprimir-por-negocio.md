---
spec: 0206
fecha: 2026-10-11
estado: implementada (API); UI de GPT pendiente
resumen: Interruptor por negocio «Imprimir tickets» (apagado por defecto para todos); con la impresion apagada el POS no muestra «Imprimir». Migracion 0072 aditiva.
disjunta: si
archivos: packages/db/drizzle/0072_*, packages/db/src/schema/ticket-settings.ts, apps/merchant/src/server/ticket-settings/settings.ts (+ neon test), apps/merchant/src/app/api/merchant/business/ticket/route.ts, apps/merchant/src/app/api/pos/ticket/route.ts, apps/merchant/src/printing/README.md
---

# 0206 — Imprimir tickets: si o no, por negocio

> L2 (ADR 0129): funcionalidad chica, pero con migracion a PROD (piso L2). Spec CHICA. Sin ADR: extiende el ajuste
> del ticket de la spec 0184 / ADR 0133 con un campo mas, sin decision de diseño nueva.

## Problema

- El ajuste del ticket por negocio (`core.ticket_settings`, `packages/db/src/schema/ticket-settings.ts`) solo tiene
  los bloques opcionales `show_business_name` y `show_table`. No hay forma de decir «este negocio no imprime».
- El POS muestra siempre el boton «Imprimir»: en la orden abierta (`pos-editor.tsx:838`, `printing.print`) y en el
  detalle de la orden (`pos-console.tsx:648`, `window.print()`). Un comercio sin impresora lo ve igual.

## Decisiones del owner (2026-10-11)

- **Apagada → se OCULTA el boton** «Imprimir» del POS (no deshabilitado).
- **Valor inicial: APAGADA PARA TODOS**, existentes y nuevos. Cada comercio la prende en Ajustes.

## Alcance

**Entra:** columna `printing_enabled`, el campo `printingEnabled` en el DTO del ajuste (lectura owner y POS, escritura
owner), la migracion 0072, el contrato de pantalla para GPT.

**No entra:** las pantallas (GPT, §Contrato para GPT); el ancho de papel (es del dispositivo, PARQUEADO #92); que la
impresora del dispositivo se olvide al apagar (sigue en `localStorage`, inofensivo).

## Diseño

**Migracion 0072 (aditiva):** `ALTER TABLE core.ticket_settings ADD COLUMN printing_enabled boolean NOT NULL DEFAULT
false;`. Las filas existentes quedan en `false` por el default; un negocio SIN fila lee el default del DTO, tambien
`false`. Nada se borra ni se reescribe.

**DTO** (`server/ticket-settings/settings.ts`): `TicketSettings = { printingEnabled, showBusinessName, showTable }`,
los tres booleanos. `DEFAULT_TICKET_SETTINGS.printingEnabled = false` (igual al default de la columna).

| Ruta | Quien | Cambio |
|---|---|---|
| `GET /api/merchant/business/ticket` | owner | devuelve tambien `printingEnabled` |
| `GET /api/pos/ticket` | permiso `pos` | devuelve tambien `printingEnabled` |
| `PUT /api/merchant/business/ticket` | owner | cuerpo `{ printingEnabled, showBusinessName, showTable }`, **los tres booleanos y obligatorios** (es un `PUT` del ajuste entero). Falta uno o no es booleano → `422 invalid_input` «Indica si el negocio imprime tickets y que bloques muestra.». Ok → 200 con lo guardado |

Sin cambios en autorizacion ni aislamiento: el negocio sale de la sesion (`requireApiOwner` / `requirePosOperator`),
nunca del cuerpo. Apagar la impresion NO borra `showBusinessName`/`showTable`: quedan guardados para cuando se prenda.

## Contrato para GPT (pantallas)

- **Ajustes** (`backoffice/settings/ticket-settings.tsx`): interruptor «Imprimir tickets» arriba. Apagado → se ocultan
  «nombre del comercio» y «mesa» (sus valores se conservan y se reenvian en el `PUT`). El `PUT` manda siempre los tres.
- **POS:** con `printingEnabled: false` (de `GET /api/pos/ticket`) NO se muestra ningun boton «Imprimir»: ni el de la
  orden abierta (`pos-editor.tsx`) ni el del detalle (`pos-console.tsx`). Mientras el ajuste no cargo, tampoco.

## Archivos

| Archivo | Accion |
|---|---|
| `packages/db/drizzle/0072_imprimir_por_negocio.sql` (+ `meta`) | crear |
| `packages/db/src/schema/ticket-settings.ts` | editar |
| `apps/merchant/src/server/ticket-settings/settings.ts` | editar |
| `apps/merchant/src/server/ticket-settings/ticket-settings.neon.integration.test.ts` | editar |
| `apps/merchant/src/app/api/merchant/business/ticket/route.ts`, `apps/merchant/src/app/api/pos/ticket/route.ts` | editar (docblock y mensaje 422) |
| `apps/merchant/src/printing/README.md` | editar (contrato) |
| UI (GPT): `ticket-settings.tsx`, `pos-editor.tsx`, `pos-console.tsx`, `pos-printing.ts` | editar |

**Disjunta?** Si: no toca pantallas.

## Definition of Done

- [x] Neon (`tools/neon-test.sh` sobre la suite del ticket): sin fila → owner y POS leen `printingEnabled: false`;
      guardar `true` → owner y POS lo leen; apagar conserva `showBusinessName`/`showTable` (leido por SQL); cuerpo sin
      `printingEnabled` → 422 `invalid_input`; aislamiento entre comercios.
- [x] La migracion aplicada a la base de CI deja la columna `NOT NULL DEFAULT false` (leido por SQL de
      `information_schema`).
- [x] typecheck y lint de `merchant` y `db` en 0.
- [x] `rg -n MUTATION apps packages tools` → vacio.

## Mutaciones — presupuesto: 2. Clase: los plausibles

| # | Mutacion | Oraculo que tiene que ponerse ROJO |
|---|---|---|
| 1 | `DEFAULT_TICKET_SETTINGS.printingEnabled = true` | «sin fila → `printingEnabled: false`» |
| 2 | `parseTicketSettings` acepta el cuerpo sin `printingEnabled` (lo toma como `false`) | «cuerpo sin `printingEnabled` → 422» |

## Declarado AFUERA

- Que el POS oculte el boton: es pantalla (GPT, su e2e).

## Abierto

Nada.

## Resultado (2026-10-11)

API implementada por Claude. Neon (rama de CI, migracion 0072 aplicada por `tools/neon-test.sh`): suite del ticket
9/9. typecheck `merchant` y `db` 0. Mutaciones M1 y M2 ROJAS (bitacora en `docs/TASKS.md`). UI de GPT pendiente
(§Contrato para GPT); hasta entonces la pantalla de Ajustes manda el cuerpo viejo y recibe 422: **no se pushea sin la
UI**. Migracion 0072 a PROD con el push.
