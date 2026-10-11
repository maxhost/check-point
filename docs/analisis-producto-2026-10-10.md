# Analisis de producto (2026-10-10) — insumo para el reporte de retorno

Resumen de la sesion de posicionamiento con el owner (2026-10-10). Lo decidido ya esta en los ADR 0134 (planes) y
0136 (vencimiento). Aca queda lo que sirve para la proxima funcionalidad: **el reporte de retorno / la analitica**.

## Por que el reporte

- Sin un numero de lo que la red le devolvio al comercio («este mes la red te trajo 14 clientes nuevos y $X en
  compras») no se sostiene la renovacion a los $20. El owner: «pensar en el reporte porque eso es valor percibido».
- El diferencial frente a Perkstar, Square Loyalty o Toast es que **la red le manda clientes nuevos** (Venta cruzada
  entre comercios vecinos), no solo fideliza a quien ya entro. El reporte tiene que hacer visible eso.
- La competencia real en una ciudad de Ecuador es la tarjeta de carton, WhatsApp e Instagram (gratis): el discurso es
  de retorno («se paga solo con 2 clientes mas al mes»), no de funciones.

## Reglas que ya existen

- **ADR 0021** (analiticas universales y lentes por rubro): solo eventos verificables; no inferir ingresos ni
  causalidad; resumen universal + detalle de campaña + lentes opcionales por rubro.
- La pantalla de analitica del demo se borro (ver `docs/TASKS.md`, «tile de Analiticas»). Hoy hay resultados sueltos
  de campañas (`apps/merchant/src/app/api/marketing/rewards/results`, `server/marketing/results*.ts`) y la lista de
  clientes (`server/customers/list.ts`).

## Datos que hay (punto de partida, a medir juntos)

| Dato | Donde |
|---|---|
| Ventas acreditadas (monto, unidades, local, momento, items) | `core.order`, `core.order_item` (mostrador y POS) |
| Canjes de premios | `core.reward_redemption` |
| Cupones de campaña emitidos y canjeados | `core.campaign_coupon`, `core.coupon_redemption` |
| Venta cruzada (de que comercio vino el cliente) | `schema/cross-sale.ts` |
| Altas al programa, local de origen del QR | `consumer.program_membership` (`origin_location_id`, `enrolled_at`) |
| Primera alta y ultima visita por cliente | `core.business_customer` |
| Avisos enviados (push) | `consumer.wallet_push_queue` |
| Vencimientos de saldo (nuevo, 0195) | `core.balance_expiration` |
| Ventas del POS sin pase | `core.pos_order` (sin `order_id`) |

## Decisiones del owner de esa sesion (no volver a preguntar)

- No hay plan gratis; prueba de 90 dias para todos; base $20 con Bienvenida y Venta cruzada (ADR 0134).
- WhatsApp y email descartados como canal (costo / nadie usa email). Reseñas de Google: no son nuestras.
- Cashback, tarjetas de regalo y referidos: futuro, no ahora.

## Abierto (para trabajar juntos)

Que preguntas responde el reporte, para quien (dueño vs. encargado), con que periodicidad, que se puede atribuir de
verdad a la red o a una campaña sin inventar causalidad, y en que plan va.
