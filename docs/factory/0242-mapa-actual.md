# 0242 — Mapa del POS actual y comparación con el laboratorio

Mapeo de dos agentes de solo lectura coordinados por GPT, 2026-10-18. Base de producto `5f9cb2b2af49fa45850c059ef33f8bb69ea15172`, dev. Reserva documental posterior `ec454681` no cambió producto. No se ejecutaron DB, servidores, tests ni mediciones de producto durante el mapeo. La verificación navegable previa del laboratorio no certifica estos contratos.

## Fuentes y agentes

- `map_pos`: POS, Mostrador, medidas, stock/recetas/eventos, accesos e impresión.
- `map_performance`: autenticación/cookies, carga inicial, cachés, SQL visible y antecedentes0238.
- Coordinador: decisiones del owner, comparación v004, PWA/cupones y contratos de migración.
- Fuentes funcionales: `docs/design-explorations/2026-10-18-mostrador/decisiones.html` y `versiones/v004/`.

## POS actual

| Superficie | Archivos / símbolos | Comportamiento observado |
| --- | --- | --- |
| Módulo y permisos | `apps/merchant/src/modules/pos/manifest.ts`, `modules/dispatch.ts` | Módulo POS, permiso pos; Mesas opcional. Módulo apagado impide operación. |
| Entrada SSR | `modules/pos/ui/pos-screen.tsx` | Guard y locales activos; monta PosConsole. |
| Consola | `pos-console.tsx` | list/edit/detail, sesión→historial, QR/pago/impresión/anular. |
| Editor | `pos-editor.tsx`, `pos-cart.tsx` | Mesa/contexto, catálogo, revisión, nota, confirmación, borrador/conflictos. Reutiliza DetailedSale de Mostrador. |
| Caché | `pos-cache.ts` | Privada al montaje; userId:businessId, dedupe, generaciones, catálogos por local, detalles por ID; sin TTL/persistencia. |
| Listado | `server/list.ts::listPosOrders` | Abiertas antiguas primero; cerradas y anuladas del día local recientes primero; anuladas90d aparte. Todas líneas para calcular resúmenes. |
| Orden | `server/orders.ts`, `read.ts`, `order-input.ts` | Snapshots al agregar línea; PUT versionado con lista completa, lineId conserva precio/nombre; omisión elimina. |
| Mesas | `server/tables.ts`, schema modules/pos | Mesa determina local/nombre; una abierta por mesa mediante índice parcial/locks. Sin Mesas se permite etiqueta libre. |
| Cierre | `server/close.ts`, `settlement.ts` | Una transacción: locks, pagos, cupón/acreditación, snapshots financieros, recursos, comisión/evento, cierre. |
| Recuperación | `pos-payment-state.ts`, `pos-payment-actions.ts` | closeUncertain, UUID/cuerpo congelados y reintento explícito; versión/conflicto y estados autenticación. |
| Impresión | `pos-printing.ts`, `pos-print-ticket.tsx`, `ui/printing/` | Abierta, cerrada, reimpresión, BLE/serial/ESC-POS; fallo impresión separado de venta. |

Una orden `open` puede pasar a `closed` o `voided`. No vuelve a abierta. Retomar significa continuar una que sigue abierta. El laboratorio no autoriza reapertura de cerradas.

Cliente/membresía/cupón no se persisten hoy en orden abierta: estado temporal del cobro. Cambiar vistas dentro de la misma orden lo conserva; salir/recargar lo pierde. No convertir la continuidad mayor de la maqueta en almacenamiento nuevo implícito.

## API actual

Prefijo `/api/modules/pos/`, rutas en `modules/pos/server/routes.ts` y `payment-routes.ts`.

| Método/ruta | Entrada / salida actual |
| --- | --- |
| GET catalog?locationId | Productos con precio, incluido0; categorías/ranking; validación local. |
| GET orders | `{open,closedToday}`. `?status=voided`: open vacío, anuladas90d. |
| POST orders | `{tableLabel|tableId,locationId?,items,note?}` →201 PosOrder. Admite abrir sin líneas. |
| GET orders/:id | PosOrder; inexistente o ajena404. |
| PUT orders/:id | version + lista completa de items; snapshots por lineId. |
| POST orders/:id/close | clientRequestId,version,membershipId?,coupon?,payments?; transacción idempotente. |
| POST orders/:id/void | Solo abierta; repetir anulada200; cerrada409. |
| POST resolve | qrToken,locationId?; puede enrolar/registrar escaneo. |
| GET coupon-state | membershipId; consulta/revalida cupón. |
| POST coupon-remove | Modifica selección global del cliente; no usar para exclusión local. |
| GET tables | Por local; Mesas apagado→[]. |
| GET payment-methods | Medios activos. |
| GET ticket / GET,PUT ticket-settings | Ajustes de impresión; settings solo owner. |
| PUT /api/modules/pos | Toggle genérico; bloqueado por abiertas/dependencias. |

PosOrder: id,status,version,tableLabel,tableId,location,note,business,items,total,createdAt/By,closedAt/By,sale,settlement. Dinero en strings. `sale` pertenece al cierre identificado; su ausencia no indica ausencia de ingreso. Toda venta tiene settlement; listas deben usar neto correcto también sin cliente.

## Diferencias con v004 y decisión de tratamiento

