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

## Inventario de datos (medido 2026-10-10: schema de `packages/db` + `information_schema` de PROD)

**Volumen en PROD hoy:** 3 comercios, 3 locales, 73 productos, 3 `pos_order` (10 items), **0 clientes, 0 ventas
acreditadas, 0 cupones, 0 decisiones de venta cruzada** (`pg_stat_user_tables.n_live_tup`). No hay datos reales para
explorar: el reporte se diseña sobre lo que el schema captura, no sobre volumen.

| Hecho (se escribe cuando...) | Tabla | Que trae | Historia |
|---|---|---|---|
| Venta acreditada a un cliente con pase (mostrador o POS) | `core.order` + `order_item` | cliente, local, monto, moneda, items (producto, precio, cantidad), sellos/puntos dados, quien la cargo, hora | completa, una fila por venta |
| Venta del POS (con o sin pase) | `core.pos_order` + `pos_order_item` | local, mesa, items, quien abrio/cerro, hora; `order_id` solo si hubo pase | completa |
| Alta al programa | `consumer.program_membership` | cliente, comercio, local del QR (`origin_location_id`), fecha, saldo actual, baja de marketing | alta + saldo ACTUAL (sin historia del saldo fuera de `order`/canjes) |
| Cliente del comercio | `core.business_customer` | primera alta, **ultima** visita, **ultimo** escaneo | solo el ultimo valor: se pisa |
| Canje de premio del programa | `core.reward_redemption` | premio, tipo, puntos/sellos debitados, saldo antes/despues, quien, hora | completa |
| Cupon emitido (bienvenida, venta cruzada, valle, campañas) | `core.campaign_coupon` | campaña, cliente, tipo y valor del beneficio, costo declarado, vigencia, canal que lo emitio | completa |
| Cupon canjeado | `core.coupon_redemption` | cupon, campaña, local, **venta a la que se ato** (`order_id`, puede ser null) y descuento | completa |
| Decision de venta cruzada (cada venta en A con la funcion prendida) | `core.cross_decision` + `cross_candidate` | origen A, resultado, campaña/cupon elegido de B, candidatos con distancia/segmento, click en el aviso | completa |
| Aviso push de campaña | `core.campaign_push` | cliente, campaña, **holdout (grupo de control: decidido y NO enviado)**, enviado, click, cancelado | completa |
| Turno en el pase (proximidad) | `core.campaign_turn` | holdout, resultado con `outcome_order_id`/`outcome_redemption_id` | completa; el canal esta apagado (spec 0138) |
| Cola de avisos al cliente | `consumer.wallet_push_queue` | clase, texto, estado, enviado | completa |
| Actividad del cliente en la app | `consumer.consumer_account` | ultima apertura, ultimo push, PWA instalada (`home_launched_at`) | solo ultimo valor |
| Suscripcion a notificaciones | `consumer.web_push_subscription`, `wallet_pass` | plataforma, alta, ultima vez vista; pase guardado en Google | estado actual |
| Valle (horas flojas) | `core.valley_detection`, `valley_window` | ventanas detectadas por local, escaneos usados | ultima deteccion |
| Vencimiento de saldo (0195, en rama) | `core.balance_expiration` | — | completa |

**Huecos medidos:**
- **Los escaneos no se guardan como eventos**: solo `last_scan_at` (se pisa). Una visita sin venta registrada no deja
  rastro; la «visita» verificable es la `order`.
- **Sin pase no hay cliente**: la venta del POS sin pase tiene monto e items pero no persona.
- **Costo de producto** (`product.unit_cost`) existe pero es declarado por el comercio: margen = «estimado configurado»
  (ADR 0021), nunca observado.
- **Holdout solo en push (y proximidad, apagada)**: es el unico lugar con grupo de control → el unico efecto que se
  puede afirmar sin inventar causalidad. Bienvenida y venta cruzada no tienen grupo de control.
