---
name: qa-cupones-prueba
description: TEMPORAL (QA del owner, desde 2026-10-04). Habilita para HOY y resetea los canjes de los cupones de los tres comercios de prueba en PROD (Panaderia, Barberia, Gym) por MCP de Neon, para repetir las pruebas de bienvenida/venta cruzada. Uso `/qa-cupones-prueba estado|habilitar|resetear|ciclo`. Nunca toca otro comercio.
---

# QA de cupones en los comercios de prueba

Pedido del owner (2026-10-04): mientras duren las pruebas, poder «invocar algo» que (1) habilite para usar YA los
cupones que emitan los tres comercios de prueba y (2) borre su uso para volver a canjear el mismo cupon. **Es temporal:
se borra junto con los datos de prueba** (los productos estan en la categoria «Prueba» de cada comercio).

## Alcance fijo — no se amplia sin el owner

- Base: PROD. Proyecto Neon `red-violet-38772073`, rama default `br-curly-silence-ax8acywm` (pasar los dos siempre).
- Comercios (UNICOS que se tocan):
  - Panaderia `f3f74630-b583-4ab7-9bc3-4d47bd2f3fb0`
  - Barberia `c512bbd2-b203-43f6-8fe5-24778387a331`
  - Gym `02e37e89-66a4-4d1e-9f92-d83e6f4856af`
- Toda sentencia filtra por `business_id = any(<IDS>)` con
  `<IDS>` = `array['f3f74630-b583-4ab7-9bc3-4d47bd2f3fb0','c512bbd2-b203-43f6-8fe5-24778387a331','02e37e89-66a4-4d1e-9f92-d83e6f4856af']::uuid[]`.
  Si el owner nombra otro comercio, preguntar antes: no esta en el alcance.

## Acciones

Argumento: `estado` (default), `habilitar`, `resetear`, o `ciclo` (= `resetear` + `habilitar`). Correr SIEMPRE `estado`
antes y despues de escribir, y mostrarle al owner la tabla de despues (comercio, label, origen, `desde_manana`,
canjeado). Ninguna afirmacion de «listo» sin esa lectura.

### estado (solo lectura, `mcp__neon__run_sql`)

```sql
select b.name comercio, cc.id coupon_id, cc.label_snapshot, cc.kind_snapshot,
  case when cc.welcome_membership_id is not null then 'bienvenida' when cc.cross_claimed_at is not null then 'cruzada'
       when cc.turn_id is not null then 'turno' else 'otro' end origen,
  cc.valid_from, cc.valid_until, cc.valid_from > now() desde_manana, cc.valid_until <= now() vencido,
  cr.id redemption_id, cr.order_id, cr.created_at canjeado_at
from core.campaign_coupon cc
join core.business b on b.id = cc.business_id
left join core.coupon_redemption cr on cr.coupon_id = cc.id
where cc.business_id = any(<IDS>)
order by b.name, cc.created_at;
```

### habilitar (`mcp__neon__run_sql`)

Adelanta a «ahora» el inicio de los cupones que todavia no valen (la bienvenida nace «desde mañana»). No toca los
vencidos (`valid_until <= now()`): si el owner quiere revivir uno vencido, es otra decision y se pregunta.

```sql
update core.campaign_coupon set valid_from = now()
where business_id = any(<IDS>) and valid_from > now() and valid_until > now()
returning id, label_snapshot, valid_from, valid_until;
```

### resetear (`mcp__neon__run_sql_transaction`, en este orden)

Hace lo mismo que el «quitar» del mostrador (`apps/merchant/src/server/counter/coupon-remove.ts`) pero para TODOS los
canjes de los tres comercios, de cualquier dia y aunque esten atados a una venta. La unica FK entrante a
`coupon_redemption` es `campaign_turn.outcome_redemption_id`.

```sql
update core.campaign_turn set outcome = null, outcome_at = null, outcome_redemption_id = null
where outcome_redemption_id in (select id from core.coupon_redemption where business_id = any(<IDS>));
update consumer.consumer_account set selected_coupon_id = null, coupon_selected_at = null
where selected_coupon_id in (select id from core.campaign_coupon where business_id = any(<IDS>));
delete from core.coupon_redemption where business_id = any(<IDS>);
```

Libera tambien el limite de un cupon por cliente + comercio + dia (se lee de `coupon_redemption`) y deja a los clientes
sin cupon elegido en esos comercios (el owner vuelve a elegir desde la PWA).

## Lo que NO deshace (decirselo al owner cuando aplique)

- Una venta hecha con cupon: la `order` (total neto) y los puntos/sellos que dio **quedan**. Igual los `extra_*` ya
  acreditados. Borrarlos toca ventas y saldos: es otro pedido.
- La venta cruzada (0143) tiene su propia regla de una vez por campaña por cliente en otras tablas: esta skill no la
  resetea. Si el owner lo pide, medir primero que tablas son y proponer la ampliacion.
- La «visita» (`business_customer.last_visit_at`) queda contada.
