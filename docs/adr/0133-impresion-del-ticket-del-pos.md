---
adr: 0133
fecha: 2026-10-09
estado: aceptada
resumen: El ticket del POS se imprime desde el navegador a termicas Bluetooth (Web Bluetooth para BLE, Web Serial para clasico; `window.print()` sin ninguno) con un modulo propio en tres capas separadas — QUE se imprime (`TicketDoc`, armado de la orden + el ajuste del comercio), COMO se codifica (ESC/POS 58/80 mm, sin acentos) y POR DONDE sale (transporte). La base del ticket es fija (items con cantidad y unitario, total, fecha, hora, QR); los bloques opcionales (nombre del comercio, mesa) los elige cada comercio y se guardan en `core.ticket_settings`. La impresora y el papel son del DISPOSITIVO (localStorage), no del comercio.
---

# 0133 — Impresion del ticket del POS

## Contexto

PARQUEADO #84. Prueba de campo del 2026-10-09: la WD-58P1 de un comercio real es BLE (servicio `18f0`) e imprimio
por Web Bluetooth desde Chrome Android; Web Serial no la ve (`docs/investigacion-impresoras-termicas-2026-10-09.md`).
Hoy el POS imprime con `window.print()` a ancho de pagina y el boton con icono de impresora del editor no hace nada.

## Decisiones del owner (2026-10-09)

1. Se imprime la **orden abierta**. **Android primero**; iOS y app en tiendas sin decidir.
2. **BLE y Bluetooth clasico**; papel **58 y 80 mm a elegir**; sin Bluetooth, `window.print()`.
3. **Claude arma la API del modulo; GPT los botones y las pantallas** («vos armas el API, no armas el boton»).
   El modulo tiene que quedar «bien organizado, documentado para poder extenderlo, cambiarlo, cambiar que recibe
   el QR que se imprime […] no acoplado en medio de un monton de codigo».
4. **Contenido**: «la base siempre sera items, cantidad, unitario, total, fecha, hora y nuestro QR». Nombre del
   comercio y mesa son opcionales por comercio («alguno querra imprimir la mesa otros no, alguno querra incluir
   logo, otros no»). **Nada de leyenda de precuenta.**
5. **Sin acentos** («que se imprima sin acentos»).
6. El ajuste del ticket va **en la base de datos**, con pantalla de GPT («vamos con la opcion de base de datos»),
   no como archivo del codigo.
7. La impresora se recuerda por **nombre** en el dispositivo y la lista de Chrome muestra **solo esa**; un toque
   por carga de pagina es aceptable.
8. **QR, opcion A**: el bloque QR queda listo y se imprime solo si se le pasa un contenido; lo llena la spec B
   (PARQUEADO #85). Hasta entonces el ticket sale sin QR.

## Decision

**Tres capas, cada una reemplazable sin tocar las otras** (`apps/merchant/src/printing/`):

| Capa | Entrada → salida | Para cambiar… |
|---|---|---|
| `ticket/` (QUE) | orden + `TicketSettings` + `{ qr? }` → `TicketDoc` (datos puros) | un bloque, el contenido del QR, un bloque nuevo (logo) |
| `escpos/` (COMO) | `TicketDoc` + papel → `Uint8Array` | el formato de bytes, otra familia de impresoras |
| `transport/` (POR DONDE) | `Uint8Array` → impresora | BLE, clasico, un puente futuro (ESP32, cola en la nube) |

- `TicketDoc` es el **unico contrato** entre capas, y tambien lo que la vista HTML de GPT dibuja para el
  `window.print()`: el mismo ajuste del comercio vale en los dos caminos.
- **Ajuste del comercio en `core.ticket_settings`** (una fila por negocio, sin fila = valores por defecto): hoy
  `show_business_name` y `show_table`, los dos `true` por defecto (el owner los listo en su ticket). Lo edita el
  **owner** (como el modulo POS, `PUT /api/merchant/business/pos`); lo lee quien opera el POS (permiso `pos`).
  Un bloque nuevo = una columna con default + un campo del DTO + una funcion de `ticket/`.
- **Ajuste del dispositivo en `localStorage`**: transporte, nombre de la impresora y papel. Una tablet puede tener
  la de 58 mm y otra la de 80 mm del mismo local; guardarlo en la base no sirve porque Chrome no acepta un
  dispositivo que no eligio el usuario en su lista (el identificador BLE es opaco y por navegador;
  `getDevices()` sigue detras de flag).
- **Sin acentos en el codificador** (`NFD` y fuera los diacriticos; `ñ` → `n`): la tabla de caracteres de una
  termica generica no esta garantizada y el owner no lo necesita.
- La fecha y hora del ticket son las **de la impresion** (es una precuenta de una orden abierta, no un comprobante
  de cierre).

## Alternativas descartadas

- **Perfiles en el codigo** (archivo de configuracion por tipo de comercio): rechazado por el owner, quiere que
  cada comercio elija desde su panel.
- **Columnas en `core.business`** (como `pos_enabled`): la tabla del negocio ya carga marca, plan, estado y
  modulos; una tabla propia agrupa todo lo del ticket y crece sin tocar el negocio.
- **JSON libre** con los bloques: sin `CHECK` ni default por columna; agregar una columna con default es una
  migracion trivial y queda tipado de punta a punta.

## Consecuencias

- La spec 0184 lo implementa (migracion 0068). Al cerrarla se borran `/prueba-impresora` y su bitacora publica.
- El logo y el contenido del QR son extensiones previstas, no construidas (logo: sin pedido concreto todavia;
  QR: spec B).
- iOS sigue sin camino desde la web (WebKit no implementa Web Bluetooth); un puente ESP32 seria otro `transport/`.
