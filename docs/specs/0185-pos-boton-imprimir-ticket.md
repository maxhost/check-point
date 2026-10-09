---
spec: 0185
fecha: 2026-10-09
estado: cerrada
resumen: Conectar el botón circular Imprimir de la orden abierta a printing/index, precargar el ajuste y ofrecer elección de impresora o TicketDoc para window.print.
disjunta: no
archivos: apps/merchant/src/app/backoffice/pos/pos-console.tsx, apps/merchant/src/app/backoffice/pos/pos-editor.tsx, apps/merchant/src/app/backoffice/pos/pos-printing.ts, apps/merchant/src/app/backoffice/pos/pos-print-feedback.tsx, apps/merchant/src/app/backoffice/pos/pos-print-ticket.tsx, tests/e2e/pos-printing.spec.ts, tests/e2e/pos.spec.ts
---

# 0185 — Botón circular Imprimir del POS

L2 (ADR0129), implementación en sesión principal sin subagentes. Owner solicita
conectar exclusivamente el botón circular junto a Cobrar. Contrato existente
0184/c264dbf y ADR0133; encargo2026-10-09 leído completo, igual que printing/README.

## Problema

pos-editor.tsx: botón Imprimir de Pedido no tiene onPress. Window.print actual
usa PosTicket con Precuenta y bloques obligatorios, sin ajuste del comercio.

## Alcance

Entra: precarga ajuste al abrir POS autorizado, impresión de orden abierta
GUARDADA, elección/reemplazo mínimo de impresora dentro del mismo flujo,
mensajes y HTML TicketDoc para navegador. Fuera: ajustes papel/dispositivo,
pantalla owner, órdenes cerradas, QR, módulo printing, rutas API, kit y DB.

## Diseño

- Importar SOLO ../../../printing/index desde UI POS. GET /api/pos/ticket al
  abrir contexto autorizado (usuario/comercio), una precarga independiente de
  órdenes/catálogo. Sin defaults inventados: validar booleanos, deshabilitar
  imprimir hasta recibir ajuste. Error local con reintento;401/403 revocan POS
  por handleError existente. Al cambiar contexto invalidar ajuste/respuestas.
- Botón bloqueado para busy/dirty/conflict/orden no abierta/sin líneas/sin ajuste.
  Guard síncrono adicional evita doble toque. Armar doc con buildTicket(order,
  settings) y llamar printTicket sin fetch/await anterior, desde onPress.
- ok: ConfirmationToast Ticket impreso. no_printer: diálogo con mensaje exacto
  y Elegir impresora. Su onPress llama choosePrinter (BLE si support.ble, serial
  si no), sin await anterior. Selección exitosa reimprime doc congelado.
- not_found: mensaje exacto, Elegir otra hace forgetDevicePrinter síncrono y
  choosePrinter en onPress. cancelled/write_failed: mensaje exacto, reintento
  directo del mismo doc; cerrar mantiene orden. No funciones lanzan PrintResult.
- unsupported: flushSync publica TicketDoc en HTML print-only antes de
  window.print. Nombre/mesa null no aparecen; ítems/cantidad/unitario/subtotal,
  total/fecha/hora vienen del doc. Sin Precuenta ni QR, sin mezclar PosTicket.
  No se declara éxito físico del diálogo del navegador.
- Cambiar orden/versión/contexto invalida reintentos y feedback tardío. No PUT,
  close, grant o remove; impresión no cambia pedido ni cliente/beneficio.

## Archivos

Console consume hook/renderiza feedback y TicketDoc; editor recibe callback y
estado de impresión. Nuevos hook y dos vistas UI aislados del módulo reservado.
Pruebas usan navegador y transporte BLE/serial falsos, API real de printing sin
editar internals. Adaptaciones a oráculos POS solo para precarga nueva explícita.

## Definition of Done

- [x] Prefetch al abrir POS, ninguno al tocar imprimir; ajuste falso/falso válido.
- [x] Bluetooth chooser se ejecuta con userActivation y sin fetch previo.
- [x] Éxito, no_printer, not_found→Elegir otra, cancelled/write_failed exactos;
      serial sin BLE, guard doble toque y mensajes sin escrituras financieras.
- [x] Browser print observa DOM TicketDoc publicado, bloques opcionales y
      fecha/hora/unitarios; ausencia de Precuenta/QR.
- [x] Settings fallido/retry, auth/contexto y respuestas tardías aisladas.
- [x] Typecheck y lint merchant en0; formato/guard UI sin incrementos; e2e
      específicos y regresión POS pertinentes. Gate global solo antes de live.
- [x] Estado GPT y handoff con comandos/evidencia/limitaciones.

## Cierre local

UI implementada y verificada el 2026-10-09. Quince pruebas específicas verdes
con transportes simulados; corrida conjunta previa de 14 específicas y 91 de
regresión POS: 105 verdes. Typecheck y lint de todo merchant en cero; formato,
diff y guard de cinco archivos UI sin incrementos. Capturas de elección y
TicketDoc del navegador vistas. Evidencia y QA pendiente en
`docs/handoff-0185-impresion-pos.md`. Sin cambios en printing/API, sin push.

## Mutaciones

No adversariales para L2. Casos funcionales del gesto, precarga y DOM listos.

## Declarado afuera

QA real WD-58P1/ChromeAndroid por owner: dos impresiones seguidas y tras reload.
Serial físico, papel58/80 ajustable, ajustesowner y migración0068aPROD fuera.
Dev local sin merge/push, autorización de live pendiente (ADR0128).

## Abierto

Nada que bloquee esta conexión; prueba física queda al owner.
