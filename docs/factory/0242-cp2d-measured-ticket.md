# 0242 — CP2d.6 resultado, ticket e impresión V2 preparados

Estado: preparada. Autor NUEVO/contexto vacío después de aceptar cobro CP2d.5; coordinador fija base, worktree y reserva antes del código. Sin conectar consola/ruta productiva en este bloque. Leer protocolos, spec/contrato 0242 de tickets, COPY y README de printing; UI con kit e Impeccable harden/craft-floor. El contexto Impeccable del proyecto ya se cargó: no reiniciar ni editar artefactos ajenos.

## Resultado y diseño previo

Proponer API/ownership del resultado y hook de impresión antes de escribir. Componentes preparados reciben PosOrderV2 canónica y cliente V2 del padre. Resultado cerrado muestra acreditación y saldo existentes, cupón/extras y cierre sin pase; no crea comandos ni intenta cobrar de nuevo cuando falla impresión. Impresión soporta precuenta abierta y reimpresión cerrada, con estado/tipo/identificador/nota claros. No presentar anulada como venta; conservar su estado si se permite su ticket según la interfaz existente. Separar el fallo de impresión del cierre conocido.

Nuevo builder puro buildMeasuredTicket recibe PosOrderV2 y ajustes actuales, devuelve el MISMO TicketDoc utilizado por HTML/ESC-POS. Cantidades y tarifas conservan cadenas exactas y unidades kg/lb/g/unit, incluidos nueve decimales y snapshots legacy amplios. No adaptar a TicketOrder.quantity numérico ni pasar masas por Number. Importes desde DTO/settlement congelado; bruto/descuento/ajuste/neto conservan minorUnit y moneda históricos, incluido neto0 y COP/JPY. No recalcular desde catálogo ni redondear tarifa a centavos antes de imprimir. La cuenta abierta usa su asignación monetaria canónica, evitando suma independiente de renglones incompatible con el total. Mantener builder legacy intacto; extensión compatible explícita de TicketDoc para cantidad textual y metadatos opcionales tipo/identificador/nota. Ambos renderers imprimen esos mismos campos y respetan 58/80mm. Reutilizar transportes, dispositivos, papel y feedback actuales; sin nuevos drivers ni configuración DB.

Hook recibe orden/contexto/cliente y carga configuración fuera del camino crítico inicial: preparación explícita del padre después de lista usable o al abrir detalle/resultado. No GET de ticket al importar/montar una consola aún no usable. Antes del gesto de imprimir, TicketDoc y ajustes ya están listos. printTicket/choosePrinter se invocan directamente desde el gesto, sin fetch/await previo. No migrar los transportes ni duplicar lógica de permisos de impresora. printingEnabled=false y errores de ajustes respetan comportamiento vigente; reintento explícito.

Identidad real de contexto y orden/version/estado retira callbacks/documento/intento viejo; un resultado tardío de A nunca abre window.print ni imprime bajo B. Desmontaje o cambio de selección suprime efectos tardíos. Doble toque no duplica trabajo; reintento de impresión no modifica venta, pase, cupón, saldo ni caché monetaria. Reutilizar feedback existente mediante su contrato o componente preparado nuevo, sin modificar legacy fuera de reserva. No autoprint de un cierre incierto.

## Paths autorizables

- apps/merchant/src/modules/pos/ui/printing/ticket/build-measured.ts.
- apps/merchant/src/modules/pos/ui/printing/ticket/build-measured.test.ts.
- apps/merchant/src/modules/pos/ui/printing/ticket/types.ts, extensión compatible explícita.
- apps/merchant/src/modules/pos/ui/printing/index.ts, solo export del builder.
- apps/merchant/src/modules/pos/ui/printing/escpos/layout.ts, metadatos opcionales compartidos.
- apps/merchant/src/modules/pos/ui/pos-print-ticket.tsx, metadatos opcionales compartidos.
- apps/merchant/src/modules/pos/ui/measured-ticket.tsx.
- apps/merchant/src/modules/pos/ui/measured-printing.ts.
- tests/e2e/pos-measured-ticket.spec.ts.
- tests/e2e/support/pos-measured-ticket-harness.tsx.
- tests/e2e/support/pos-measured-ticket-fixture.ts.
- docs/factory/0242-cp2d-measured-ticket-handoff.md.

Sin consola/listado/editor/cobro/servidor/contratos POS/transportes/dispositivo/schema/journal/kit/guardias/tooling/deps/estados/índices. Solicitar extensión concreta antes de cualquier otro path. Sin framework nuevo; dividir solo por responsabilidades del bloque.

## Gate

Node24, tipos merchant, lint/formato/UIguard y tests puros del builder/ESC-POS/legacy pertinentes. Casos decisivos: masa manual con nueve decimales y unidad/tarifa distinta, entero legacy amplio, bruto/neto/ajuste/cupón y neto0, reparto COP2×0.49→1+0=1, moneda histórica, tipo/etiqueta/nota, papel58/80 sin desbordamiento ni pérdida de información. Harness browser para precuenta/reimpresión/resultado sin pase y con pase, sin red de configuración antes de preparar, gesto síncrono conservado, retry/fallback, cancelación/unsupported/write_failed, late identity/orden/desmontaje suprimidos y cero comandos de venta por imprimir. No afirmar papel físico ni BLE real por mocks.

Una inspección agrupada390/1280 con capturas ABIERTAS, máximo una confirmación tras ajustes. Runner Chromium propio puede requerir escalación acotada por MachPortRendezvous1100, autorizada; avisar inmediatamente ante bloqueo de sandbox. Sin DB/env/wrapper, Next build, fullverify, M0/M1. Evidencia SHA/base/config/comandos/exits/fallos/skips fueraWT, fuente congelada antes de checks y cero procesos antes entrega. QA NUEVO independiente; fixes permanecen con autor hasta aceptación. Sin push/PROD ni tocar 3201/túnel/demos o artefactos ajenos.