| Laboratorio / objetivo | Brecha real | Tratamiento en0242 |
| --- | --- | --- |
| Tipos Mesa/Retiro/Delivery/Mostrador | Hoy no existe saleType; table_label obligatorio | Tipo explícito separado de etiqueta y tableId; migrar históricos sin adivinar canal. |
| Etiqueta Retiro/Delivery | Solo contrato de mesa/etiqueta | Campo identificador obligatorio, sin logística nueva. |
| Confirmar/listar/retomar/cerrar | Base existente | Preservar estados, orden/listados, locales, notas, anular, tickets y conflictos. |
| Cliente conservado en varias órdenes | Maqueta en memoria | Mantener reglas temporales actuales; no persistir asociación nueva en DB. |
| Peso y precio por kg/lb/g | Cantidades enteras y tarifas2dec | Contrato exacto y snapshots versionados; migración por defecto unit. |
| Total0 con cupón | Ya soportado | payments=[]; línea real, stock/eventos y cupón una sola vez. |
| Premios PWA→cupón | No existe emisión | Owner excluye PWA; suspende canje directo por ahora. No implementar. |
| Fidelización externa | Legacy acreditación rápida | Diferida por owner; no trasladar UI a POS. |
| Citas y futuros rubros | Maqueta solamente | Diseño extensible; no entregar Agenda/GYM/taller nuevo en0242. |

## Cantidades: consumidores que deben cambiar juntos

- `packages/db/src/schema/catalog.ts`: unit_price/unit_cost numeric12,2 sin unidad de venta.
- `packages/db/src/schema/modules/pos.ts`: pos_order_item.quantity integer.
- `packages/db/src/schema/order.ts`: core.order_item.quantity integer.
- `server/counter/grant-input.ts::buildDetailed`, `counter/orders.ts::itemValuesSql`: integer y cast `::integer`.
- `modules/pos/server/lines.ts`, `ui/pos-payment-preview.ts`: enteros/BigInt y tarifa2dec.
- `packages/domain/src/financial/settlement.ts`: safe integer para cantidad.
- `server/module-events/publish.ts`: safe integer; eventos versionados types/decode.
- `recipes/server/consumption-snapshot.ts`, `model/expand.ts`: BigInt de cantidad vendida entera.
- `stock/consumption.ts`, `stock/server/consumption-cost.ts`: ledger escala3, snapshot exacto y estado pendiente/completo.
- `modules/pos/server/metrics.ts`, best-sellers/list itemCount: no sumar gramos y piezas como unidades homogéneas.
- Cupones `counter/coupon-discount.ts`: gratis/2x1 bonifican una unidad; no interpretar gramos como piezas.

Los eventos actuales V1/V2/V3 y sus replays deben seguir decodificándose. Stock se aplica de forma durable tras sale.closed; confirmar una orden no reserva/descuenta stock. No afirmar consumo aplicado si delivery pendiente. Merma explícita separada del movimiento por venta.

## Retiro Mostrador: inventario obligatorio

| Consumidor actual | Riesgo y migración requerida |
| --- | --- |
| `/backoffice/counter/page.tsx`, counter-console, redeem-panel | Retirar pantalla QR/acreditación/canje; redirect compatible a POS/local autorizado. |
| `/api/counter/{resolve,grant,redeem,coupon-state,coupon-remove}` | No dejar writes legacy accesibles para saltar POS/suspensión. Resolver retiro explícito y códigos410 para funciones retiradas. |
| `server/counter/*` | Dominio compartido POS; extraer/adaptar, no borrar por nombre. |
| POS importa `app/backoffice/counter/{types,sale-forms,cart}` | Mover componentes/tipos compartidos antes de borrar UI legacy, conservando kit. |
| `backoffice-navigation`, `backoffice/page`, auth-guards.requireOwner, analytics/page | Navegación y fallback staff apuntan a counter; retarget genérico con permiso/módulo validado. |
| onboarding checklist/tours/staff defaults | Actualizar destinos y copy. |
| customers/page y customers/analytics, analytics/actions | Permiso core counter también controla Clientes. No borrarlo sin reemplazo semántico de Clientes. |
| permissions-catalog/staff-contract/normalización | Migración acotada counter→pos, mantener capacidad Clientes, sin elevar otros permisos. |
| módulo POS apagado/staff counter-only | Activación y acceso necesitan transición explícita, sin pérdida silenciosa ni activar módulos ajenos. |
| core.order y reward_redemption históricos | Conservar auditoría/saldos, no convertir acreditaciones en nuevas ventas ni duplicar ingresos. |

## PWA: hallazgo y alcance actualizado

`apps/consumer/src/app/(consumer)/wallet/rewards-modal.tsx` solo muestra catálogo/saldo; no emite cupones. `/api/public/consumer/coupon-selection` selecciona cupones existentes. Canje legacy `counter/redeem.ts` debita/entrega; campaign_coupon exige campaña; reward_redemption exige actor merchant. No confundir selección con emisión ni fabricar campaña para simular premio.

Owner respondió durante el mapeo: **PWA fuera, políticas de premio fuera, dejar de ofrecer canje directo por ahora**. Por tanto0242 retira esa oferta/endpoint operativo preservando registros y saldos; futuro premio→cupón requerirá otra spec. No hay dependencia de esa implementación para entregar0242.

## Evidencia futura decisiva

Comparar históricos, enteros/peso, snapshots al cambiar catálogo/unidad, total0, carreras/idempotencia/commit incierto, tenant/local/permisos/módulo/PIN/email/billing, staff migrado, clientes, enlaces counter, replay V1/V2/V3/V4, recetas/stock/comisiones/analytics/tickets. Browser de mockup no sustituye handlers reales ni CI protegida.
