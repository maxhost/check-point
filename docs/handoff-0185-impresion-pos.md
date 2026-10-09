# 0185 — Impresión desde Pedido

Conectado el botón circular junto a Cobrar en la orden abierta. Consume el
contrato 0184/c264dbf exclusivamente desde printing/index; módulo, API y kit
intactos. Encargo y README leídos completos antes de implementar.

El POS autorizado precarga GET /api/pos/ticket. Hasta recibir los booleanos,
Imprimir está deshabilitado; fallo ofrece reintento y 401/403 revocan el acceso.
No hay fetch al tocar. La orden guardada se convierte en TicketDoc y se llama
printTicket dentro del gesto. Doble toque y cambios sin guardar bloqueados.

Éxito usa ConfirmationToast compartido: Ticket impreso. Sin impresora se ofrece
Elegir impresora; sin dispositivo guardado disponible, Elegir otra olvida el
anterior y abre la selección. choosePrinter ocurre en ese segundo gesto, usando
BLE o serial si BLE no está disponible, y después imprime el mismo documento.
Cancelación/fallo muestran el mensaje del módulo sin modificarlo y permiten
reintentar. Cambiar orden/contexto invalida documentos y resultados tardíos.

Sin soporte se publica el TicketDoc en DOM antes de window.print. Nombre y mesa
pueden estar ausentes. Incluye productos, cantidad, unitario, subtotal, total,
fecha y hora; sin QR ni leyenda Precuenta. No muestra éxito físico del diálogo
del navegador. La impresión de órdenes cerradas conserva su flujo anterior.

## Verificación local

Node 24.20.0; todos los comandos precedidos de nvm use.

- `pnpm --filter @mi-pasaporte/merchant typecheck`: exit 0.
- `pnpm exec eslint apps/merchant tests/e2e/pos-printing.spec.ts tests/e2e/pos.spec.ts`: exit 0.
- `pnpm exec playwright test tests/e2e/pos-printing.spec.ts tests/e2e/pos.spec.ts`: 105 verdes (14 impresión y 91 POS), 21.6 s. Log `/private/tmp/0185-pos-regression.log`.
- Corrida final específica tras añadir el caso de revocación mientras carga el ajuste: 15 verdes, 6.7 s; `/private/tmp/0185-printing-final.log`.
- Prettier de los siete archivos fuente/pruebas, git diff --check y guard UI
  `node tools/ui-guard.ts --base 8264cc5`: verdes; cinco archivos UI sin incrementos.
- Capturas vistas: `/private/tmp/0185-elegir-impresora.png` y
  `/private/tmp/0185-ticket-navegador.png` (media print, nombre/mesa ocultos).

Los transportes BLE/serial son simulados; las pruebas consumen el módulo real.
Comprueban userActivation dentro del selector, filtros recordados, escritura,
doble toque, mensajes, ausencia de fetch al toque y de escrituras financieras,
las cuatro combinaciones de bloques opcionales y DOM listo en window.print.
La regresión POS solo añade el mock del GET nuevo, conservando sus oráculos.

pnpm ci:status no pudo consultar GitHub por red; no se declara CI remoto verde.
Sin gate global, migraciones, DB, merge ni push: trabajo en dev local.

## Prueba física del owner

1. Abrir POS con Chrome Android, una orden guardada y la WD-58P1 encendida.
2. Tocar el botón circular de impresora. Si no hay una guardada, tocar Elegir
   impresora y seleccionar WD-58P1. Revisar papel y toast Ticket impreso.
3. Imprimir otra vez sin recargar: debe reutilizar la conexión sin selector.
4. Recargar POS e imprimir: Chrome pide el dispositivo con el nombre guardado.
5. Si la impresora guardada no está disponible, revisar el mensaje y Elegir
   otra. Confirmar que cancelar permite volver al pedido.

Esta prueba queda pendiente del owner. No se certifica hardware físico ni
serial real. Papel 58/80, ajustes de dispositivo/owner y QR quedan fuera.
